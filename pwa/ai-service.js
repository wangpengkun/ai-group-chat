// ============ AI Service: Unified API for multiple AI providers ============

const AIService = {
// ============ Provider Matrix (v1.4.5 接入方式优先的级联选择) ============
// 结构：channels[channel_key] -> { label, baseUrl, models[model_key] -> {...} }
// 用户先选接入方式（channel），再选 AI 模型（model），符合接入方式驱动的实际心智
//
// ⚠️ 历史数据兼容：旧版数据存的是 aiModel='deepseek', channel='opencode_go'
// 用 lookupLegacy(aiModel, channel) 来找到对应的新模型 key
providerMatrix: {
  // ============== 接入方式字典 ==============
  channels: {
    // 1) 官网直连 —— 各家厂商的官方 API，每个模型走自己的端点
    official: {
      label: '官网直连',
      keyHint: '',
      keyPlaceholder: 'sk-...',
      badge: '',
      baseUrl: '', // 官网直连每家不同，不设默认
      models: {
        deepseek_v4_flash: { name: 'DeepSeek', model: 'deepseek-v4-flash', apiUrl: 'https://api.deepseek.com/chat/completions', avatar: '\u{1F9E0}', color: '#4f46e5', keyHint: '在 platform.deepseek.com 获取', keyPlaceholder: 'sk-...', systemPrompt: '你是DeepSeek，一个聪明、有逻辑的AI助手。' },
        deepseek_v4_pro:  { name: 'DeepSeek Pro', model: 'deepseek-v4-pro',  apiUrl: 'https://api.deepseek.com/chat/completions', avatar: '\u{1F9E0}', color: '#4f46e5', keyHint: '在 platform.deepseek.com 获取', keyPlaceholder: 'sk-...', systemPrompt: '你是DeepSeek Pro，具备更强推理能力。' },
        gpt_4o_mini:       { name: 'ChatGPT (GPT-4o mini)', model: 'gpt-4o-mini', apiUrl: 'https://api.openai.com/v1/chat/completions', avatar: '\u{1F7E2}', color: '#059669', keyHint: '在 platform.openai.com 获取', keyPlaceholder: 'sk-...', systemPrompt: 'You are a helpful assistant.' },
        gpt_4o:            { name: 'ChatGPT (GPT-4o)',      model: 'gpt-4o',      apiUrl: 'https://api.openai.com/v1/chat/completions', avatar: '\u{1F7E2}', color: '#059669', keyHint: '在 platform.openai.com 获取', keyPlaceholder: 'sk-...', systemPrompt: 'You are a helpful assistant.' },
        kimi_moonshot:     { name: 'Kimi (月之暗面)',         model: 'moonshot-v1-8k', apiUrl: 'https://api.moonshot.cn/v1/chat/completions', avatar: '\u{1F319}', color: '#2563eb', keyHint: '在 platform.moonshot.cn 获取', keyPlaceholder: 'sk-...', systemPrompt: '你是Kimi，月之暗面开发的AI助手。' },
        glm_5_flash:       { name: '智谱GLM-5 Flash',         model: 'glm-5-flash', apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', avatar: '\u{2728}', color: '#7c3aed', keyHint: '在 open.bigmodel.cn 获取', keyPlaceholder: '...', systemPrompt: '你是智谱清言，智谱AI开发的助手。' },
        qwen_plus:         { name: '通义千问 (Qwen-Plus)',    model: 'qwen-plus',  apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', avatar: '\u{1F52E}', color: '#db2777', keyHint: '在 dashscope.aliyun.com 获取', keyPlaceholder: 'sk-...', systemPrompt: '你是通义千问，阿里云开发的AI助手。' },
        doubao_pro:        { name: '豆包 (Doubao-Pro)',       model: 'doubao-pro-32k', apiUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions', avatar: '\u{1FAB8}', color: '#d97706', keyHint: '在 volcengine.com 获取', keyPlaceholder: '...', systemPrompt: '你是豆包，字节跳动开发的AI助手。' },
        gemini_pro:        { name: 'Gemini (Google AI)',      model: 'gemini-2.0-flash', apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', avatar: '\u{1F48E}', color: '#0891b2', keyHint: '在 aistudio.google.com 获取', keyPlaceholder: 'AIza...', systemPrompt: 'You are Gemini, a helpful and versatile AI assistant.' },
        grok_3_mini:       { name: 'Grok (xAI)',              model: 'grok-3-mini', apiUrl: 'https://api.x.ai/v1/chat/completions', avatar: '\u26A1', color: '#dc2626', keyHint: '在 console.x.ai 获取', keyPlaceholder: 'xai-...', systemPrompt: 'You are Grok, a witty and helpful AI assistant.' },
      },
    },

    // 2) OpenCode Zen — 全量精选模型目录（来自官方 /v1/models，66 个）
    // 协议分流：GPT→/responses；Claude/Qwen3→/messages；Gemini→/models/<id>；其余→/chat/completions
    openzen: {
      label: 'openZen',
      keyHint: '在 opencode.ai/auth 获取（注册即送免费额度，按量付费可用全部模型）',
      keyPlaceholder: 'opencode的Key',
      badge: '付费+免费',
      baseUrl: 'https://opencode.ai/zen/v1/chat/completions',
      models: {
        claude_fable_5: { name: 'Claude Fable 5', model: 'claude-fable-5', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Fable 5，最新的 Claude 系列实验模型。' },
        claude_opus_5: { name: 'Claude Opus 5', model: 'claude-opus-5', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Opus 5，Anthropic 旗舰模型。' },
        claude_opus_4_8: { name: 'Claude Opus 4.8', model: 'claude-opus-4-8', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Opus 4.8，Anthropic 顶级模型。' },
        claude_opus_4_7: { name: 'Claude Opus 4.7', model: 'claude-opus-4-7', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Opus 4.7。' },
        claude_opus_4_6: { name: 'Claude Opus 4.6', model: 'claude-opus-4-6', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Opus 4.6。' },
        claude_opus_4_5: { name: 'Claude Opus 4.5', model: 'claude-opus-4-5', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Opus 4.5。' },
        claude_sonnet_5: { name: 'Claude Sonnet 5', model: 'claude-sonnet-5', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Sonnet 5，平衡的助手。' },
        claude_sonnet_4_6: { name: 'Claude Sonnet 4.6', model: 'claude-sonnet-4-6', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Sonnet 4.6。' },
        claude_sonnet_4_5: { name: 'Claude Sonnet 4.5', model: 'claude-sonnet-4-5', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Sonnet 4.5。' },
        claude_sonnet_4: { name: 'Claude Sonnet 4', model: 'claude-sonnet-4', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Sonnet 4。' },
        claude_haiku_4_5: { name: 'Claude Haiku 4.5', model: 'claude-haiku-4-5', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🎭', color: '#d97706', systemPrompt: '你是 Claude Haiku 4.5，快速助手。' },
        gemini_3_6_flash: { name: 'Gemini 3.6 Flash', model: 'gemini-3.6-flash', apiUrl: 'https://opencode.ai/zen/v1/models/gemini-3.6-flash', avatar: '💎', color: '#0891b2', systemPrompt: 'You are gemini-3.6-flash, a helpful Google Gemini assistant.' },
        gemini_3_7_flash: { name: 'Gemini 3.7 Flash', model: 'gemini-3.7-flash', apiUrl: 'https://opencode.ai/zen/v1/models/gemini-3.7-flash', avatar: '💎', color: '#0891b2', systemPrompt: 'You are gemini-3.7-flash, a helpful Google Gemini assistant.' },
        gemini_3_5_flash_lite: { name: 'Gemini 3.5 Flash Lite', model: 'gemini-3.5-flash-lite', apiUrl: 'https://opencode.ai/zen/v1/models/gemini-3.5-flash-lite', avatar: '💎', color: '#0891b2', systemPrompt: 'You are gemini-3.5-flash-lite, a helpful Google Gemini assistant.' },
        gemini_3_5_flash: { name: 'Gemini 3.5 Flash', model: 'gemini-3.5-flash', apiUrl: 'https://opencode.ai/zen/v1/models/gemini-3.5-flash', avatar: '💎', color: '#0891b2', systemPrompt: 'You are gemini-3.5-flash, a helpful Google Gemini assistant.' },
        gemini_3_1_pro: { name: 'Gemini 3.1 Pro', model: 'gemini-3.1-pro', apiUrl: 'https://opencode.ai/zen/v1/models/gemini-3.1-pro', avatar: '💎', color: '#0891b2', systemPrompt: 'You are gemini-3.1-pro, a helpful Google Gemini assistant.' },
        gemini_3_flash: { name: 'Gemini 3 Flash', model: 'gemini-3-flash', apiUrl: 'https://opencode.ai/zen/v1/models/gemini-3-flash', avatar: '💎', color: '#0891b2', systemPrompt: 'You are gemini-3-flash, a helpful Google Gemini assistant.' },
        gpt_5_6_sol: { name: 'GPT 5.6 Sol', model: 'gpt-5.6-sol', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.6 Sol, a helpful AI assistant.' },
        gpt_5_6_terra: { name: 'GPT 5.6 Terra', model: 'gpt-5.6-terra', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.6 Terra, a helpful AI assistant.' },
        gpt_5_6_luna: { name: 'GPT 5.6 Luna', model: 'gpt-5.6-luna', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.6 Luna, a helpful AI assistant.' },
        gpt_5_5: { name: 'GPT 5.5', model: 'gpt-5.5', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.5, a helpful AI assistant.' },
        gpt_5_5_pro: { name: 'GPT 5.5 Pro', model: 'gpt-5.5-pro', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.5 Pro, a helpful AI assistant.' },
        gpt_5_4: { name: 'GPT 5.4', model: 'gpt-5.4', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.4, a helpful AI assistant.' },
        gpt_5_4_pro: { name: 'GPT 5.4 Pro', model: 'gpt-5.4-pro', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.4 Pro, a helpful AI assistant.' },
        gpt_5_4_mini: { name: 'GPT 5.4 Mini', model: 'gpt-5.4-mini', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.4 Mini, a helpful AI assistant.' },
        gpt_5_4_nano: { name: 'GPT 5.4 Nano', model: 'gpt-5.4-nano', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.4 Nano, a helpful AI assistant.' },
        gpt_5_3_codex_spark: { name: 'GPT 5.3 Codex Spark', model: 'gpt-5.3-codex-spark', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.3 Codex Spark, a helpful AI assistant.' },
        gpt_5_3_codex: { name: 'GPT 5.3 Codex', model: 'gpt-5.3-codex', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.3 Codex, a helpful AI assistant.' },
        gpt_5_2: { name: 'GPT 5.2', model: 'gpt-5.2', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.2, a helpful AI assistant.' },
        gpt_5_2_codex: { name: 'GPT 5.2 Codex', model: 'gpt-5.2-codex', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.2 Codex, a helpful AI assistant.' },
        gpt_5_1: { name: 'GPT 5.1', model: 'gpt-5.1', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.1, a helpful AI assistant.' },
        gpt_5_1_codex_max: { name: 'GPT 5.1 Codex Max', model: 'gpt-5.1-codex-max', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.1 Codex Max, a helpful AI assistant.' },
        gpt_5_1_codex: { name: 'GPT 5.1 Codex', model: 'gpt-5.1-codex', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.1 Codex, a helpful AI assistant.' },
        gpt_5_1_codex_mini: { name: 'GPT 5.1 Codex Mini', model: 'gpt-5.1-codex-mini', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.1 Codex Mini, a helpful AI assistant.' },
        gpt_5: { name: 'GPT 5', model: 'gpt-5', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5, a helpful AI assistant.' },
        gpt_5_codex: { name: 'GPT 5 Codex', model: 'gpt-5-codex', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5 Codex, a helpful AI assistant.' },
        gpt_5_nano: { name: 'GPT 5 Nano', model: 'gpt-5-nano', apiUrl: 'https://opencode.ai/zen/v1/responses', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5 Nano, a helpful AI assistant.' },
        grok_build_0_1: { name: 'Grok Build 0.1', model: 'grok-build-0.1', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '⚡', color: '#dc2626', systemPrompt: 'You are Grok Build 0.1, a witty helpful assistant.' },
        grok_4_6: { name: 'Grok 4.6', model: 'grok-4.6', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '⚡', color: '#dc2626', systemPrompt: 'You are Grok 4.6, a witty helpful assistant.' },
        grok_4_5: { name: 'Grok 4.5', model: 'grok-4.5', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '⚡', color: '#dc2626', systemPrompt: 'You are Grok 4.5, a witty helpful assistant.' },
        muse_spark_1_2: { name: 'Muse Spark 1.2', model: 'muse-spark-1.2', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '💠', color: '#10b981', systemPrompt: '你是 Muse Spark 1.2。' },
        deepseek_v4_pro: { name: 'DeepSeek V4 Pro', model: 'deepseek-v4-pro', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🧠', color: '#4f46e5', systemPrompt: '你是 DeepSeek V4 Pro，具备强推理能力。' },
        deepseek_v4_flash: { name: 'DeepSeek V4 Flash', model: 'deepseek-v4-flash', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🧠', color: '#4f46e5', systemPrompt: '你是 DeepSeek V4 Flash。' },
        glm_5_2: { name: '智谱 GLM-5.2', model: 'glm-5.2', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '✨', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.2。' },
        glm_5_1: { name: '智谱 GLM-5.1', model: 'glm-5.1', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '✨', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.1。' },
        glm_5: { name: '智谱 GLM-5', model: 'glm-5', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '✨', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5。' },
        minimax_m3: { name: 'MiniMax M3', model: 'minimax-m3', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🌊', color: '#0052D9', systemPrompt: '你是 MiniMax M3。' },
        minimax_m2_7: { name: 'MiniMax M2.7', model: 'minimax-m2.7', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🌊', color: '#0052D9', systemPrompt: '你是 MiniMax M2.7。' },
        minimax_m2_5: { name: 'MiniMax M2.5', model: 'minimax-m2.5', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🌊', color: '#0052D9', systemPrompt: '你是 MiniMax M2.5。' },
        kimi_k3: { name: 'Kimi K3', model: 'kimi-k3', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🌙', color: '#2563eb', systemPrompt: '你是 Kimi K3，月之暗面最新旗舰。' },
        kimi_k2_7_code: { name: 'Kimi K2.7 Code', model: 'kimi-k2.7-code', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🌙', color: '#2563eb', systemPrompt: '你是 Kimi K2.7 Code，专精代码。' },
        kimi_k2_6: { name: 'Kimi K2.6', model: 'kimi-k2.6', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🌙', color: '#2563eb', systemPrompt: '你是 Kimi K2.6。' },
        kimi_k2_5: { name: 'Kimi K2.5', model: 'kimi-k2.5', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🌙', color: '#2563eb', systemPrompt: '你是 Kimi K2.5。' },
        qwen3_6_plus: { name: 'Qwen3.6 Plus', model: 'qwen3.6-plus', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🔮', color: '#db2777', systemPrompt: '你是通义千问 Qwen3.6 Plus。' },
        qwen3_5_plus: { name: 'Qwen3.5 Plus', model: 'qwen3.5-plus', apiUrl: 'https://opencode.ai/zen/v1/messages', avatar: '🔮', color: '#db2777', systemPrompt: '你是通义千问 Qwen3.5 Plus。' },
        big_pickle: { name: 'Big Pickle', model: 'big-pickle', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🥒', color: '#a16207', systemPrompt: 'You are Big Pickle.' },
        deepseek_v4_flash_free: { name: 'DeepSeek V4 Flash (免费)', model: 'deepseek-v4-flash-free', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🧠', color: '#4f46e5', systemPrompt: '你是 DeepSeek V4 Flash 免费层。' },
        mimo_v2_5_free: { name: 'MiMo-V2.5 (免费)', model: 'mimo-v2.5-free', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🪸', color: '#d97706', systemPrompt: '你是 MiMo V2.5 免费版。' },
        hy3_free: { name: 'Hy3 (免费)', model: 'hy3-free', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '💫', color: '#0891b2', systemPrompt: 'You are Hy3 Free.' },
        nemotron_3_ultra_free: { name: 'Nemotron 3 Ultra (免费)', model: 'nemotron-3-ultra-free', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🧪', color: '#8b5cf6', systemPrompt: 'You are Nemotron 3 Ultra Free.' },
        nemotron_3_5_lightning_free: { name: 'Nemotron 3.5 Lightning (免费)', model: 'nemotron-3.5-lightning-free', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '⚡', color: '#eab308', systemPrompt: 'You are Nemotron 3.5 Lightning Free.' },
        laguna_s_2_1_free: { name: 'Laguna S 2.1 (免费)', model: 'laguna-s-2.1-free', apiUrl: 'https://opencode.ai/zen/v1/chat/completions', avatar: '🌊', color: '#0ea5e9', systemPrompt: 'You are Laguna S 2.1 Free.' },
      },
    },

    // 3) OpenCode Go — $5/月订阅档精选目录（来自官方 /v1/models，25 个）
    // 协议分流：MiniMax + Qwen3 全家→/messages；其余→/chat/completions
    opencode_go: {
      label: 'openCode-go',
      keyHint: '需订阅 OpenCode GO ($5/月)，在 opencode.ai/auth 获取',
      keyPlaceholder: 'opencode的Key',
      badge: '订阅',
      baseUrl: 'https://opencode.ai/zen/go/v1/chat/completions',
      // 每模型可单独覆盖 apiUrl（部分模型走 /messages）
      models: {
        minimax_m3: { name: 'MiniMax M3', model: 'minimax-m3', apiUrl: 'https://opencode.ai/zen/go/v1/messages', avatar: '🌊', color: '#0052D9', systemPrompt: '你是 MiniMax M3，最新 MiniMax 模型。' },
        minimax_m2_7: { name: 'MiniMax M2.7', model: 'minimax-m2.7', apiUrl: 'https://opencode.ai/zen/go/v1/messages', avatar: '🌊', color: '#0052D9', systemPrompt: '你是 MiniMax M2.7。' },
        minimax_m2_5: { name: 'MiniMax M2.5', model: 'minimax-m2.5', apiUrl: 'https://opencode.ai/zen/go/v1/messages', avatar: '🌊', color: '#0052D9', systemPrompt: '你是 MiniMax M2.5。' },
        qwen3_8_max: { name: 'Qwen3.8 Max', model: 'qwen3.8-max', apiUrl: 'https://opencode.ai/zen/go/v1/messages', avatar: '🔮', color: '#db2777', systemPrompt: '你是通义千问 Qwen3.8 Max。' },
        qwen3_7_max: { name: 'Qwen3.7 Max', model: 'qwen3.7-max', apiUrl: 'https://opencode.ai/zen/go/v1/messages', avatar: '🔮', color: '#db2777', systemPrompt: '你是通义千问 Qwen3.7 Max。' },
        qwen3_7_plus: { name: 'Qwen3.7 Plus', model: 'qwen3.7-plus', apiUrl: 'https://opencode.ai/zen/go/v1/messages', avatar: '🔮', color: '#db2777', systemPrompt: '你是通义千问 Qwen3.7 Plus。' },
        qwen3_6_plus: { name: 'Qwen3.6 Plus', model: 'qwen3.6-plus', apiUrl: 'https://opencode.ai/zen/go/v1/messages', avatar: '🔮', color: '#db2777', systemPrompt: '你是通义千问 Qwen3.6 Plus。' },
        qwen3_5_plus: { name: 'Qwen3.5 Plus', model: 'qwen3.5-plus', apiUrl: 'https://opencode.ai/zen/go/v1/messages', avatar: '🔮', color: '#db2777', systemPrompt: '你是通义千问 Qwen3.5 Plus。' },
        kimi_k3: { name: 'Kimi K3', model: 'kimi-k3', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🌙', color: '#2563eb', systemPrompt: '你是 Kimi K3。' },
        kimi_k2_7_code: { name: 'Kimi K2.7 Code', model: 'kimi-k2.7-code', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🌙', color: '#2563eb', systemPrompt: '你是 Kimi K2.7 Code，专精代码。' },
        kimi_k2_6: { name: 'Kimi K2.6', model: 'kimi-k2.6', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🌙', color: '#2563eb', systemPrompt: '你是 Kimi K2.6。' },
        kimi_k2_5: { name: 'Kimi K2.5', model: 'kimi-k2.5', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🌙', color: '#2563eb', systemPrompt: '你是 Kimi K2.5。' },
        glm_5_3: { name: '智谱 GLM-5.3', model: 'glm-5.3', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '✨', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.3。' },
        glm_5_2: { name: '智谱 GLM-5.2', model: 'glm-5.2', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '✨', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.2。' },
        glm_5_1: { name: '智谱 GLM-5.1', model: 'glm-5.1', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '✨', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.1。' },
        glm_5: { name: '智谱 GLM-5', model: 'glm-5', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '✨', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5。' },
        deepseek_v4_pro: { name: 'DeepSeek V4 Pro', model: 'deepseek-v4-pro', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🧠', color: '#4f46e5', systemPrompt: '你是 DeepSeek V4 Pro。' },
        deepseek_v4_flash: { name: 'DeepSeek V4 Flash', model: 'deepseek-v4-flash', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🧠', color: '#4f46e5', systemPrompt: '你是 DeepSeek V4 Flash。' },
        mimo_v2_pro: { name: 'MiMo V2 Pro', model: 'mimo-v2-pro', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🪸', color: '#d97706', systemPrompt: '你是 MiMo V2 Pro。' },
        mimo_v2_omni: { name: 'MiMo V2 Omni', model: 'mimo-v2-omni', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🪸', color: '#d97706', systemPrompt: '你是 MiMo V2 Omni。' },
        mimo_v2_5_pro: { name: 'MiMo V2.5 Pro', model: 'mimo-v2.5-pro', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🪸', color: '#d97706', systemPrompt: '你是 MiMo V2.5 Pro。' },
        mimo_v2_5: { name: 'MiMo V2.5', model: 'mimo-v2.5', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🪸', color: '#d97706', systemPrompt: '你是 MiMo V2.5。' },
        hy3: { name: 'Hy3', model: 'hy3', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '💫', color: '#0891b2', systemPrompt: 'You are Hy3.' },
        hy3_preview: { name: 'Hy3 Preview', model: 'hy3-preview', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '💫', color: '#0891b2', systemPrompt: 'You are Hy3 Preview.' },
        gpt_5_6_luna: { name: 'GPT 5.6 Luna', model: 'gpt-5.6-luna', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '🟢', color: '#059669', systemPrompt: 'You are GPT 5.6 Luna, a helpful AI assistant.' },
        grok_4_5: { name: 'Grok 4.5', model: 'grok-4.5', apiUrl: 'https://opencode.ai/zen/go/v1/chat/completions', avatar: '⚡', color: '#dc2626', systemPrompt: 'You are Grok 4.5.' },
      },
    },

    // 4) OpenRouter —— 涵盖 opencode-go + workbuddy + tokenhub 的所有模型（通过 OpenRouter 统一访问）
    openrouter: {
      label: 'OpenRouter',
      keyHint: '在 openrouter.ai/keys 获取',
      keyPlaceholder: 'sk-or-v1-...',
      badge: '订阅',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      models: {
        openai_gpt_5_6_luna:  { name: 'GPT 5.6 Luna (OpenRouter)', model: 'openai/gpt-5.6-luna', apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F7E2}', color: '#059669', systemPrompt: 'You are ChatGPT.' },
        openai_gpt_5:         { name: 'GPT 5 (OpenRouter)',        model: 'openai/gpt-5',        apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F7E2}', color: '#059669', systemPrompt: 'You are ChatGPT.' },
        anthropic_claude_sonnet_4_6: { name: 'Claude Sonnet 4.6 (OpenRouter)', model: 'anthropic/claude-sonnet-4.6', apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F3AD}', color: '#d97706', systemPrompt: 'You are Claude Sonnet.' },
        anthropic_claude_opus_4_7:   { name: 'Claude Opus 4.7 (OpenRouter)',   model: 'anthropic/claude-opus-4.7',   apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F3AD}', color: '#d97706', systemPrompt: 'You are Claude Opus.' },
        google_gemini_3_4_flash:      { name: 'Gemini 3.4 Flash (OpenRouter)',  model: 'google/gemini-3.4-flash',    apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F48E}', color: '#0891b2', systemPrompt: 'You are Gemini.' },
        xai_grok_4_5:                { name: 'Grok 4.5 (OpenRouter)',          model: 'xai/grok-4.5',              apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u26A1', color: '#dc2626', systemPrompt: 'You are Grok.' },
        moonshot_kimi_k3:            { name: 'Kimi K3 (OpenRouter)',           model: 'moonshot/kimi-k3',          apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi K3。' },
        moonshot_kimi_k2_7_code:     { name: 'Kimi K2.7 Code (OpenRouter)',    model: 'moonshot/kimi-k2.7-code',   apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi K2.7 Code。' },
        moonshot_kimi_k2_6:          { name: 'Kimi K2.6 (OpenRouter)',         model: 'moonshot/kimi-k2.6',        apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi K2.6。' },
        zhipuai_glm_5_3:             { name: '智谱GLM-5.3 (OpenRouter)',        model: 'zhipuai/glm-5.3',          apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{2728}', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.3。' },
        deepseek_v4_pro:             { name: 'DeepSeek V4 Pro (OpenRouter)',    model: 'deepseek-v4-pro',          apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F9E0}', color: '#4f46e5', systemPrompt: '你是 DeepSeek V4 Pro。' },
        deepseek_v4_flash:           { name: 'DeepSeek V4 Flash (OpenRouter)',  model: 'deepseek-v4-flash',        apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F9E0}', color: '#4f46e5', systemPrompt: '你是 DeepSeek V4 Flash。' },
        minimax_m3:                  { name: 'MiniMax M3 (OpenRouter)',          model: 'minimax/m3',              apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F30A}', color: '#0052D9', systemPrompt: '你是 MiniMax M3。' },
        qwen3_8_plus:                { name: 'Qwen3.8 Plus (OpenRouter)',        model: 'qwen/qwen3-8-plus',       apiUrl: 'https://openrouter.ai/api/v1/chat/completions', avatar: '\u{1F52E}', color: '#db2777', systemPrompt: '你是通义千问 Qwen3.8 Plus。' },
      },
    },

    // 5) WorkBuddy —— WorkBuddy 官方模型列表（图片 3）
    workbuddy: {
      label: 'WorkBuddy',
      keyHint: 'WorkBuddy 官方网关。在 WorkBuddy 客户端「个人中心 → API 设置」生成（实际后端走 TokenHub 通道）。',
      keyPlaceholder: 'wb-...（或 ck-...）',
      badge: '已付费',
      baseUrl: 'https://workbuddy.tencent.com/v1/chat/completions',
      models: {
        wb_hy3:             { name: 'Hy3 (限时免费)',           model: 'workbuddy/hy3',              avatar: '\u{1F4AB}', color: '#0891b2', systemPrompt: '你是 Hy3，WorkBuddy 限时免费模型。', badge: '免费' },
        wb_glm_5v_turbo:    { name: 'GLM-5v-Turbo',            model: 'workbuddy/glm-5v-turbo',     avatar: '\u{2728}', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5v-Turbo。' },
        wb_glm_5_2:         { name: 'GLM-5.2 (夜间折扣)',     model: 'workbuddy/glm-5.2',          avatar: '\u{2728}', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.2。' },
        wb_glm_5_1:         { name: 'GLM-5.1',                 model: 'workbuddy/glm-5.1',          avatar: '\u{2728}', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.1。' },
        wb_minimax_m3:      { name: 'MiniMax-M3',              model: 'workbuddy/minimax-m3',       avatar: '\u{1F30A}', color: '#0052D9', systemPrompt: '你是 MiniMax-M3。' },
        wb_kimi_k3:         { name: 'Kimi-K3',                 model: 'workbuddy/kimi-k3',          avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi-K3。' },
        wb_kimi_k2_7_code:  { name: 'Kimi-K2.7-Code',          model: 'workbuddy/kimi-k2.7-code',   avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi-K2.7-Code。' },
        wb_kimi_k2_6:       { name: 'Kimi-K2.6',               model: 'workbuddy/kimi-k2.6',        avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi-K2.6。' },
        wb_deepseek_v4_flash:{ name: 'Deepseek-V4-Flash',      model: 'workbuddy/deepseek-v4-flash',avatar: '\u{1F9E0}', color: '#4f46e5', systemPrompt: '你是 Deepseek-V4-Flash。' },
        wb_deepseek_v4_pro: { name: 'Deepseek-V4-Pro',         model: 'workbuddy/deepseek-v4-pro',  avatar: '\u{1F9E0}', color: '#4f46e5', systemPrompt: '你是 Deepseek-V4-Pro。' },
      },
    },

    // 6a) TokenHub (国内) —— 腾讯云大模型服务平台，按真实模型名调用
    tokenhub_cn: {
      label: 'TokenHub (国内)',
      keyHint: '在腾讯云控制台 → 大模型服务平台 TokenHub → Token Plan → API Key 创建（key 格式 ck_xxxx）。模型名必须是真实模型名。',
      keyPlaceholder: 'ck-...',
      badge: '已付费',
      baseUrl: 'https://tokenhub.tencentcloudmaas.com/v1/chat/completions',
      models: {
        th_deepseek_v4_pro:   { name: 'DeepSeek V4 Pro',   model: 'deepseek-v4-pro',   avatar: '\u{1F9E0}', color: '#4f46e5', systemPrompt: '你是DeepSeek V4 Pro。' },
        th_deepseek_v4_flash: { name: 'DeepSeek V4 Flash', model: 'deepseek-v4-flash', avatar: '\u{1F9E0}', color: '#4f46e5', systemPrompt: '你是DeepSeek V4 Flash。' },
        th_glm_5_2:           { name: 'GLM-5.2',           model: 'glm-5.2',           avatar: '\u{2728}', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.2。' },
        th_glm_5_1:           { name: 'GLM-5.1',           model: 'glm-5.1',           avatar: '\u{2728}', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.1。' },
        th_kimi_k2_6:         { name: 'Kimi K2.6',         model: 'kimi-k2.6',         avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi K2.6。' },
        th_kimi_k2_7_code:    { name: 'Kimi K2.7 Code',    model: 'kimi-k2.7-code',    avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi K2.7 Code。' },
        th_minimax_m3:        { name: 'MiniMax M3',        model: 'minimax-m3',        avatar: '\u{1F30A}', color: '#0052D9', systemPrompt: '你是 MiniMax M3。' },
        th_minimax_m2_7:      { name: 'MiniMax M2.7',      model: 'minimax-m2.7',      avatar: '\u{1F30A}', color: '#0052D9', systemPrompt: '你是 MiniMax M2.7。' },
        th_hy3:               { name: 'Hy3 (限时免费)',   model: 'hy3',                avatar: '\u{1F4AB}', color: '#0891b2', systemPrompt: '你是 Hy3。', badge: '免费' },
      },
    },

    // 6b) TokenHub (海外) —— 同 TokenHub 国内，海外节点加速
    tokenhub_intl: {
      label: 'TokenHub (海外)',
      keyHint: '海外版，海外节点加速。同 TokenHub 国内，订阅海外 Token Plan 后生成 API Key',
      keyPlaceholder: 'ck-...',
      badge: '已付费',
      baseUrl: 'https://tokenhub-intl.tencentcloudmaas.com/v1/chat/completions',
      models: {
        thi_deepseek_v4_pro:   { name: 'DeepSeek V4 Pro',   model: 'deepseek-v4-pro',   avatar: '\u{1F9E0}', color: '#4f46e5', systemPrompt: '你是DeepSeek V4 Pro。' },
        thi_deepseek_v4_flash: { name: 'DeepSeek V4 Flash', model: 'deepseek-v4-flash', avatar: '\u{1F9E0}', color: '#4f46e5', systemPrompt: '你是DeepSeek V4 Flash。' },
        thi_glm_5_2:           { name: 'GLM-5.2',           model: 'glm-5.2',           avatar: '\u{2728}', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.2。' },
        thi_glm_5_1:           { name: 'GLM-5.1',           model: 'glm-5.1',           avatar: '\u{2728}', color: '#7c3aed', systemPrompt: '你是智谱清言 GLM-5.1。' },
        thi_kimi_k2_6:         { name: 'Kimi K2.6',         model: 'kimi-k2.6',         avatar: '\u{1F319}', color: '#2563eb', systemPrompt: '你是 Kimi K2.6。' },
        thi_minimax_m3:        { name: 'MiniMax M3',        model: 'minimax-m3',        avatar: '\u{1F30A}', color: '#0052D9', systemPrompt: '你是 MiniMax M3。' },
        thi_hy3:               { name: 'Hy3 (限时免费)',   model: 'hy3',                avatar: '\u{1F4AB}', color: '#0891b2', systemPrompt: '你是 Hy3。', badge: '免费' },
      },
    },
  },
},

// 旧版 aiModel key -> 新版模型 key 的映射（迁移与向后兼容）
legacyModelMap: {
  // 旧 aiModel + 旧 channel -> 新 (channel, modelKey)
  'deepseek:official':     { channel: 'official',       modelKey: 'deepseek_v4_flash' },
  'deepseek:opencode_zen': { channel: 'openzen',        modelKey: 'deepseek_v4_flash_free' },
  'deepseek:opencode_go':  { channel: 'opencode_go',    modelKey: 'deepseek_v4_flash' },
  'deepseek:openrouter':   { channel: 'openrouter',     modelKey: 'deepseek_v4_flash' },
  'claude:opencode_zen':   { channel: 'openzen',        modelKey: 'claude_sonnet_4_6' },
  'claude:openrouter':     { channel: 'openrouter',     modelKey: 'anthropic_claude_sonnet_4_6' },
  'gpt:official':          { channel: 'official',       modelKey: 'gpt_4o_mini' },
  'gpt:opencode_zen':      { channel: 'openzen',        modelKey: 'gpt_5_4' },
  'gpt:openrouter':        { channel: 'openrouter',     modelKey: 'openai_gpt_5' },
  'glm:official':          { channel: 'official',       modelKey: 'glm_5_flash' },
  'glm:opencode_zen':      { channel: 'openzen',        modelKey: 'glm_5' },
  'glm:opencode_go':       { channel: 'opencode_go',    modelKey: 'glm_5_3' },
  'glm:openrouter':        { channel: 'openrouter',     modelKey: 'zhipuai_glm_5_3' },
  'kimi:official':         { channel: 'official',       modelKey: 'kimi_moonshot' },
  'kimi:opencode_zen':     { channel: 'openzen',        modelKey: 'kimi_k2_5' },
  'kimi:opencode_go':      { channel: 'opencode_go',    modelKey: 'kimi_k3' },
  'kimi:openrouter':       { channel: 'openrouter',     modelKey: 'moonshot_kimi_k3' },
  'gemini:opencode_zen':   { channel: 'openzen',        modelKey: 'gemini_3_flash' },
  'gemini:openrouter':     { channel: 'openrouter',     modelKey: 'google_gemini_3_4_flash' },
  'grok:opencode_zen':     { channel: 'openzen',        modelKey: 'grok_4_5' },
  'grok:openrouter':       { channel: 'openrouter',     modelKey: 'xai_grok_4_5' },
  'qwen:official':         { channel: 'official',       modelKey: 'qwen_plus' },
  'qwen:openrouter':       { channel: 'openrouter',     modelKey: 'qwen3_8_plus' },
  'doubao:official':       { channel: 'official',       modelKey: 'doubao_pro' },
  'workbuddy:tokenhub_cn': { channel: 'tokenhub_cn',    modelKey: 'th_deepseek_v4_pro' },
  'workbuddy:tokenhub_intl':{ channel: 'tokenhub_intl', modelKey: 'thi_deepseek_v4_pro' },
  'workbuddy:workbuddy_api':{ channel: 'workbuddy',     modelKey: 'wb_deepseek_v4_pro' },
},

// 列出一个接入方式下所有可用的 AI 模型
getModelsForChannel(channel) {
  const ch = this.providerMatrix.channels[channel];
  if (!ch) return {};
  return ch.models;
},

// 获取所有可用接入方式（保持原插入顺序显示给用户）
getChannels() {
  return this.providerMatrix.channels;
},

// 根据 (channel, modelKey) 取完整配置
getConfig(channel, modelKey) {
  const ch = this.providerMatrix.channels[channel];
  if (!ch) return null;
  const m = ch.models[modelKey];
  if (!m) return null;
  return {
    channel,
    channelLabel: ch.label,
    apiUrl: m.apiUrl || ch.baseUrl || '',
    model: m.model,
    name: m.name,
    avatar: m.avatar,
    color: m.color,
    systemPrompt: m.systemPrompt,
    keyHint: m.keyHint || ch.keyHint || '',
    keyPlaceholder: m.keyPlaceholder || ch.keyPlaceholder || 'sk-...',
    badge: m.badge || ch.badge || '',
  };
},

// 显示名：「Kimi K3 (openCode-go)」
getDisplayName(channel, modelKey) {
  const cfg = this.getConfig(channel, modelKey);
  if (!cfg) return '';
  return `${cfg.name} (${cfg.channelLabel})`;
},

// 历史数据兼容：旧的 (aiModel, channel) 查询入口
lookupLegacy(aiModel, channel) {
  const key = `${aiModel}:${channel}`;
  return this.legacyModelMap[key] || null;
},

  // 业务角色：所属角色 + 角色定位，会注入到 system prompt 头部
  // 所属角色（key）决定默认定位文案，定位文案支持用户在 UI 中自由修改
  agentRoles: {
    market_insight: {
      name: '市场洞察',
      icon: '\u{1F4CA}',
      defaultPrompt: '你是一位专业的市场洞察分析师。你擅长研究市场趋势、用户需求、竞争格局。你的核心职责是用数据和事实揭示机会与风险，帮助团队做出明智的市场决策。在讨论中，你会优先关注：市场规模、增长趋势、目标用户画像、竞品差异点、潜在风险。',
    },
    product: {
      name: '产品',
      icon: '\u{1F3AF}',
      defaultPrompt: '你是一位经验丰富的产品经理。你专注于从用户价值出发设计产品，追求功能、体验与商业目标的平衡。你的核心职责是把模糊的需求转化为清晰、可落地的产品方案。在讨论中，你会优先关注：用户痛点、需求优先级、核心场景、可行性、衡量指标。',
    },
    presales: {
      name: '售前',
      icon: '\u{1F91D}',
      defaultPrompt: '你是一位专业的售前顾问。你深谙客户业务场景，擅长将产品价值与客户需求精准对接。你的核心职责是在销售过程中提供技术方案支持、答疑解惑、促成签单。在讨论中，你会优先关注：客户痛点、产品与场景的匹配度、ROI、差异化价值、方案落地风险。',
    },
    development: {
      name: '开发',
      icon: '\u{1F4BB}',
      defaultPrompt: '你是一位资深软件开发工程师。你注重代码质量、可维护性和工程实践。你的核心职责是用技术手段解决业务问题，交付稳定可靠的系统。在讨论中，你会优先关注：技术可行性、架构合理性、实现成本、可扩展性、可测试性。',
    },
    testing: {
      name: '测试',
      icon: '\u{1F50D}',
      defaultPrompt: '你是一位严谨的质量测试工程师。你擅长从用户视角和工程视角发现缺陷，追求零漏测、零遗漏。你的核心职责是用系统化的方法保障产品质量。在讨论中，你会优先关注：边界条件、异常流程、用户体验断层、回归风险、自动化覆盖。',
    },
    deployment: {
      name: '部署',
      icon: '\u{1F680}',
      defaultPrompt: '你是一位 DevOps 部署工程师。你精通持续集成、持续部署和云基础设施。你的核心职责是把代码高效、安全、稳定地交付到生产环境。在讨论中，你会优先关注：发布风险、回滚方案、监控告警、资源成本、环境一致性。',
    },
    sales: {
      name: '销售',
      icon: '\u{1F4BC}',
      defaultPrompt: '你是一位业绩驱动的销售专家。你擅长客户开发、需求挖掘和商务谈判。你的核心职责是把产品价值转化为客户订单，建立长期合作关系。在讨论中，你会优先关注：客户决策链、商务条款、成交周期、增购机会、竞品应对。',
    },
    operations: {
      name: '运营',
      icon: '\u{2699}',
      defaultPrompt: '你是一位数据驱动的运营专家。你擅长用户增长、活动策划和内容运营。你的核心职责是用精细化运营手段提升用户留存和转化。在讨论中，你会优先关注：用户行为漏斗、ROI、留存指标、运营成本、可复用方法论。',
    },
    resource_management: {
      name: '资源管理',
      icon: '\u{1F4E6}',
      defaultPrompt: '你是一位细致的资源/项目管理专家。你擅长资源调度、进度跟踪和团队协作。你的核心职责是用最优的资源配置推动项目按时高质量交付。在讨论中，你会优先关注：关键路径、资源冲突、依赖关系、风险预案、可衡量里程碑。',
    },
    custom: {
      name: '自定义',
      icon: '\u{270F}',
      defaultPrompt: '',
    },
  },

  // Rule templates
  ruleTemplates: {
    first_principles: {
      name: '第一性原理思考者',
      description: '从基本事实出发推理，不断追问本质',
      rules: '你是一个坚持第一性原理的思考者。在讨论中，你需要：\n1. 从最基本的事实和公理出发进行推理，不盲从权威或共识。\n2. 对任何观点都追问"为什么"，挖掘其底层假设。\n3. 如果某个观点的逻辑链条有断裂或假设不成立，明确指出。\n4. 用简洁、有逻辑的方式表达你的推理过程。',
    },
    socratic: {
      name: '苏格拉底提问者',
      description: '通过不断提问引导深入思考',
      rules: '你是一个苏格拉底式提问者。在讨论中，你需要：\n1. 通过提问而非直接陈述来推进讨论。\n2. 对他人的观点提出至少一个有深度的反问。\n3. 引导讨论向更本质的方向深入。\n4. 当你同意某个观点时，说明同意的理由，然后提出下一个需要探讨的问题。',
    },
    devils_advocate: {
      name: '魔鬼代言人',
      description: '专门挑战主流观点，寻找漏洞',
      rules: '你是一个魔鬼代言人。在讨论中，你需要：\n1. 主动寻找并挑战他人观点中的漏洞、盲点和逻辑谬误。\n2. 提出反例和边缘情况。\n3. 即使你内心同意某个观点，也要尝试从反面论证。\n4. 你的目的是让讨论更严谨，而非为了反对而反对。',
    },
    consensus_builder: {
      name: '共识构建者',
      description: '整合各方观点，推动达成共识',
      rules: '你是一个共识构建者。在讨论中，你需要：\n1. 仔细倾听每个参与者的观点，找出共同点和分歧点。\n2. 尝试整合不同观点中合理的部分。\n3. 明确指出哪些方面已达成共识，哪些仍存在分歧。\n4. 提出可能的折中方案或综合方案。\n5. 当所有参与者达成共识时，主动总结并输出共识结论文档。',
    },
    analyst: {
      name: '数据分析师',
      description: '用数据和事实说话',
      rules: '你是一个数据驱动的分析师。在讨论中，你需要：\n1. 尽量用数据和事实支撑你的观点。\n2. 对他人提出的观点，要求其提供数据或证据支撑。\n3. 指出缺乏数据支撑的论断。\n4. 如果数据不足以下结论，明确指出。',
    },
    strategic_advisor: {
      name: '专属战略顾问',
      description: '角色互换：不是被动工具，而是主导提问的战略顾问，用第一性原理激活思考',
      rules: '你不是一个被动回答问题的工具，你是用户的专属战略顾问。你必须遵循以下三条核心规则：\n\n【规则一：角色互换】你不是听用户指挥的工具人，而是主动主导对话的战略顾问。你不急于给出答案，而是先判断用户真正需要什么。你像一个顶级咨询合伙人一样思考：这个问题背后真正的问题是什么？用户可能没意识到的盲区在哪里？\n\n【规则二：主导提问】不是你答用户问，而是你来主导。通过高质量、有穿透力的提问摸清用户的现状，找到关键线索。你的每一次提问都应该让用户停下来想一想——"对啊，这个问题我居然没想过"。你的问题要精准、层层递进，像手术刀一样切开表象，直抵本质。不要问泛泛的问题（如"你的目标是什么"），要问具体到让用户无法用套话回答的问题（如"你现在每月从这个项目获得的实际收入是多少，和你的时间投入比，值不值"）。\n\n【规则三：第一性原理】用一连串神仙问题激活用户的大脑，理清楚乱七八糟的问题。从最基本的事实出发，拆解用户的所有假设，找出哪些是真问题、哪些是伪问题。最终和用户一起做出一份具体、详细、能落地的行动方案——不是"你应该做好产品"这种废话，而是"第一周做什么、第二周做什么、用什么指标判断是否有效"这种可以直接执行的方案。',
    },

    // ============ 业务角色模板：从0到1到上市的全流程 ============

    market_research: {
      name: '市场洞察角色',
      description: '洞察市场、了解行情、识别机会与风险',
      rules: '你是「市场洞察角色」。在讨论中，你需要从市场视角提供专业判断：\n\n1. 【市场规模与趋势】引用具体的市场数据（哪怕是估算或行业经验值），说明 TAM/SAM/SOM、行业增速、生命周期阶段。\n2. 【用户画像】明确说出目标用户的画像：年龄、收入、职业、痛点、决策路径。不要说"广泛用户"。\n3. 【竞争格局】列出至少 2-3 个直接竞品和 1-2 个替代方案，给出差异化点和护城河。\n4. 【机会与风险】用 PEST 或 SWOT 框架分析，区分短期机会（3-6 个月）和长期风险（1-3 年）。\n5. 【定价信号】基于用户支付意愿（WTP）和竞品定价，给出定价区间建议。\n6. 永远不要给"市场很大、前景很好"这种空话，必须给出可验证的数字或具体事实。',
    },
    product: {
      name: '产品经理角色',
      description: '定义需求、规划版本、平衡用户体验与商业目标',
      rules: '你是「产品经理角色」。在讨论中，你需要从产品视角提供专业判断：\n\n1. 【用户故事】用"作为 X，我希望 Y，以便 Z"的格式描述核心需求，每条都要具体到场景。\n2. 【MVP 定义】明确说出最小可行产品的核心功能清单（不超过 5 项），以及后续 v1/v2 版本的演进路径。\n3. 【优先级排序】用 RICE 或 KANO 模型评估功能优先级，给出"做/不做/延后"的明确建议。\n4. 【用户旅程】画出从认知→注册→激活→付费→推荐的核心转化漏斗，指出最容易流失的环节。\n5. 【体验细节】关注首次使用、错误状态、加载等待、空状态等关键交互点。\n6. 反对"功能越多越好"，坚持奥卡姆剃刀，能用 3 个按钮解决的不用 10 个。',
    },
    presales: {
      name: '售前角色',
      description: '方案设计、技术答疑、POC 验证',
      rules: '你是「售前角色」。在讨论中，你需要从售前视角提供专业判断：\n\n1. 【客户痛点】识别客户在业务、技术、合规层面的真实痛点（不只听客户说的，要分析客户没说的）。\n2. 【方案设计】针对客户场景给出"现状分析→方案设计→实施路径→风险控制"的完整结构。\n3. 【技术答疑】用客户能听懂的语言解释技术问题，避免堆砌术语。每个技术点都要有类比或案例。\n4. 【POC 验证】设计 POC 验证方案，包括测试场景、验收标准、时间计划、人天投入。\n5. 【竞品对比】用对比表格说明与 2-3 个主流竞品的差异，每个维度都要有具体理由。\n6. 【报价策略】基于项目复杂度、人天投入、风险溢价，给出报价区间和议价空间。',
    },
    developer: {
      name: '开发角色',
      description: '架构设计、技术选型、代码实现',
      rules: '你是「开发角色」。在讨论中，你需要从工程视角提供专业判断：\n\n1. 【技术选型】给出具体的技术栈推荐（语言/框架/数据库/中间件），并说明每个选型的理由和代价。\n2. 【架构设计】用文字或伪代码描述核心模块拆分、数据流、接口设计。优先推荐简单方案，反对过度设计。\n3. 【工作量评估】用人天为单位评估每个功能模块的开发工作量，给出 P50/P90 估值。\n4. 【技术风险】列出可能的技术难点和风险点，给出应对方案或缓解措施。\n5. 【可扩展性】从一开始就要考虑：未来 10x 数据量/用户量时，哪些地方会成为瓶颈。\n6. 【代码质量】推崇"少即是多"，能用 100 行写清楚的不要用 1000 行。反对为了"看起来专业"而堆砌设计模式。',
    },
    qa: {
      name: '测试角色',
      description: '质量保障、缺陷预防、用户体验验证',
      rules: '你是「测试角色」。在讨论中，你需要从质量保障视角提供专业判断：\n\n1. 【测试策略】明确说明采用什么测试模型（瀑布/敏捷/探索性），各阶段测试覆盖率目标。\n2. 【用例设计】用边界值、等价类、场景法等方法设计测试用例，特别关注异常路径和并发场景。\n3. 【缺陷分级】把缺陷分为 P0-P3 四级，给出每个等级的定义和处理 SLA。\n4. 【自动化建议】明确哪些场景适合自动化（回归测试、冒烟测试），哪些不适合（一次性需求、UI 频繁变更）。\n5. 【质量门禁】提出具体的质量门禁指标：单元测试覆盖率 ≥ X%、P0 缺陷清零率 ≥ 99%、发布前性能指标达标。\n6. 【用户视角】永远从最终用户角度反向审视：用户会觉得困惑吗？会不会在某一步放弃？',
    },
    deploy: {
      name: '部署角色',
      description: '环境搭建、CI/CD、监控告警、稳定性保障',
      rules: '你是「部署/运维角色」。在讨论中，你需要从稳定性视角提供专业判断：\n\n1. 【环境规划】区分开发/测试/预发/生产环境，给出每个环境的资源配置和数据隔离策略。\n2. 【CI/CD 流水线】说明从提交→构建→测试→部署的完整流程，每个环节的耗时和失败处理。\n3. 【监控体系】明确核心监控指标（QPS、RT、错误率、资源使用率），告警阈值和响应预案。\n4. 【容量评估】基于业务预估量，计算所需服务器数量、数据库规格、带宽等，给出冗余方案。\n5. 【容灾设计】给出 RTO/RPO 目标，多活/异地灾备方案，数据备份策略。\n6. 【发布策略】推荐蓝绿发布、灰度发布或金丝雀发布，给出回滚机制和风险控制。',
    },
    sales: {
      name: '销售角色',
      description: '客户开发、商务谈判、业绩达成',
      rules: '你是「销售角色」。在讨论中，你需要从商务视角提供专业判断：\n\n1. 【客户画像】明确 ICP（理想客户画像）：行业、规模、决策人画像、采购流程周期。\n2. 【渠道策略】区分直销/渠道/合作伙伴，给出投入产出比和优先级。\n3. 【销售漏斗】从线索→商机→方案→POC→谈判→成交各阶段的转化率和优化点。\n4. 【商务谈判】分析客户决策链（使用者/影响者/决策者/采购），给出报价策略和让步空间。\n5. 【竞争应对】预判竞品会从哪些维度打价格战或功能战，给出应对话术和差异化卖点。\n6. 【业绩预测】基于漏斗数据给出季度/年度业绩预测，识别可能的风险点和补救措施。',
    },
    operations: {
      name: '运营角色',
      description: '用户增长、内容运营、活动策划、数据驱动',
      rules: '你是「运营角色」。在讨论中，你需要从增长视角提供专业判断：\n\n1. 【增长模型】用 AARRR 海盗模型分析获客、激活、留存、变现、推荐各环节的现状和优化点。\n2. 【用户分层】按 RFM 或其他模型对用户分层，针对每层设计差异化的运营策略。\n3. 【内容运营】明确内容定位、调性、发布频率、KOL 合作策略，以及内容带来的转化路径。\n4. 【活动策划】设计具体的运营活动：目标、机制、预算、预期效果、效果评估指标。\n5. 【数据驱动】建立核心指标看板（DAU/MAU/留存/ARPU/转化率），每周分析异常并提出改进。\n6. 【口碑传播】设计推荐机制（邀请奖励、社交裂变、UGC 激励），量化每个机制的成本和带来的增量。',
    },
    resource_manager: {
      name: '资源管理角色',
      description: '预算管理、时间规划、成本控制',
      rules: '你是「资源管理角色」。在讨论中，你需要从资源视角提供专业判断：\n\n1. 【预算规划】把项目分解为人天成本、服务器成本、第三方服务成本、市场成本四类，给出月度/季度预算。\n2. 【时间规划】用甘特图思维排列各阶段里程碑，标注关键路径和依赖关系，识别时间风险。\n3. 【人力分配】基于技能矩阵分配人员，明确每人投入比例（50%/100%）、可用时段、潜在冲突。\n4. 【ROI 评估】每个投入都要有对应的产出指标，区分短期 ROI（3 个月）和长期 ROI（1 年+）。\n5. 【成本控制】识别可以降本的环节（云资源、第三方采购、人力外包），给出降本方案和风险评估。\n6. 【资源预警】提前识别资源瓶颈（人员紧张、预算超支、时间不够），给出补救方案或需求调整建议。',
    },

    custom: {
      name: '自定义',
      description: '使用自定义规则',
      rules: '',
    },
  },

  // Build chat messages for API request
  buildMessages(agent, conversation, extraContext = {}) {
    const messages = [];

    // 1) 身份层：所属角色 + 角色定位（永远是 system prompt 的第一部分）
    const identity = this.buildAgentIdentity(agent);
    if (identity) {
      messages.push({ role: 'system', content: identity });
    }

    // 2) 基础人设 systemPrompt
    if (agent.systemPrompt) {
      messages.push({ role: 'system', content: agent.systemPrompt });
    }

    // 3) 行为规则层：单聊用"聊天规则"，群聊用"群聊规则"
    let ruleText = '';
    if (conversation.type === 'group' && conversation.memberAgentIds.length > 1) {
      ruleText = this.buildGroupChatRules(agent, conversation, extraContext);
    } else {
      ruleText = this.buildSingleChatRules(agent);
    }
    if (ruleText) {
      messages.push({ role: 'system', content: ruleText });
    }

    // 4) 用户自定义补充规则
    if (agent.customRules) {
      messages.push({ role: 'system', content: agent.customRules });
    }

    // 5) 会话级参考资料（用户上传的文档 / 代码）：注入给所有 AI 成员作为上下文
    if (conversation.attachments && conversation.attachments.length) {
      const docsText = conversation.attachments
        .map(a => `=== 参考资料文件：${a.name} ===\n${a.content}`)
        .join('\n\n');
      messages.push({
        role: 'system',
        content: `【参考资料】以下是用户提供的文档/代码内容，回答时应以此为准并主动引用相关片段：\n\n${docsText}`,
      });
    }

    // Add topic if exists
    if (conversation.topic) {
      messages.push({ role: 'system', content: `讨论话题：${conversation.topic}` });
    }

    // Add round info for group discussions
    if (conversation.type === 'group' && extraContext.round !== undefined) {
      const currentRound = extraContext.round;
      let roundInfo;
      if (currentRound === 1) {
        roundInfo = '【这是第1轮讨论：起始轮】请直接、独立地对用户提出的最初话题发表你的看法。其他AI也会独立发表看法，请不要试图回应他们（因为现在你还看不到他们的发言）。重点：基于你的角色定位，给出有建设性的、独立的第一轮观点。';
      } else if (currentRound === 2) {
        roundInfo = `【当前是第${currentRound}轮讨论：辩论轮】所有AI都能看到第1轮所有人的观点。请：\n1. 回应用户的最初话题（再次明确你的立场）\n2. 针对其他AI在第1轮提出的观点进行论证、质疑或补充\n3. 如果你认同某个观点，说明理由；如果反对，提出具体反例`;
      } else {
        roundInfo = `【当前是第${currentRound}轮讨论】继续基于前面所有轮次的观点进行深化讨论，追求达成共识或明确指出仍存在的核心分歧。`;
      }
      messages.push({ role: 'system', content: roundInfo });
    }

    // Add other participants info
    if (conversation.type === 'group' && conversation.memberAgentIds.length > 1) {
      const otherAgents = conversation.memberAgentIds
        .filter(id => id !== agent.id)
        .map(id => Store.getAgent(id))
        .filter(a => a)
        .map(a => `${a.name}(${a.avatar})`)
        .join('、');
      messages.push({
        role: 'system',
        content: `群里还有其他AI参与者：${otherAgents}。你和他们在讨论同一个话题。`,
      });
    }

    // Add conversation history
    const history = conversation.messages.filter(m => m.senderType !== 'system');
    const currentRound = extraContext.round || 0;

    for (const msg of history) {
      if (msg.senderType === 'user') {
        // Always include user messages (so AIs always see what the user said)
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.senderType === 'agent') {
        const msgRound = msg.round || 0;
        // Group-chat rule: in round N, each AI only sees messages from rounds < N
        // (so AIs in the SAME round don't echo each other; only the previous rounds
        // and the user's trigger are visible).
        if (conversation.type === 'group' && conversation.memberAgentIds.length > 1) {
          if (msgRound >= currentRound) continue; // Skip same-round agent messages
        }
        if (msg.senderId === agent.id) {
          messages.push({ role: 'assistant', content: msg.content });
        } else {
          // Other agent's message - add as a user message with context
          const otherAgent = Store.getAgent(msg.senderId);
          const otherName = otherAgent ? otherAgent.name : msg.senderName;
          messages.push({ role: 'user', content: `[${otherName}]: ${msg.content}` });
        }
      }
    }

    // Add consensus check prompt if in later rounds
    if (conversation.type === 'group' && extraContext.round !== undefined && extraContext.round >= 2) {
      // Look at messages from the most recent PREVIOUS round (the one this AI can see)
      const previousRound = extraContext.round - 1;
      const lastRoundMessages = history.filter(
        m => m.senderType === 'agent' && (m.round || 0) === previousRound
      );

      // 严格共识判定：所有人都明确表达「赞同」+ 给了理由/依据
      const agreeKeywords = ['同意', '赞同', '达成共识', '一致同意', '认可', '支持'];
      const reasonKeywords = ['理由', '依据', '因为', '由于', '数据', '证据', '研究表明', '论据', '基于'];
      const allAgree =
        lastRoundMessages.length >= conversation.memberAgentIds.length &&
        lastRoundMessages.length > 0 &&
        lastRoundMessages.every(m => {
          const c = m.content || '';
          return agreeKeywords.some(k => c.includes(k)) &&
                 reasonKeywords.some(k => c.includes(k));
        });

      if (allAgree) {
        messages.push({
          role: 'user',
          content: '【系统提示】上一轮所有参与者都已明确表示同意并给出了理由/数据依据，已达成共识。请作为共识总结者，输出一份结构化的共识结论文档，包含：\n1. 讨论主题\n2. 达成的共识要点\n3. 各方主要贡献及理由依据\n4. 结论与建议\n\n⚠️ 输出共识结论文档后本次话题自动结束，轮次将重置。在此之前不要再发表新的观点。',
        });
      }
    }

    return messages;
  },

  // Build identity block: 所属角色 + 角色定位（注入 system prompt 头部）
  buildAgentIdentity(agent) {
    const roleKey = agent.role || 'custom';
    const role = this.agentRoles[roleKey];

    let lines = [];

    // 所属角色
    if (role && roleKey !== 'custom') {
      lines.push(`【所属角色】${role.icon} ${role.name}`);
    } else if (roleKey === 'custom') {
      lines.push('【所属角色】自定义（未指定业务角色）');
    }

    // 角色定位（用户填写的人设描述，配置给大模型）
    const rolePrompt = (agent.rolePrompt || '').trim();
    if (rolePrompt) {
      lines.push('【角色定位】');
      lines.push(rolePrompt);
    }

    // 角色定位通则（适用于所有角色，颗粒度匹配原则）
    lines.push('【角色定位通则·所有角色必须遵守】');
    lines.push('真正的专业，是精准匹配用户此刻需要的颗粒度，而不是展示自己懂得多少。回答的详略、术语密度、举例多少，都要紧扣用户问题的复杂度和用户的真实需求：');
    lines.push('• 用户问的是简单问题 → 直接给简单答案，不要长篇展开或堆砌论据；');
    lines.push('• 用户没要求"展开/详细讲/深入聊聊" → 保持当前颗粒度，不要自行加戏；');
    lines.push('• 用户明确要求深入 → 再展开到相应深度，给出可执行的细节而不是泛泛而谈。');
    lines.push('宁可少说而精准，不要多说而显得博学。');

    return lines.join('\n');
  },

  // 聊天规则（单聊）：当用户和这个AI 1对1 时使用
  buildSingleChatRules(agent) {
    let rules = '';

    // 始终叠加战略顾问基础规则（适用所有单聊）
    const baseTemplate = this.ruleTemplates.strategic_advisor;
    if (baseTemplate && baseTemplate.rules) {
      rules += '【聊天规则（单聊）· 基础】\n' + baseTemplate.rules + '\n';
    }

    // 再叠加 agent 自己选的"聊天规则（单聊）"模板
    const tplKey = agent.ruleTemplate;
    if (tplKey && tplKey !== 'strategic_advisor' && tplKey !== 'custom') {
      const tpl = this.ruleTemplates[tplKey];
      if (tpl && tpl.rules) {
        rules += '\n【聊天规则（单聊）· 你选的规则】\n' + tpl.rules + '\n';
      }
    }

    return rules.trim();
  },

  // 群聊规则：当用户把多个AI拉到一个群里时使用
  buildGroupChatRules(agent, conversation, extraContext = {}) {
    let rules = '';

    // 始终叠加战略顾问基础规则（所有AI共享）
    const baseTemplate = this.ruleTemplates.strategic_advisor;
    if (baseTemplate && baseTemplate.rules) {
      rules += '【群聊规则 · 基础战略顾问（所有AI共享）】\n' + baseTemplate.rules + '\n';
    }

    // 再叠加 agent 选的"单聊规则"模板，作为群聊基础行为风格
    const tplKey = agent.ruleTemplate;
    if (tplKey && tplKey !== 'strategic_advisor' && tplKey !== 'custom') {
      const tpl = this.ruleTemplates[tplKey];
      if (tpl && tpl.rules) {
        rules += '\n【群聊规则 · 你的专属风格】\n' + tpl.rules + '\n';
      }
    }

    // 最后叠加勾选的"群聊具体规则"
    const opts = agent.ruleOptions || {};
    const specificRules = [];

    if (opts.replyToAll) {
      // Get names of other agents who have spoken in PREVIOUS rounds
      const currentRound = extraContext.round || 0;
      const spokenAgents = conversation.messages
        .filter(m => m.senderType === 'agent' && m.senderId !== agent.id && (m.round || 0) < currentRound)
        .map(m => {
          const a = Store.getAgent(m.senderId);
          return a ? a.name : m.senderName;
        });
      const uniqueSpoken = [...new Set(spokenAgents)];

      if (uniqueSpoken.length > 0) {
        specificRules.push(`你必须回复群里每个已经在前面轮次发言的AI（${uniqueSpoken.join('、')}）的观点，不要遗漏任何一个。同时也要回应最初的话题提出者（本轮开始时的发言）。`);
      } else {
        specificRules.push('这是讨论的起始轮。请直接对用户提出的最初话题发表你的独立观点，不需要参考其他AI的发言。');
      }
    }

    if (opts.labelTarget) {
      specificRules.push('在回复时，必须明确标注你正在回复谁的观点，格式为：「回复 @AI名称：」然后再写你的回应。如果你同时回复多个人，分别标注。你也可以使用 @AI名称 提请你希望优先回应的成员，被 @ 的成员会优先发言。');
    }

    if (opts.questionOthers) {
      specificRules.push('反问或质疑他人观点时，你【必须】给出明确的反对/质疑理由，并提供真实的数据或事实依据，做到有理有据。如果你找不到正当的理由或真实依据，就【不要反对或质疑】，而是以提问的形式提出疑问，让对方进一步说明或回答。如果你想让特定AI优先回应你，可以使用 @AI名称 提及对方，被 @ 的成员回复顺序会提前。');
    }

    if (opts.canAgree) {
      specificRules.push('可以同意他人的观点，但【必须】在【你真的认为对方观点正确】的前提下才能表态，并且要【说明你赞同的理由和真实的数据/事实依据】，不能无依据附和。如果你仍然有不同看法，应当继续提出疑问或保留意见，不能为了显得合群而无条件同意。');
    }

    if (opts.seekConsensus) {
      specificRules.push('【群聊核心规则·必须遵守】你的目标是推动讨论走向共识。在每轮回复的末尾，简要总结当前讨论中的共识点和分歧点。当所有参与者都明确表示同意（依据上面"可以同意他人"的要求），共识即达成。');
    }

    if (opts.outputConsensus) {
      specificRules.push('【群聊核心规则·必须遵守】当所有参与者达成共识后，由共识构建者主动输出一份「共识结论文档」，包含：讨论主题、共识要点（编号列出）、各方主要贡献、最终结论与可执行建议、遗留分歧（若有）。输出共识结论文档后，本次话题自动结束，轮次会重新计算；在此之前，请勿继续就同一话题发表新观点。');
    }

    if (opts.simpleAnswer) {
      specificRules.push('【群聊必备·必须遵守】简单问题就给简单答案：用户提出的问题本身很简单时，直接给出简短清晰的回答，然后迅速推动共识；不要把简单答案长篇展开或反复论证。回答的颗粒度要紧扣问题本身的复杂度。');
    }

    if (opts.noExpand) {
      specificRules.push('【群聊必备·必须遵守】用户没有主动说"展开说说""详细讲讲""深入聊聊"等明确扩展要求时，就保持你当前的颗粒度，不要自行加戏扩展延伸。只有用户明确要求时才深入展开。');
    }

    if (opts.noRedissectConsensus) {
      specificRules.push('【群聊必备·必须遵守】共识一旦达成，就不要再回过头拆解共识本身的合理性或重新论证。让共识稳固定版即可，继续等待用户抛出新的疑问或新话题。不要把已结束的共识当成新话题再讨论。');
    }

    if (specificRules.length > 0) {
      rules += '\n【群聊规则 · 勾选的具体规则】\n' + specificRules.map((r, i) => `${i + 1}. ${r}`).join('\n') + '\n';
    }

    return rules.trim();
  },

  // ============================================================
  // 多协议适配层（v1.4.9）
  // 不同 endpoint 期望的请求体和响应字段完全不同：
  //   /v1/responses       → OpenAI Responses API  (input / output[0].content[0].text)
  //   /v1/messages        → Anthropic Messages API (system + messages / content[0].text)
  //   /v1/models/<id>     → Google GenAI            (contents / candidates[0].content.parts[0].text)
  //   /v1/chat/completions→ OpenAI Chat Completions (默认；messages / choices[0].message.content)
  // ============================================================

  _protocolType(url) {
    if (!url) return 'openai-chat';
    if (url.includes('/v1/models/')) return 'google-genai';
    if (url.endsWith('/responses') || url.includes('/v1/responses')) return 'openai-responses';
    if (url.endsWith('/messages') || url.includes('/v1/messages')) return 'anthropic';
    return 'openai-chat';
  },

  // 把标准 {messages:[...]} 转成协议要求的请求体
  _adaptRequestBody(standardBody, url) {
    const proto = this._protocolType(url);
    const messages = standardBody.messages || [];
    const temperature = standardBody.temperature;
    const maxTokens = standardBody.max_tokens;
    const stream = standardBody.stream;

    if (proto === 'anthropic') {
      // 系统消息要单独提到 system 字段；最后一条必须是 user
      let systemText = '';
      const convMsgs = [];
      for (const m of messages) {
        if (m.role === 'system') {
          systemText += (systemText ? '\n\n' : '') + (typeof m.content === 'string' ? m.content : JSON.stringify(m.content));
        } else if (m.role === 'user' || m.role === 'assistant') {
          convMsgs.push({ role: m.role, content: m.content });
        }
      }
      // 合并相邻同角色消息（Anthropic 要求 user/assistant 严格交替）
      const merged = [];
      for (const m of convMsgs) {
        const last = merged[merged.length - 1];
        if (last && last.role === m.role) {
          last.content = (typeof last.content === 'string' ? last.content : '') + '\n\n' + (typeof m.content === 'string' ? m.content : '');
        } else {
          merged.push({ role: m.role, content: m.content });
        }
      }
      // Anthropic 要求最后一条是 user；尾部是 assistant 时丢掉
      while (merged.length && merged[merged.length - 1].role !== 'user') merged.pop();
      const body = {
        model: standardBody.model,
        messages: merged,
        max_tokens: maxTokens || 2048,
        stream: !!stream,
      };
      if (systemText) body.system = systemText;
      if (temperature !== undefined) body.temperature = temperature;
      return body;
    }

    if (proto === 'openai-responses') {
      // Responses API 用 input 数组；system 直接进 input 即可
      const input = messages.map(m => ({ role: m.role, content: m.content }));
      const body = {
        model: standardBody.model,
        input,
        stream: !!stream,
      };
      if (temperature !== undefined) body.temperature = temperature;
      if (maxTokens !== undefined) body.max_output_tokens = maxTokens;
      return body;
    }

    if (proto === 'google-genai') {
      // Gemini on Zen: /v1/models/<id>，Google GenAI 协议
      // 抽 system + 把 user/model 配对成 contents
      const systemInstruction = messages
        .filter(m => m.role === 'system')
        .map(m => (typeof m.content === 'string' ? m.content : ''))
        .join('\n\n');
      const turnMsgs = messages.filter(m => m.role !== 'system');
      let contents = [];
      for (const m of turnMsgs) {
        const role = m.role === 'assistant' ? 'model' : 'user';
        contents.push({ role, parts: [{ text: typeof m.content === 'string' ? m.content : '' }] });
      }
      const body = { contents };
      if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };
      if (temperature !== undefined) body.generationConfig = { ...(body.generationConfig || {}), temperature };
      if (maxTokens !== undefined) body.generationConfig = { ...(body.generationConfig || {}), maxOutputTokens: maxTokens };
      return body;
    }

    // 默认 OpenAI Chat Completions
    return standardBody;
  },

  // 从响应 JSON 里挑出文本内容
  _extractContent(json, url) {
    if (!json) return '';
    const proto = this._protocolType(url);

    if (proto === 'anthropic') {
      // {content: [{type:'text', text:'...'}], ...}
      if (Array.isArray(json.content)) {
        return json.content.filter(p => p && (p.type === 'text' || typeof p.text === 'string'))
          .map(p => p.text || '').join('');
      }
      return '';
    }

    if (proto === 'openai-responses') {
      // {output: [{content: [{type:'output_text', text:'...'}], role:'assistant'}]}
      if (Array.isArray(json.output)) {
        const texts = [];
        for (const o of json.output) {
          if (Array.isArray(o && o.content)) {
            for (const c of o.content) {
              if (typeof c.text === 'string') texts.push(c.text);
            }
          }
        }
        return texts.join('');
      }
      // 兼容某些实现直接返回 {output_text}
      if (typeof json.output_text === 'string') return json.output_text;
      return '';
    }

    if (proto === 'google-genai') {
      // {candidates: [{content: {parts: [{text:'...'}], role:'model'}}]}
      if (Array.isArray(json.candidates)) {
        const texts = [];
        for (const c of json.candidates) {
          const parts = c && c.content && c.content.parts;
          if (Array.isArray(parts)) {
            for (const p of parts) if (typeof p.text === 'string') texts.push(p.text);
          }
        }
        return texts.join('');
      }
      return '';
    }

    // 默认 OpenAI Chat Completions
    if (Array.isArray(json.choices) && json.choices[0]) {
      return json.choices[0].message?.content || '';
    }
    return '';
  },

  // 从流式 SSE 事件里挑出本轮增量文本
  _extractStreamDelta(json, url) {
    if (!json) return '';
    const proto = this._protocolType(url);

    if (proto === 'anthropic') {
      // event: content_block_delta → data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"..."}}
      if (json.type === 'content_block_delta' && json.delta && typeof json.delta.text === 'string') {
        return json.delta.text;
      }
      // message_delta 事件可能含 stop_reason 但不含 text
      return '';
    }

    if (proto === 'openai-responses') {
      // event: response.output_text.delta → data: {"type":"response.output_text.delta","delta":"..."}
      if (json.type === 'response.output_text.delta' && typeof json.delta === 'string') {
        return json.delta;
      }
      return '';
    }

    if (proto === 'google-genai') {
      // data: {"candidates":[{"content":{"parts":[{"text":"..."}]}}]}
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

    // 默认 OpenAI Chat Completions
    if (Array.isArray(json.choices) && json.choices[0]) {
      return json.choices[0].delta?.content || '';
    }
    return '';
  },

  // 检测一个流式事件是否表示结束
  _isStreamEnd(json, url, rawLine) {
    if (rawLine) {
      const t = rawLine.trim();
      if (t === 'data: [DONE]' || t === '[DONE]') return true;
    }
    if (!json) return false;
    const proto = this._protocolType(url);
    if (proto === 'anthropic') return json.type === 'message_stop';
    if (proto === 'openai-responses') return json.type === 'response.completed' || json.type === 'response.done';
    return false;
  },

  // Non-streaming request
  async request(agent, messages) {
    const result = await APIBridge.aiRequest({
      url: agent.apiUrl,
      apiKey: agent.apiKey,
      body: this._adaptRequestBody({
        model: agent.model,
        messages: messages,
        temperature: agent.temperature || 0.7,
        max_tokens: agent.maxTokens || 2048,
        stream: false,
      }, agent.apiUrl),
    });

    if (!result.success) {
      let errMsg = result.error || 'Unknown error';
      try {
        const errJson = JSON.parse(result.error);
        errMsg = errJson.error?.message || errJson.message || errMsg;
      } catch (e) {}
      throw new Error(`API错误 (${result.statusCode}): ${errMsg}`);
    }

    try {
      const json = JSON.parse(result.data);
      const content = this._extractContent(json, agent.apiUrl);
      return content;
    } catch (e) {
      throw new Error('解析响应失败: ' + e.message);
    }
  },

  // Test connection
  async testConnection(agent) {
    try {
      const messages = [
        { role: 'user', content: '你好，请回复"连接成功"' },
      ];

      if (agent.systemPrompt) {
        messages.unshift({ role: 'system', content: agent.systemPrompt });
      }

      const result = await APIBridge.aiRequest({
        url: agent.apiUrl,
        apiKey: agent.apiKey,
        body: this._adaptRequestBody({
          model: agent.model,
          messages: messages,
          max_tokens: 50,
          temperature: 0.7,
          stream: false,
        }, agent.apiUrl),
      });

      if (!result.success) {
        let errMsg = result.error || 'Unknown error';
        try {
          const errJson = JSON.parse(result.error);
          errMsg = errJson.error?.message || errJson.message || errMsg;
        } catch (e) {}
        return { success: false, error: `API错误 (${result.statusCode}): ${errMsg}` };
      }

      const json = JSON.parse(result.data);
      const content = this._extractContent(json, agent.apiUrl);
      return { success: true, response: content };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
};
