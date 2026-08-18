// ============ API Bridge: Cross-platform abstraction layer ============
// Detects environment (Electron / Capacitor / Web) and provides unified API.
// - Electron: delegates to window.electronAPI (IPC → main process)
// - Capacitor/Web: uses fetch() directly

const APIBridge = {
  isElectron: typeof window !== 'undefined' && !!window.electronAPI,
  isCapacitor: typeof window !== 'undefined' && !!window.Capacitor,

  // Detect Tencent Cloud AI endpoints that use Bearer token (WorkBuddy / TokenHub / Token Plan).
  // All these endpoints use direct Bearer auth — no HMAC signing needed.
  _isTencentAIUrl(url) {
    if (!url) return false;
    return url.includes('api.workbuddy.tencent.com')
      || url.includes('tokenhub.tencentmaas.com')
      || url.includes('tokenhub.tencentcloudmaas.com')
      || url.includes('tokenhub-intl.tencentcloudmaas.com');
  },

  // ============ Build request headers ============

  async _buildHeaders(options) {
    const headers = { 'Content-Type': 'application/json' };

    // WorkBuddy / TokenHub: direct Bearer token (key format: ck_xxxx)
    if (this._isTencentAIUrl(options.url)) {
      if (!options.apiKey || !options.apiKey.trim()) {
        throw new Error('API Key 不能为空');
      }
      headers['Authorization'] = `Bearer ${options.apiKey.trim()}`;
    } else if (options.apiKey) {
      // v1.4.10: 按 URL 路径分流认证 header（Bearer / x-api-key / x-goog-api-key）
      // opencode.ai 网关对 Claude/Qwen 用 x-api-key、Gemini 用 x-goog-api-key、其他用 Bearer
      let path = '';
      try { path = new URL(options.url).pathname; } catch (e) { path = String(options.url || ''); }
      if (path.includes('/v1/models/')) {
        headers['x-goog-api-key'] = options.apiKey;
      } else if (path.endsWith('/messages')) {
        headers['x-api-key'] = options.apiKey;
        if (!headers['anthropic-version']) headers['anthropic-version'] = '2023-06-01';
      } else {
        headers['Authorization'] = `Bearer ${options.apiKey}`;
      }
    }

    if (options.headers) {
      Object.assign(headers, options.headers);
    }

    return headers;
  },

  // ============ Non-streaming request ============

  async aiRequest(options) {
    // Electron: delegate to IPC
    if (this.isElectron) {
      return window.electronAPI.aiRequest(options);
    }

    // Capacitor/Web: use fetch
    try {
      const headers = await this._buildHeaders(options);
      const body = options.body ? JSON.stringify(options.body) : null;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const resp = await fetch(options.url, {
        method: options.method || 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await resp.text();

      if (resp.ok) {
        return { success: true, data, statusCode: resp.status };
      } else {
        return { success: false, error: data, statusCode: resp.status };
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        return { success: false, error: 'Request timeout (60s)', statusCode: 0 };
      }
      return { success: false, error: e.message, statusCode: 0 };
    }
  },

  // ============ Streaming request ============
  // Returns: { success, error?, statusCode }
  // Calls callbacks: onChunk(content), onEnd(fullContent), onError(error)

  async aiRequestStream(options, callbacks) {
    const { url, apiKey, body, requestId } = options;
    const { onChunk, onEnd, onError } = callbacks || {};

    // Electron: delegate to IPC (callbacks set up via streamListeners)
    if (this.isElectron) {
      return window.electronAPI.aiRequestStream(options);
    }

    // Capacitor/Web: use fetch + ReadableStream
    try {
      const headers = await this._buildHeaders(options);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...body, stream: true }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errData = await resp.text();
        if (onError) onError(`API错误 (${resp.status}): ${errData}`);
        return { success: false, error: errData, statusCode: resp.status };
      }

      // Check if streaming is supported (resp.body.getReader exists)
      if (resp.body && typeof resp.body.getReader === 'function') {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';

        // 多协议流式解析（v1.4.9）：
        //  - OpenAI Chat Completions: choices[0].delta.content / [DONE]
        //  - OpenAI Responses API:    type=response.output_text.delta (delta) / response.completed
        //  - Anthropic Messages:      type=content_block_delta (delta.text) / message_stop
        //  - Google GenAI:            candidates[0].content.parts[0].text
        function extractStreamDelta(json, u) {
          if (!json) return '';
          if (u && u.includes('/v1/models/')) {
            if (Array.isArray(json.candidates)) {
              const texts = [];
              for (const c of json.candidates) {
                const parts = c && c.content && c.content.parts;
                if (Array.isArray(parts)) for (const p of parts) if (typeof p.text === 'string') texts.push(p.text);
              }
              return texts.join('');
            }
            return '';
          }
          const isResponses = u && (u.endsWith('/responses') || u.includes('/v1/responses'));
          const isAnthropic = u && (u.endsWith('/messages') || u.includes('/v1/messages'));
          if (isAnthropic) {
            if (json.type === 'content_block_delta' && json.delta && typeof json.delta.text === 'string') return json.delta.text;
            return '';
          }
          if (isResponses) {
            if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') return json.delta;
            return '';
          }
          if (Array.isArray(json.choices) && json.choices[0]) return json.choices[0].delta?.content || '';
          return '';
        }
        function isStreamEnd(json, rawLine, u) {
          if (rawLine) {
            const t = rawLine.trim();
            if (t === 'data: [DONE]' || t === '[DONE]') return true;
          }
          if (!json) return false;
          const isAnthropic = u && (u.endsWith('/messages') || u.includes('/v1/messages'));
          const isResponses = u && (u.endsWith('/responses') || u.includes('/v1/responses'));
          if (isAnthropic) return json.type === 'message_stop';
          if (isResponses) return json.type === 'response.completed' || json.type === 'response.done';
          return false;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('event:')) continue; // Anthropic event: 行，靠 data JSON.type 自识别
            if (!trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') continue;
            try {
              const json = JSON.parse(dataStr);
              if (isStreamEnd(json, trimmed, url)) continue;
              const content = extractStreamDelta(json, url);
              if (content) {
                fullContent += content;
                if (onChunk) onChunk(content);
              }
            } catch (e) {
              // Ignore parse errors for partial data
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr !== '[DONE]') {
              try {
                const json = JSON.parse(dataStr);
                if (!isStreamEnd(json, trimmed, url)) {
                  const content = extractStreamDelta(json, url);
                  if (content) {
                    fullContent += content;
                    if (onChunk) onChunk(content);
                  }
                }
              } catch (e) {}
            }
          }
        }

        if (onEnd) onEnd(fullContent);
        return { success: true, statusCode: 200 };
      } else {
        // Streaming not supported (CapacitorHttp patched fetch)
        // Fall back to non-streaming: get full response, simulate chunks
        const data = await resp.text();
        let fullContent = '';
        try {
          const json = JSON.parse(data);
          // 多协议响应解析（v1.4.9）
          if (url && url.includes('/v1/models/')) {
            if (Array.isArray(json.candidates)) {
              const texts = [];
              for (const c of json.candidates) {
                const parts = c && c.content && c.content.parts;
                if (Array.isArray(parts)) for (const p of parts) if (typeof p.text === 'string') texts.push(p.text);
              }
              fullContent = texts.join('');
            }
          } else if (url && (url.endsWith('/messages') || url.includes('/v1/messages'))) {
            if (Array.isArray(json.content)) {
              fullContent = json.content.filter(p => p && (p.type === 'text' || typeof p.text === 'string'))
                .map(p => p.text || '').join('');
            }
          } else if (url && (url.endsWith('/responses') || url.includes('/v1/responses'))) {
            if (Array.isArray(json.output)) {
              const texts = [];
              for (const o of json.output) {
                if (Array.isArray(o && o.content)) {
                  for (const c of o.content) if (typeof c.text === 'string') texts.push(c.text);
                }
              }
              fullContent = texts.join('');
            } else if (typeof json.output_text === 'string') {
              fullContent = json.output_text;
            }
          } else {
            fullContent = json.choices?.[0]?.message?.content || '';
          }
        } catch (e) {
          fullContent = data;
        }

        // Simulate streaming: send content in chunks
        if (onChunk && fullContent) {
          const chunkSize = Math.max(2, Math.floor(fullContent.length / 50));
          for (let i = 0; i < fullContent.length; i += chunkSize) {
            const chunk = fullContent.slice(i, i + chunkSize);
            if (onChunk) onChunk(chunk);
            // Small delay for typing effect
            await new Promise(r => setTimeout(r, 20));
          }
        }

        if (onEnd) onEnd(fullContent);
        return { success: true, statusCode: 200 };
      }
    } catch (e) {
      // If streaming fails entirely, try non-streaming as last resort
      if (this.isCapacitor) {
        try {
          const nonStreamBody = { ...body, stream: false };
          const result = await this.aiRequest({ ...options, body: nonStreamBody });

          if (result.success) {
            let fullContent = '';
            try {
              const json = JSON.parse(result.data);
              fullContent = json.choices?.[0]?.message?.content || '';
            } catch (e2) {
              fullContent = result.data;
            }

            if (onChunk && fullContent) {
              const chunkSize = Math.max(2, Math.floor(fullContent.length / 50));
              for (let i = 0; i < fullContent.length; i += chunkSize) {
                const chunk = fullContent.slice(i, i + chunkSize);
                if (onChunk) onChunk(chunk);
                await new Promise(r => setTimeout(r, 20));
              }
            }

            if (onEnd) onEnd(fullContent);
            return { success: true, statusCode: result.statusCode };
          } else {
            if (onError) onError(result.error || 'Unknown error');
            return result;
          }
        } catch (e2) {
          const errMsg = e2.message;
          if (onError) onError(errMsg);
          return { success: false, error: errMsg, statusCode: 0 };
        }
      }

      const errMsg = e.name === 'AbortError' ? 'Request timeout (120s)' : e.message;
      if (onError) onError(errMsg);
      return { success: false, error: errMsg, statusCode: 0 };
    }
  },

  // ============ Stream event listeners (Electron only) ============
  // In Capacitor, streaming callbacks are passed directly to aiRequestStream

  onStreamChunk(callback) {
    if (this.isElectron) window.electronAPI.onStreamChunk(callback);
  },

  onStreamEnd(callback) {
    if (this.isElectron) window.electronAPI.onStreamEnd(callback);
  },

  onStreamError(callback) {
    if (this.isElectron) window.electronAPI.onStreamError(callback);
  },

  // ============ Auto-update ============

  // Stable public version sources (both send Access-Control-Allow-Origin: * so browsers can fetch)
  _versionSources: [
    'https://raw.githubusercontent.com/wangpengkun/ai-group-chat/main/result/version.json',
    'https://cdn.jsdelivr.net/gh/wangpengkun/ai-group-chat@main/result/version.json'
  ],

  _localVersion() {
    const el = document.getElementById('app-version');
    const m = ((el && el.textContent) || '').match(/\d+\.\d+\.\d+/);
    return m ? m[0] : '0.0.0';
  },

  _isNewer(remote, local) {
    const r = String(remote).split('.').map(Number);
    const l = String(local).split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
      const rv = r[i] || 0, lv = l[i] || 0;
      if (rv > lv) return true;
      if (rv < lv) return false;
    }
    return false;
  },

  async checkForUpdates() {
    if (this.isElectron) return window.electronAPI.checkForUpdates();
    // Web / PWA / APK: compare remote version.json against the local build version
    let info = null, lastErr = null;
    for (const src of this._versionSources) {
      try {
        const res = await fetch(src, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        info = await res.json();
        break;
      } catch (e) { lastErr = e; }
    }
    const local = this._localVersion();
    if (!info) return { hasUpdate: false, error: lastErr ? lastErr.message : 'fetch failed', currentVersion: local };
    // APK: point at the APK package; PWA/browser: point at the download page
    const downloadUrl = this.isCapacitor
      ? (info.apkUrl || info.downloadPage || '')
      : (info.downloadPage || info.apkUrl || '');
    if (this._isNewer(info.version, local)) this._lastUpdateUrl = downloadUrl;
    return {
      hasUpdate: this._isNewer(info.version, local),
      version: info.version,
      currentVersion: local,
      downloadUrl: downloadUrl,
      releaseNotes: info.releaseNotes || ''
    };
  },

  async downloadUpdate() {
    if (this.isElectron) return window.electronAPI.downloadUpdate();
    // Web / PWA / APK: open the download URL (APK file or download page) externally
    const url = this._lastUpdateUrl || '';
    if (!url) return { success: false, error: '下载地址不可用，请到发布页手动下载' };
    try {
      const win = window.open(url, '_blank');
      if (!win) window.location.href = url; // popup blocked -> navigate (apk link triggers system download)
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  onUpdateDownloadProgress(callback) {
    if (this.isElectron) window.electronAPI.onUpdateDownloadProgress(callback);
  },

  // ============ Platform info ============

  getPlatform() {
    if (this.isElectron) return 'electron';
    if (this.isCapacitor) return 'capacitor';
    return 'web';
  },

  isMobile() {
    return this.isCapacitor || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  },
};

// Export for both module and global
if (typeof module !== 'undefined') module.exports = APIBridge;
if (typeof window !== 'undefined') window.APIBridge = APIBridge;
