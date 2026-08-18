// ============ Store: Local state management & persistence ============

const Store = {
  data: {
    user: {
      name: '我',
      avatar: '\u{1F642}',
    },
    agents: [],
    conversations: [],
    activeConversationId: null,
    activeNav: 'chats', // 'chats' | 'contacts' | 'settings'
    settings: {
      replyMode: 'sequential', // 'sequential' | 'parallel'
      replyDelay: 500,
      autoContinue: true, // group discussions auto-continue until consensus or max rounds
      maxRounds: 5, // default max discussion rounds (0 = unlimited)
      consensusThreshold: 95, // 共识度计算环节的达成阈值（0-100），由最后一个发言的 AI 评估
    },
  },

  init() {
    this.load();
    // Migration: map old provider field to aiModel + channel
    this.migrateProviderMatrix();
    // Migrate old DeepSeek URL/model
    this.migrateDeepSeek();
    // Migrate: set all agents to strategic_advisor rule template
    this.migrateStrategicAdvisor();
    // Migrate: WorkBuddy agents from broken api.workbuddy.tencent.com → TokenHub
    this.migrateWorkBuddyUrl();
    // Migrate: TokenHub URL + model name (v1.4.2: fix /plan/v3/ → /v1/ and "auto" → real model)
    this.migrateTokenHub();
    // Migrate: add WorkBuddy agent if not present
    this.migrateWorkBuddy();
    // Migrate: ensure every agent has role / rolePrompt fields (v1.4.2)
    this.migrateAgentRole();
    // Migrate: ensure settings has maxRounds field (v1.4.3)
    this.migrateSettings();
    // Migrate: ensure settings has consensusThreshold field (v1.4.8)
    this.migrateConsensusThreshold();
    // Migrate v1.4.6: 三个新群聊必备规则默认勾选
    this.migrateSimpleRules();
    // Migrate v1.5.0: 确保已有会话拥有 attachments 字段
    this.migrateAttachments();
    // Add new default agents if user has none
    if (this.data.agents.length === 0) {
      this.data.agents = this.getDefaultAgents();
      this.save();
    }
  },

  // Migration: set strategic_advisor as default rule template for all agents
  migrateStrategicAdvisor() {
    let changed = false;
    this.data.agents.forEach(a => {
      if (!a.ruleTemplate || a.ruleTemplate === 'custom') {
        a.ruleTemplate = 'strategic_advisor';
        changed = true;
      }
      // Ensure outputConsensus is enabled
      if (!a.ruleOptions) {
        a.ruleOptions = {
          replyToAll: true, labelTarget: true, questionOthers: true,
          canAgree: true, seekConsensus: true, outputConsensus: true,
        };
        changed = true;
      } else if (a.ruleOptions.outputConsensus === undefined) {
        a.ruleOptions.outputConsensus = true;
        changed = true;
      }
    });
    if (changed) this.save();
  },

  // Migration v1.4.6: 三个新群聊必备规则默认勾选（缺省视为 true）
  // - simpleAnswer：简单问题给简单答案
  // - noExpand：用户没要求就不展开
  // - noRedissectConsensus：共识达成后不再拆解共识
  migrateSimpleRules() {
    let changed = false;
    this.data.agents.forEach(a => {
      if (!a.ruleOptions) {
        a.ruleOptions = {};
        changed = true;
      }
      if (a.ruleOptions.simpleAnswer === undefined) {
        a.ruleOptions.simpleAnswer = true;
        changed = true;
      }
      if (a.ruleOptions.noExpand === undefined) {
        a.ruleOptions.noExpand = true;
        changed = true;
      }
      if (a.ruleOptions.noRedissectConsensus === undefined) {
        a.ruleOptions.noRedissectConsensus = true;
        changed = true;
      }
    });
    if (changed) this.save();
  },

  // Migration: WorkBuddy agents that used the broken api.workbuddy.tencent.com URL
  // → migrate to TokenHub 国内 / 海外 with the same ck_ key.
  migrateWorkBuddyUrl() {
    let changed = false;
    this.data.agents.forEach(a => {
      // 同时兼容旧 aiModel='workbuddy' 与新 channel='tokenhub_cn' 之类
      const isWbish = a.aiModel === 'workbuddy' || a.channel === 'tokenhub_cn' || a.channel === 'tokenhub_intl';
      if (isWbish && a.apiUrl && a.apiUrl.includes('api.workbuddy.tencent.com')) {
        a.channel = 'tokenhub_cn';
        a.apiUrl = 'https://tokenhub.tencentcloudmaas.com/v1/chat/completions';
        if (!a.model || a.model === 'auto') a.model = 'deepseek-v4-pro';
        changed = true;
      }
    });
    if (changed) this.save();
  },

  // Migration: fix wrong TokenHub URL (/plan/v3/... → /v1/...) and invalid model "auto" → "deepseek-v4-pro"
  // (v1.4.2: previous build mistakenly used /plan/v3/ and model "auto", both wrong)
  migrateTokenHub() {
    let changed = false;
    this.data.agents.forEach(a => {
      if (a.aiModel !== 'workbuddy') return;
      if (!a.apiUrl) return;
      // Fix wrong URL path
      if (a.apiUrl.includes('tokenhub.tencentcloudmaas.com/plan/v3') ||
          a.apiUrl.includes('tokenhub-intl.tencentcloudmaas.com/plan/v3')) {
        a.apiUrl = a.apiUrl.replace('/plan/v3/chat/completions', '/v1/chat/completions');
        changed = true;
      }
      // Fix invalid model name "auto" (TokenHub does not support "auto"; must be a real model)
      if (!a.model || a.model === 'auto') {
        a.model = 'deepseek-v4-pro';
        changed = true;
      }
    });
    if (changed) this.save();
  },

  // Migration: ensure every agent has role / rolePrompt fields (backward compat v1.4.2)
  migrateAgentRole() {
    let changed = false;
    this.data.agents.forEach(a => {
      if (!a.role) {
        a.role = 'custom';
        changed = true;
      }
      if (a.rolePrompt === undefined) {
        a.rolePrompt = '';
        changed = true;
      }
    });
    if (changed) this.save();
  },

  // Migration: ensure settings has maxRounds field (v1.4.3)
  migrateSettings() {
    if (!this.data.settings) {
      this.data.settings = {};
    }
    if (this.data.settings.maxRounds === undefined) {
      this.data.settings.maxRounds = 5;
      this.save();
    }
  },

  // Migration: ensure settings has consensusThreshold field (v1.4.8)
  migrateConsensusThreshold() {
    if (!this.data.settings) {
      this.data.settings = {};
    }
    if (this.data.settings.consensusThreshold === undefined) {
      this.data.settings.consensusThreshold = 95;
      this.save();
    }
  },

  // Migration v1.5.0: 老会话补 attachments 字段，避免读取 undefined 报错
  migrateAttachments() {
    let changed = false;
    for (const conv of this.data.conversations) {
      if (!Array.isArray(conv.attachments)) {
        conv.attachments = [];
        changed = true;
      }
    }
    if (changed) this.save();
  },

  // Migration v1.4.5: 老的 (aiModel, channel) 数据 → 新 (channel, modelKey)
  // 例：aiModel='kimi', channel='opencode_go' → channel='opencode_go', aiModel='kimi_k3'
  migrateProviderMatrixV2() {
    let changed = false;
    // 需要 AIService，但 store.js 在 ai-service.js 之前加载 → 延后到 init 调用方做
    // 这里只标记数据需要迁移
    this.data.agents.forEach(a => {
      if (a._matrixV2 !== true) {
        a._matrixV2 = true; // 标记为"已尝试迁移"，实际映射由 init 调用方完成
        changed = true;
      }
    });
    if (changed) this.save();
  },

  // Migration: add WorkBuddy agent if not present
  migrateWorkBuddy() {
    const hasWorkBuddy = this.data.agents.some(a => a.aiModel === 'workbuddy');
    if (!hasWorkBuddy) {
      const baseRule = {
        replyToAll: true, labelTarget: true, questionOthers: true,
        canAgree: true, seekConsensus: true, outputConsensus: true,
        simpleAnswer: true, noExpand: true, noRedissectConsensus: true,
      };
      this.data.agents.push({
        id: this.genId(),
        name: 'WorkBuddy',
        avatar: '\u{1F916}',
        color: '#0052D9',
        aiModel: 'workbuddy',
        channel: 'tokenhub_cn',
        apiUrl: 'https://tokenhub.tencentcloudmaas.com/v1/chat/completions',
        apiKey: '',
        model: 'deepseek-v4-pro',
        systemPrompt: 'You are WorkBuddy, a powerful AI assistant by Tencent. You are helpful, knowledgeable, and versatile.',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        ruleTemplate: 'strategic_advisor',
        ruleOptions: { ...baseRule },
        customRules: '',
      });
      this.save();
    }
  },

  // Migration: map old flat provider to aiModel + channel
  migrateProviderMatrix() {
    const oldToNew = {
      'deepseek':          { aiModel: 'deepseek', channel: 'official' },
      'qianwen':           { aiModel: 'qwen',     channel: 'official' },
      'doubao':            { aiModel: 'doubao',   channel: 'official' },
      'kimi':              { aiModel: 'kimi',     channel: 'official' },
      'zhipu':             { aiModel: 'glm',      channel: 'official' },
      'openai':            { aiModel: 'gpt',      channel: 'official' },
      'workbuddy':         { aiModel: 'deepseek', channel: 'official' }, // fallback
      'opencode_deepseek': { aiModel: 'deepseek', channel: 'opencode_zen' },
      'opencode_claude':   { aiModel: 'claude',   channel: 'opencode_zen' },
      'opencode_gpt':      { aiModel: 'gpt',      channel: 'opencode_zen' },
      'opencode_glm':      { aiModel: 'glm',      channel: 'opencode_zen' },
      'opencode_kimi':     { aiModel: 'kimi',     channel: 'opencode_zen' },
      'opencode_gemini':   { aiModel: 'gemini',   channel: 'opencode_zen' },
      'opencode_grok':     { aiModel: 'grok',     channel: 'opencode_zen' },
    };
    let changed = false;
    this.data.agents.forEach(a => {
      if (!a.aiModel && a.provider && oldToNew[a.provider]) {
        const mapping = oldToNew[a.provider];
        a.aiModel = mapping.aiModel;
        a.channel = mapping.channel;
        delete a.provider;
        changed = true;
      }
      if (!a.channel) {
        a.channel = 'official';
        changed = true;
      }
    });
    if (changed) this.save();
  },

  // Migration: update old DeepSeek URL/model to current ones
  migrateDeepSeek() {
    const OLD_URL = 'https://api.deepseek.com/v1/chat/completions';
    const NEW_URL = 'https://api.deepseek.com/chat/completions';
    const OLD_MODELS = ['deepseek-chat', 'deepseek-reasoner'];
    const NEW_MODEL = 'deepseek-v4-flash';
    let changed = false;
    this.data.agents.forEach(a => {
      if (a.apiUrl && a.apiUrl.includes('api.deepseek.com')) {
        if (a.apiUrl === OLD_URL) { a.apiUrl = NEW_URL; changed = true; }
        if (OLD_MODELS.includes(a.model)) { a.model = NEW_MODEL; changed = true; }
      }
    });
    if (changed) this.save();
  },

  getDefaultAgents() {
    const baseRule = {
      replyToAll: true,
      labelTarget: true,
      questionOthers: true,
      canAgree: true,
      seekConsensus: true,
      outputConsensus: true,
      simpleAnswer: true,
      noExpand: true,
      noRedissectConsensus: true,
    };

    // 默认角色定位文案（与 ai-service.js 中的 agentRoles.defaultPrompt 保持一致）
    const defaultPromptFor = (key) => {
      const defaults = {
        market_insight: '你是一位专业的市场洞察分析师。你擅长研究市场趋势、用户需求、竞争格局。你的核心职责是用数据和事实揭示机会与风险，帮助团队做出明智的市场决策。在讨论中，你会优先关注：市场规模、增长趋势、目标用户画像、竞品差异点、潜在风险。',
        product: '你是一位经验丰富的产品经理。你专注于从用户价值出发设计产品，追求功能、体验与商业目标的平衡。你的核心职责是把模糊的需求转化为清晰、可落地的产品方案。在讨论中，你会优先关注：用户痛点、需求优先级、核心场景、可行性、衡量指标。',
        presales: '你是一位专业的售前顾问。你深谙客户业务场景，擅长将产品价值与客户需求精准对接。你的核心职责是在销售过程中提供技术方案支持、答疑解惑、促成签单。在讨论中，你会优先关注：客户痛点、产品与场景的匹配度、ROI、差异化价值、方案落地风险。',
        development: '你是一位资深软件开发工程师。你注重代码质量、可维护性和工程实践。你的核心职责是用技术手段解决业务问题，交付稳定可靠的系统。在讨论中，你会优先关注：技术可行性、架构合理性、实现成本、可扩展性、可测试性。',
        testing: '你是一位严谨的质量测试工程师。你擅长从用户视角和工程视角发现缺陷，追求零漏测、零遗漏。你的核心职责是用系统化的方法保障产品质量。在讨论中，你会优先关注：边界条件、异常流程、用户体验断层、回归风险、自动化覆盖。',
        deployment: '你是一位 DevOps 部署工程师。你精通持续集成、持续部署和云基础设施。你的核心职责是把代码高效、安全、稳定地交付到生产环境。在讨论中，你会优先关注：发布风险、回滚方案、监控告警、资源成本、环境一致性。',
        sales: '你是一位业绩驱动的销售专家。你擅长客户开发、需求挖掘和商务谈判。你的核心职责是把产品价值转化为客户订单，建立长期合作关系。在讨论中，你会优先关注：客户决策链、商务条款、成交周期、增购机会、竞品应对。',
        operations: '你是一位数据驱动的运营专家。你擅长用户增长、活动策划和内容运营。你的核心职责是用精细化运营手段提升用户留存和转化。在讨论中，你会优先关注：用户行为漏斗、ROI、留存指标、运营成本、可复用方法论。',
        resource_management: '你是一位细致的资源/项目管理专家。你擅长资源调度、进度跟踪和团队协作。你的核心职责是用最优的资源配置推动项目按时高质量交付。在讨论中，你会优先关注：关键路径、资源冲突、依赖关系、风险预案、可衡量里程碑。',
      };
      return defaults[key] || '';
    };

    return [
      {
        id: this.genId(),
        name: 'DeepSeek (OpenCode)',
        avatar: '\u{1F9E0}',
        color: '#4f46e5',
        aiModel: 'deepseek',
        channel: 'opencode_zen',
        apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
        apiKey: '',
        model: 'deepseek-v4-flash-free',
        role: 'development',
        rolePrompt: defaultPromptFor('development'),
        systemPrompt: '你是DeepSeek，一个聪明、有逻辑的AI助手。',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        ruleTemplate: 'strategic_advisor',
        ruleOptions: { ...baseRule },
        customRules: '',
      },
      {
        id: this.genId(),
        name: 'GLM-5 (OpenCode)',
        avatar: '\u{2728}',
        color: '#7c3aed',
        aiModel: 'glm',
        channel: 'opencode_zen',
        apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
        apiKey: '',
        model: 'glm-5-free',
        role: 'product',
        rolePrompt: defaultPromptFor('product'),
        systemPrompt: '你是智谱清言，智谱AI开发的助手。',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        ruleTemplate: 'strategic_advisor',
        ruleOptions: { ...baseRule },
        customRules: '',
      },
      {
        id: this.genId(),
        name: 'Kimi (OpenCode)',
        avatar: '\u{1F319}',
        color: '#2563eb',
        aiModel: 'kimi',
        channel: 'opencode_zen',
        apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
        apiKey: '',
        model: 'kimi-k2.5-free',
        role: 'market_insight',
        rolePrompt: defaultPromptFor('market_insight'),
        systemPrompt: '你是Kimi，月之暗面开发的AI助手。',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        ruleTemplate: 'strategic_advisor',
        ruleOptions: { ...baseRule },
        customRules: '',
      },
      {
        id: this.genId(),
        name: 'Grok (OpenCode)',
        avatar: '\u{26A1}',
        color: '#dc2626',
        aiModel: 'grok',
        channel: 'opencode_zen',
        apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
        apiKey: '',
        model: 'grok-code',
        role: 'operations',
        rolePrompt: defaultPromptFor('operations'),
        systemPrompt: 'You are Grok, a witty and helpful AI assistant.',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        ruleTemplate: 'strategic_advisor',
        ruleOptions: { ...baseRule },
        customRules: '',
      },
      {
        id: this.genId(),
        name: 'Claude (OpenCode)',
        avatar: '\u{1F3AD}',
        color: '#d97706',
        aiModel: 'claude',
        channel: 'opencode_zen',
        apiUrl: 'https://opencode.ai/zen/v1/chat/completions',
        apiKey: '',
        model: 'claude-sonnet-4-6',
        role: 'testing',
        rolePrompt: defaultPromptFor('testing'),
        systemPrompt: 'You are Claude, a thoughtful and thorough AI assistant.',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        ruleTemplate: 'strategic_advisor',
        ruleOptions: { ...baseRule },
        customRules: '',
      },
      {
        id: this.genId(),
        name: 'DeepSeek (官方)',
        avatar: '\u{1F9E0}',
        color: '#4f46e5',
        aiModel: 'deepseek',
        channel: 'official',
        apiUrl: 'https://api.deepseek.com/chat/completions',
        apiKey: '',
        model: 'deepseek-v4-flash',
        role: 'deployment',
        rolePrompt: defaultPromptFor('deployment'),
        systemPrompt: '你是DeepSeek，一个聪明、有逻辑的AI助手。',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        ruleTemplate: 'strategic_advisor',
        ruleOptions: { ...baseRule },
        customRules: '',
      },
      {
        id: this.genId(),
        name: 'WorkBuddy',
        avatar: '\u{1F916}',
        color: '#0052D9',
        aiModel: 'workbuddy',
        channel: 'tokenhub_cn',
        apiUrl: 'https://tokenhub.tencentcloudmaas.com/v1/chat/completions',
        apiKey: '',
        model: 'deepseek-v4-pro',
        role: 'custom',
        rolePrompt: '',
        systemPrompt: 'You are WorkBuddy, a powerful AI assistant by Tencent. You are helpful, knowledgeable, and versatile.',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        ruleTemplate: 'strategic_advisor',
        ruleOptions: { ...baseRule },
        customRules: '',
      },
    ];
  },

  genId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  load() {
    try {
      const saved = localStorage.getItem('ai-group-chat-data');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.data = { ...this.data, ...parsed };
        // Ensure all agents have rule fields (backward compat)
        this.data.agents.forEach(a => {
          if (!a.ruleOptions) {
            a.ruleOptions = {
              replyToAll: false, labelTarget: false, questionOthers: false,
              canAgree: true, seekConsensus: false, outputConsensus: false,
              simpleAnswer: true, noExpand: true, noRedissectConsensus: true,
            };
          }
          if (!a.ruleTemplate) a.ruleTemplate = 'custom';
          if (!a.customRules) a.customRules = '';
          if (!a.aiModel) a.aiModel = 'deepseek';
          if (!a.channel) a.channel = 'official';
          if (!a.role) a.role = 'custom';
          if (a.rolePrompt === undefined) a.rolePrompt = '';
        });
        // Ensure conversations have new fields
        this.data.conversations.forEach(c => {
          if (!c.replyOrder) c.replyOrder = [...c.memberAgentIds];
          if (!c.maxRounds) c.maxRounds = 0; // 0 = unlimited
          if (!c.discussionRound) c.discussionRound = 0;
          if (c.consensusReached === undefined) c.consensusReached = false; // v1.4.5+
          // Backfill round field on existing messages
          if (c.messages && c.messages.length > 0) {
            // We can't perfectly reconstruct rounds, so default old agent
            // messages to 0 so they're seen as "previous rounds" when the
            // first user message arrives in round 1.
            c.messages.forEach(m => {
              if (m.round === undefined) m.round = 0;
            });
          }
        });
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    }
  },

  save() {
    try {
      localStorage.setItem('ai-group-chat-data', JSON.stringify(this.data));
    } catch (e) {
      console.error('Failed to save data:', e);
    }
  },

  // ============ Config sync (QR code / file) ============

  // Build a config-only object (NO conversations / chat records)
  buildConfigObject() {
    return {
      v: 2,
      type: 'aigc-config',
      user: this.data.user,
      agents: this.data.agents.map(a => ({
        name: a.name,
        avatar: a.avatar,
        color: a.color,
        aiModel: a.aiModel,
        channel: a.channel,
        apiUrl: a.apiUrl,
        apiKey: a.apiKey,
        model: a.model,
        systemPrompt: a.systemPrompt,
        temperature: a.temperature,
        maxTokens: a.maxTokens,
        stream: a.stream,
        ruleTemplate: a.ruleTemplate,
        ruleOptions: a.ruleOptions,
        customRules: a.customRules,
      })),
      settings: this.data.settings,
    };
  },

  // Export config as a readable JSON string (for file download / import on other devices)
  exportConfigFile() {
    return JSON.stringify(this.buildConfigObject(), null, 2);
  },

  // Gzip + base64 (prefixed with 'G:') for QR code.
  // Falls back to raw base64 ('R:') if CompressionStream is unavailable.
  async exportConfigQr() {
    const json = JSON.stringify(this.buildConfigObject());
    if (typeof CompressionStream === 'undefined') {
      return 'R:' + btoa(unescape(encodeURIComponent(json)));
    }
    const gz = await this._gzip(json);
    return 'G:' + this._bytesToBase64(gz);
  },

  async _gzip(str) {
    const stream = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'));
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let len = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
  },

  _bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  },

  _base64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  async _gunzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const reader = stream.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let len = chunks.reduce((a, c) => a + c.length, 0);
    const out = new Uint8Array(len);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    const dec = new TextDecoder('utf-8');
    return dec.decode(out);
  },

  // Decode a config string from any supported source:
  //   'G:...'  gzip+base64 (new QR format)
  //   'R:...'  raw base64 (fallback QR format)
  //   plain JSON (file export)
  //   legacy raw base64 (old QR format)
  async _parseConfigInput(raw) {
    raw = (raw || '').trim();
    if (!raw) throw new Error('配置内容为空');

    if (raw.startsWith('G:')) {
      const bytes = this._base64ToBytes(raw.slice(2));
      const json = await this._gunzip(bytes);
      return JSON.parse(json);
    }
    if (raw.startsWith('R:')) {
      const json = decodeURIComponent(escape(atob(raw.slice(2))));
      return JSON.parse(json);
    }
    // plain JSON (file export)
    try {
      const o = JSON.parse(raw);
      if (o && (o.type === 'aigc-config' || Array.isArray(o.agents))) return o;
    } catch (e) { /* not plain JSON */ }
    // legacy raw base64 (old QR format)
    try {
      const json = decodeURIComponent(escape(atob(raw)));
      const o = JSON.parse(json);
      if (o && Array.isArray(o.agents)) return o;
    } catch (e) { /* not base64 */ }
    throw new Error('无法识别的配置格式');
  },

  // Import config from a string (QR / file). MERGE with existing agents —
  // does NOT clear conversations, so existing chats keep working.
  async importConfig(raw) {
    try {
      const config = await this._parseConfigInput(raw);
      if (!config.agents || !Array.isArray(config.agents)) {
        return { success: false, error: '配置数据格式无效（缺少 agents）' };
      }

      let added = 0, updated = 0;
      config.agents.forEach(imp => {
        if (!imp || !imp.name) return;
        const existing = this.data.agents.find(a =>
          a.apiUrl === imp.apiUrl &&
          (a.name === imp.name || (imp.apiKey && a.apiKey === imp.apiKey))
        );
        if (existing) {
          Object.assign(existing, imp); // keep existing id
          updated++;
        } else {
          this.data.agents.push({ id: this.genId(), ...imp });
          added++;
        }
      });

      if (config.user && typeof config.user === 'object') {
        this.data.user = { ...this.data.user, ...config.user };
      }
      if (config.settings && typeof config.settings === 'object') {
        this.data.settings = { ...this.data.settings, ...config.settings };
      }

      this.save();
      return { success: true, count: config.agents.length, added, updated };
    } catch (e) {
      return { success: false, error: '导入失败: ' + e.message };
    }
  },

  // ============ Agent methods ============
  getAgents() {
    return this.data.agents;
  },

  getAgent(id) {
    return this.data.agents.find(a => a.id === id);
  },

  addAgent(agent) {
    agent.id = this.genId();
    this.data.agents.push(agent);
    this.save();
    return agent;
  },

  updateAgent(id, updates) {
    const agent = this.getAgent(id);
    if (agent) {
      Object.assign(agent, updates);
      this.save();
    }
    return agent;
  },

  deleteAgent(id) {
    this.data.agents = this.data.agents.filter(a => a.id !== id);
    // Remove from conversations
    this.data.conversations.forEach(conv => {
      conv.memberAgentIds = conv.memberAgentIds.filter(aid => aid !== id);
      if (conv.replyOrder) {
        conv.replyOrder = conv.replyOrder.filter(aid => aid !== id);
      }
    });
    // Remove conversations with no members
    this.data.conversations = this.data.conversations.filter(c => c.memberAgentIds.length > 0);
    if (this.data.activeConversationId && !this.getConversation(this.data.activeConversationId)) {
      this.data.activeConversationId = null;
    }
    this.save();
  },

  // ============ Conversation methods ============
  getConversations() {
    return this.data.conversations.sort((a, b) => {
      const aTime = a.lastMessageTime || a.createdAt || 0;
      const bTime = b.lastMessageTime || b.createdAt || 0;
      return bTime - aTime;
    });
  },

  getConversation(id) {
    return this.data.conversations.find(c => c.id === id);
  },

  createSingleChat(agentId) {
    const agent = this.getAgent(agentId);
    if (!agent) return null;
    const conv = {
      id: this.genId(),
      type: 'single',
      name: agent.name,
      avatar: agent.avatar,
      avatarColor: agent.color,
      memberAgentIds: [agentId],
      replyOrder: [agentId],
      topic: '',
      maxRounds: 0,
      discussionRound: 0,
      messages: [],
      attachments: [], // 会话级参考资料：文档/代码，注入给所有 AI 成员作为上下文
      createdAt: Date.now(),
      lastMessage: '',
      lastMessageTime: Date.now(),
    };
    this.data.conversations.push(conv);
    this.data.activeConversationId = conv.id;
    this.save();
    return conv;
  },

  createGroupChat(name, avatar, topic, agentIds, replyOrder, maxRounds) {
    const conv = {
      id: this.genId(),
      type: 'group',
      name: name || 'AI 群聊',
      avatar: avatar || '\u{1F465}',
      avatarColor: '#6b7280',
      memberAgentIds: agentIds,
      replyOrder: replyOrder || agentIds,
      topic: topic || '',
      maxRounds: maxRounds || 0,
      discussionRound: 0,
      // 共识标记：达成共识后停止自动讨论，等待用户抛新话题
      consensusReached: false,
      messages: [],
      attachments: [], // 会话级参考资料：文档/代码，注入给所有 AI 成员作为上下文
      createdAt: Date.now(),
      lastMessage: '',
      lastMessageTime: Date.now(),
    };
    this.data.conversations.push(conv);
    this.data.activeConversationId = conv.id;
    this.save();
    return conv;
  },

  deleteConversation(id) {
    this.data.conversations = this.data.conversations.filter(c => c.id !== id);
    if (this.data.activeConversationId === id) {
      this.data.activeConversationId = null;
    }
    this.save();
  },

  // 群聊进行中随时添加成员（微信式）
  addGroupMember(convId, agentId) {
    const conv = this.getConversation(convId);
    if (!conv || conv.type !== 'group') return false;
    if (!conv.memberAgentIds.includes(agentId)) {
      conv.memberAgentIds.push(agentId);
      if (!conv.replyOrder.includes(agentId)) conv.replyOrder.push(agentId);
      this.save();
    }
    return true;
  },

  // 群聊进行中随时移除成员（微信式踢人）
  removeGroupMember(convId, agentId) {
    const conv = this.getConversation(convId);
    if (!conv || conv.type !== 'group') return false;
    conv.memberAgentIds = conv.memberAgentIds.filter(id => id !== agentId);
    conv.replyOrder = (conv.replyOrder || []).filter(id => id !== agentId);
    this.save();
    return true;
  },

  // 会话级参考资料（文档/代码）：添加
  addAttachment(convId, att) {
    const conv = this.getConversation(convId);
    if (!conv) return false;
    if (!Array.isArray(conv.attachments)) conv.attachments = [];
    conv.attachments.push(att);
    this.save();
    return true;
  },

  // 会话级参考资料：移除
  removeAttachment(convId, attId) {
    const conv = this.getConversation(convId);
    if (!conv || !Array.isArray(conv.attachments)) return false;
    conv.attachments = conv.attachments.filter(a => a.id !== attId);
    this.save();
    return true;
  },

  addMessage(convId, message) {
    const conv = this.getConversation(convId);
    if (!conv) return;
    message.id = this.genId();
    message.timestamp = message.timestamp || Date.now();
    // Tag the message with the current discussion round so buildMessages
    // can filter "this round" vs "previous rounds" for proper debate flow.
    if (message.round === undefined) {
      message.round = conv.discussionRound || 0;
    }
    conv.messages.push(message);
    conv.lastMessage = message.content.substring(0, 50);
    conv.lastMessageTime = message.timestamp;
    this.save();
  },

  updateMessage(convId, msgId, updates) {
    const conv = this.getConversation(convId);
    if (!conv) return;
    const msg = conv.messages.find(m => m.id === msgId);
    if (msg) {
      Object.assign(msg, updates);
      this.save();
    }
  },

  removeMessage(convId, msgId) {
    const conv = this.getConversation(convId);
    if (!conv) return;
    conv.messages = conv.messages.filter(m => m.id !== msgId);
    this.save();
  },

  clearMessages(convId) {
    const conv = this.getConversation(convId);
    if (!conv) return;
    conv.messages = [];
    conv.discussionRound = 0;
    conv.lastMessage = '';
    this.save();
  },

  setActiveConversation(id) {
    this.data.activeConversationId = id;
    this.save();
  },

  // ============ Settings ============
  getSettings() {
    return this.data.settings;
  },

  updateSettings(updates) {
    Object.assign(this.data.settings, updates);
    this.save();
  },

  getUser() {
    return this.data.user;
  },

  updateUser(updates) {
    Object.assign(this.data.user, updates);
    this.save();
  },

  // ============ Export/Import ============
  exportData() {
    return JSON.stringify(this.data, null, 2);
  },

  clearAllData() {
    this.data.agents = this.getDefaultAgents();
    this.data.conversations = [];
    this.data.activeConversationId = null;
    this.save();
  },
};
