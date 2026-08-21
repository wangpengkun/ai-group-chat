const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// Disable GPU and sandbox for compatibility
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Update source URLs (v1.5.1+: stable GitHub-hosted version.json; jsDelivr as CDN fallback.
// The CloudStudio sandbox URL rotates between deployments, so it must NOT be baked into the exe.)
const UPDATE_SOURCES = [
  'https://raw.githubusercontent.com/wangpengkun/ai-group-chat/main/result',
  'https://cdn.jsdelivr.net/gh/wangpengkun/ai-group-chat@main/result'
];
// Where installers are hosted for download (explicit downloadUrl in version.json takes priority)
const UPDATE_URL = 'https://ai-chat.zhuzibaishang.com';
const APP_VERSION = app.getVersion();

// Fetch version.json trying each stable source in order
async function fetchVersionInfo() {
  let lastErr = null;
  for (const src of UPDATE_SOURCES) {
    try {
      return await fetchJSON(`${src}/version.json`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All update sources failed');
}

// ============ WorkBuddy Authentication ============
// WorkBuddy / TokenHub / Token Plan 都使用单 token Bearer 认证（key 格式类似 ck_xxxx）
// 直接使用用户填入的 key 作为 Authorization: Bearer <key>，无需额外签名。

// Check if a URL is a Tencent Cloud AI endpoint (WorkBuddy / TokenHub)
function isTencentAIUrl(url) {
  if (!url) return false;
  return url.includes('api.workbuddy.tencent.com')
    || url.includes('tokenhub.tencentmaas.com')
    || url.includes('tokenhub.tencentcloudmaas.com')
    || url.includes('tokenhub-intl.tencentcloudmaas.com');
}

// Backwards-compat alias
const isWorkBuddyUrl = isTencentAIUrl;

// v1.4.10: 按 URL 路径分流认证 header。
// opencode.ai 网关对不同模型族用不同 header（来自 kartikkabadi/opencode-go-proxy 公开映射）：
//   - /v1/models/<id>    (Google GenAI for Gemini)   → x-goog-api-key
//   - /v1/messages       (Anthropic for Claude/Qwen) → x-api-key + anthropic-version
//   - /v1/responses      (OpenAI Responses for GPT)  → Authorization: Bearer
//   - /v1/chat/completions 或其他 (OpenAI Chat)     → Authorization: Bearer
// 之前统一用 Authorization: Bearer，导致 Claude/Qwen 走 /messages 时报 401 "Missing API key"。
function setAuthHeaders(headers, apiKey, url) {
  if (!apiKey) return;
  let path = '';
  try { path = new URL(url).pathname; } catch (e) { path = String(url || ''); }
  if (path.includes('/v1/models/')) {
    // Gemini 走 Google GenAI
    headers['x-goog-api-key'] = apiKey;
  } else if (path.endsWith('/messages')) {
    // Anthropic 协议（Claude / Qwen on Zen/Go）
    headers['x-api-key'] = apiKey;
    if (!headers['anthropic-version']) headers['anthropic-version'] = '2023-06-01';
  } else {
    // /responses (GPT/Grok)、/chat/completions (其他)、以及官方直连
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'AI Group Chat',
    backgroundColor: '#f5f5f5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.setMenuBarVisibility(false);

  // Inject app version into the About dialog
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(
      `if (document.getElementById('app-version')) document.getElementById('app-version').textContent = '${APP_VERSION}';`
    );
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============ IPC Handlers ============

// Get user data path for persistent storage
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

// Generic HTTP request for AI API calls
ipcMain.handle('ai-request', async (event, options) => {
  // WorkBuddy uses direct Bearer token (key format: ck_xxxx)
  if (isWorkBuddyUrl(options.url)) {
    if (!options.apiKey || !options.apiKey.trim()) {
      return { success: false, error: 'WorkBuddy API Key 不能为空', statusCode: 0 };
    }
    // Use the key directly as Bearer token
    options.headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${options.apiKey.trim()}`,
    };
    options.apiKey = null;
  }

  return new Promise((resolve, reject) => {
    const url = new URL(options.url);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const bodyData = options.body ? JSON.stringify(options.body) : null;

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add custom headers
    if (options.headers) {
      Object.assign(reqOptions.headers, options.headers);
    }

    if (options.apiKey) {
      setAuthHeaders(reqOptions.headers, options.apiKey, options.url);
    }

    if (bodyData) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, data: data, statusCode: res.statusCode });
        } else {
          resolve({ success: false, error: data, statusCode: res.statusCode });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ success: false, error: e.message, statusCode: 0 });
    });

    req.setTimeout(60000, () => {
      req.destroy();
      resolve({ success: false, error: 'Request timeout (60s)', statusCode: 0 });
    });

    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
});

// Streaming AI request
ipcMain.handle('ai-request-stream', async (event, options) => {
  // WorkBuddy uses direct Bearer token (key format: ck_xxxx)
  let wbAuthHeaders = null;
  if (isWorkBuddyUrl(options.url)) {
    if (!options.apiKey || !options.apiKey.trim()) {
      event.sender.send('ai-stream-error', {
        requestId: options.requestId,
        error: 'WorkBuddy API Key 不能为空',
      });
      return { success: false, error: 'WorkBuddy API Key 不能为空', statusCode: 0 };
    }
    wbAuthHeaders = { 'Authorization': `Bearer ${options.apiKey.trim()}` };
  }

  return new Promise((resolve, reject) => {
    const url = new URL(options.url);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const bodyData = JSON.stringify(options.body);

    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyData),
      },
    };

    // v1.4.10: 认证 header 按 URL 协议分流（Bearer / x-api-key / x-goog-api-key）
    if (wbAuthHeaders) {
      Object.assign(reqOptions.headers, wbAuthHeaders);
    } else if (options.apiKey) {
      setAuthHeaders(reqOptions.headers, options.apiKey, options.url);
    }

    // Add custom headers
    if (options.headers) {
      Object.assign(reqOptions.headers, options.headers);
    }

    const req = lib.request(reqOptions, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        let errData = '';
        res.on('data', (chunk) => (errData += chunk));
        res.on('end', () => {
          // Also send ai-stream-error so renderer's stream listener can clean up
          event.sender.send('ai-stream-error', {
            requestId: options.requestId,
            error: `API 错误 (${res.statusCode}): ${errData || '无错误详情'}`,
          });
          resolve({ success: false, error: `API 错误 (${res.statusCode}): ${errData || '无错误详情'}`, statusCode: res.statusCode });
        });
        return;
      }

      let buffer = '';
      let fullContent = '';
      const streamUrl = options.url || '';

      // 多协议流式解析（v1.4.9）：
      // Anthropic:  data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
      //            / {"type":"message_stop"}
      // Responses:  data: {"type":"response.output_text.delta","delta":"..."}
      //            / {"type":"response.completed"}
      // OpenAI Chat: data: {"choices":[{"delta":{"content":"..."}}]}
      // Gemini:     data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
      // 这里忽略 event: 行；只看 data: 行里的 JSON.type / 字段
      function extractStreamDelta(json) {
        if (!json) return '';
        if (streamUrl.includes('/v1/models/')) {
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
        const isResponses = streamUrl.endsWith('/responses') || streamUrl.includes('/v1/responses');
        const isAnthropic = streamUrl.endsWith('/messages') || streamUrl.includes('/v1/messages');
        if (isAnthropic) {
          if (json.type === 'content_block_delta' && json.delta && typeof json.delta.text === 'string') {
            return json.delta.text;
          }
          return '';
        }
        if (isResponses) {
          if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') return json.delta;
          return '';
        }
        if (Array.isArray(json.choices) && json.choices[0]) {
          return json.choices[0].delta?.content || '';
        }
        return '';
      }

      function isStreamEnd(json, rawLine) {
        if (rawLine) {
          const t = rawLine.trim();
          if (t === 'data: [DONE]' || t === '[DONE]') return true;
        }
        if (!json) return false;
        const isAnthropic = streamUrl.endsWith('/messages') || streamUrl.includes('/v1/messages');
        const isResponses = streamUrl.endsWith('/responses') || streamUrl.includes('/v1/responses');
        if (isAnthropic) return json.type === 'message_stop';
        if (isResponses) return json.type === 'response.completed' || json.type === 'response.done';
        return false;
      }

      function emitChunk(content) {
        if (!content) return;
        fullContent += content;
        event.sender.send('ai-stream-chunk', {
          requestId: options.requestId,
          content: content,
        });
      }

      function tryFinishStream() {
        event.sender.send('ai-stream-end', {
          requestId: options.requestId,
          fullContent: fullContent,
        });
        resolve({ success: true, fullContent: fullContent });
      }

      res.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          // Anthropic 用 "event: xxx" 行表示事件类型；我们靠 data: 里的 JSON.type 自识别，忽略
          if (trimmed.startsWith('event:')) continue;
          if (!trimmed.startsWith('data:')) continue;
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') { tryFinishStream(); continue; }
          try {
            const json = JSON.parse(dataStr);
            if (isStreamEnd(json, trimmed)) { tryFinishStream(); continue; }
            emitChunk(extractStreamDelta(json));
          } catch (e) {
            // Ignore parse errors for partial data
          }
        }
      });

      res.on('end', () => {
        // Process remaining buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr !== '[DONE]') {
              try {
                const json = JSON.parse(dataStr);
                if (!isStreamEnd(json, trimmed)) {
                  emitChunk(extractStreamDelta(json));
                }
              } catch (e) {}
            }
          }
        }
        tryFinishStream();
      });
    });

    req.on('error', (e) => {
      event.sender.send('ai-stream-error', {
        requestId: options.requestId,
        error: e.message,
      });
      resolve({ success: false, error: e.message, statusCode: 0 });
    });

    req.setTimeout(120000, () => {
      req.destroy();
      event.sender.send('ai-stream-error', {
        requestId: options.requestId,
        error: 'Request timeout (120s)',
      });
      resolve({ success: false, error: 'Request timeout (120s)', statusCode: 0 });
    });

    req.write(bodyData);
    req.end();
  });
});

// Show save dialog
ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

// Show open dialog
ipcMain.handle('show-open-dialog', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

// ============ Auto Update ============

// Compare semver versions (returns true if remote > local)
function isNewerVersion(remote, local) {
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

// Fetch JSON from URL
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect
        fetchJSON(res.headers.location).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Invalid JSON'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Check for updates
ipcMain.handle('check-for-updates', async () => {
  try {
    const versionInfo = await fetchVersionInfo();
    const hasUpdate = isNewerVersion(versionInfo.version, APP_VERSION);
    return {
      hasUpdate: hasUpdate,
      version: versionInfo.version,
      currentVersion: APP_VERSION,
      downloadUrl: versionInfo.downloadUrl || 'https://ai-group-chat.oss-ap-southeast-1.aliyuncs.com/chat/ai-group-chat-Setup.exe',
      releaseNotes: versionInfo.releaseNotes || '',
    };
  } catch (e) {
    return { hasUpdate: false, error: e.message, currentVersion: APP_VERSION };
  }
});

// Download and install update
ipcMain.handle('download-update', async (event, options) => {
  try {
    const downloadUrl = options && options.url ? options.url : null;
    if (!downloadUrl) {
      const updateInfo = await fetchVersionInfo();
      const url = updateInfo.downloadUrl || 'https://ai-group-chat.oss-ap-southeast-1.aliyuncs.com/chat/ai-group-chat-Setup.exe';
      return await downloadAndInstall(url, event);
    }
    return await downloadAndInstall(downloadUrl, event);
  } catch (e) {
    return { success: false, error: e.message };
  }
});

async function downloadAndInstall(url, event) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;

    // First, get file size via HEAD request
    const headReq = lib.request(url, { method: 'HEAD' }, (headRes) => {
      const totalSize = parseInt(headRes.headers['content-length'] || '0');
      const fileName = url.split('/').pop() || 'AI-Group-Chat-Setup.exe';
      const tempPath = path.join(os.tmpdir(), fileName);

      // Now download the file
      const downloadReq = lib.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Follow redirect
          downloadAndInstall(res.headers.location, event).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          resolve({ success: false, error: `Download failed: HTTP ${res.statusCode}` });
          return;
        }

        const fileStream = fs.createWriteStream(tempPath);
        let downloadedSize = 0;

        res.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0 && event && event.sender) {
            const progress = Math.round((downloadedSize / totalSize) * 100);
            event.sender.send('update-download-progress', { progress: progress });
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          // Launch the installer
          shell.openPath(tempPath).then(() => {
            // Quit the app so the installer can proceed
            setTimeout(() => {
              app.quit();
            }, 1000);
            resolve({ success: true, path: tempPath });
          }).catch((e) => {
            resolve({ success: false, error: 'Failed to launch installer: ' + e.message });
          });
        });

        fileStream.on('error', (e) => {
          resolve({ success: false, error: 'File write error: ' + e.message });
        });
      });

      downloadReq.on('error', (e) => {
        resolve({ success: false, error: e.message });
      });

      downloadReq.setTimeout(300000, () => {
        downloadReq.destroy();
        resolve({ success: false, error: 'Download timeout (5min)' });
      });
    });

    headReq.on('error', (e) => {
      resolve({ success: false, error: 'HEAD request failed: ' + e.message });
    });

    headReq.setTimeout(10000, () => {
      headReq.destroy();
      resolve({ success: false, error: 'HEAD request timeout' });
    });

    headReq.end();
  });
}
