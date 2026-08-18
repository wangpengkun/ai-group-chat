// ============ Renderer: Main UI logic ============

// 兼容新旧 channel 名的标签映射（数据从旧版本升级时不丢失显示）
const CHANNEL_LABEL_MAP = {
  'official':       '官网直连',
  'opencode_zen':   'openZen',
  'opencode_go':    'openCode-go',
  'openrouter':     'OpenRouter',
  'tokenhub_cn':    'TokenHub (国内)',
  'tokenhub_intl':  'TokenHub (海外)',
  // v1.4.5
  'openzen':        'openZen',
  'workbuddy':      'WorkBuddy',
};

const App = {
  currentNav: 'chats',
  isGenerating: false,
  stopGeneration: false,
  autoContinuePaused: false, // user paused auto-continue for this discussion
  streamListeners: new Map(),
  groupStep: 1,
  selectedFriends: [],
  replyOrder: [],
  addMemberSelected: [],

  init() {
    Store.init();
    this.setupStreamListeners();
    this.bindEvents();
    this.renderAll();
    // Check for updates after 3 seconds
    setTimeout(() => this.checkForUpdates(false), 3000);
  },

  // ============ Stream listeners ============
  setupStreamListeners() {
    APIBridge.onStreamChunk((data) => {
      const listener = this.streamListeners.get(data.requestId);
      if (listener && listener.onChunk) {
        listener.onChunk(data.content);
      }
    });

    APIBridge.onStreamEnd((data) => {
      const listener = this.streamListeners.get(data.requestId);
      if (listener) {
        if (listener.onEnd) listener.onEnd(data.fullContent);
        this.streamListeners.delete(data.requestId);
      }
    });

    APIBridge.onStreamError((data) => {
      const listener = this.streamListeners.get(data.requestId);
      if (listener) {
        if (listener.onError) listener.onError(data.error);
        this.streamListeners.delete(data.requestId);
      }
    });
  },

  // ============ Event bindings ============
  bindEvents() {
    // Nav buttons
    document.getElementById('nav-chats').addEventListener('click', () => this.switchNav('chats'));
    document.getElementById('nav-contacts').addEventListener('click', () => this.switchNav('contacts'));
    document.getElementById('nav-settings').addEventListener('click', () => this.openModal('modal-settings'));
    document.getElementById('btn-settings').addEventListener('click', () => this.openModal('modal-settings'));

    // Conversation actions
    document.getElementById('btn-new-single').addEventListener('click', () => this.openNewSingleModal());
    document.getElementById('btn-new-group').addEventListener('click', () => this.openNewGroupModal());

    // Contacts
    document.getElementById('btn-add-friend').addEventListener('click', () => this.openAgentModal());

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => this.filterConversations(e.target.value));

    // Message input
    const input = document.getElementById('message-input');
    input.addEventListener('input', (e) => {
      this.autoResize(input);
      this.handleMentionInput(e);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    document.getElementById('btn-send').addEventListener('click', () => this.sendMessage());

    // Attachment: add document / code as conversation reference
    const fileAttach = document.getElementById('file-attach');
    if (fileAttach) fileAttach.addEventListener('change', (e) => {
      this.onAttachFiles(e.target.files);
      e.target.value = '';
    });
    const btnAttach = document.getElementById('btn-attach');
    if (btnAttach) btnAttach.addEventListener('click', () => this.openAttachFilePicker());

    // Mobile bottom tab bar (WeChat style)
    const tabChats = document.getElementById('tab-chats');
    if (tabChats) tabChats.addEventListener('click', () => { this.setBottomTab('chats'); this.switchNav('chats'); this.openMobileSidebar(); });
    const tabContacts = document.getElementById('tab-contacts');
    if (tabContacts) tabContacts.addEventListener('click', () => { this.setBottomTab('contacts'); this.switchNav('contacts'); this.openMobileSidebar(); });
    const tabMe = document.getElementById('tab-me');
    if (tabMe) tabMe.addEventListener('click', () => { this.setBottomTab('me'); this.openModal('modal-settings'); });

    // Chat header actions
    document.getElementById('btn-clear-chat').addEventListener('click', () => this.confirmClearChat());
    document.getElementById('btn-chat-info').addEventListener('click', () => this.toggleInfoPanel());

    // Info panel
    document.getElementById('btn-close-info').addEventListener('click', () => this.closeInfoPanel());

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.dataset.modal;
        this.closeModal(modalId);
      });
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modalId = e.currentTarget.dataset.close;
        this.closeModal(modalId);
      });
    });

    // Click outside modal to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.style.display = 'none';
        }
      });
    });

    // Settings
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchSettingsTab(e.target.dataset.tab));
    });
    document.getElementById('btn-save-settings').addEventListener('click', () => this.saveSettings());

    // Agent modal - cascading selectors
    document.getElementById('agent-ai-model').addEventListener('change', (e) => this.onAIModelChange(e.target.value));
    document.getElementById('agent-channel').addEventListener('change', (e) => this.onChannelChange(e.target.value));
    document.getElementById('agent-rule-template').addEventListener('change', (e) => this.updateRuleTemplateDesc(e.target.value));
    document.getElementById('agent-role').addEventListener('change', (e) => this.onAgentRoleChange(e.target.value));
    document.getElementById('btn-save-agent').addEventListener('click', () => this.saveAgent());
    document.getElementById('btn-test-agent').addEventListener('click', () => this.testAgent());

    // Update
    document.getElementById('btn-check-update').addEventListener('click', () => this.checkForUpdates(true));
    document.getElementById('btn-download-update').addEventListener('click', () => this.downloadUpdate());
    document.getElementById('btn-dismiss-update').addEventListener('click', () => this.dismissUpdateBar());

    // Color picker
    document.querySelectorAll('.color-option').forEach(opt => {
      opt.addEventListener('click', (e) => {
        document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
      });
    });

    // New group flow
    document.getElementById('btn-group-next').addEventListener('click', () => this.groupNextStep());
    document.getElementById('btn-group-prev').addEventListener('click', () => this.groupPrevStep());
    document.getElementById('btn-create-group').addEventListener('click', () => this.createGroup());

    // In-group member management (add / remove, WeChat-style)
    document.getElementById('btn-confirm-add-member').addEventListener('click', () => this.confirmAddMembers());
    const membersBar = document.getElementById('chat-header-members');
    membersBar.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.member-chip-remove');
      if (removeBtn) {
        this.removeGroupMember(removeBtn.dataset.id);
        return;
      }
      if (e.target.closest('#btn-add-member')) {
        this.openAddMemberModal();
      }
    });

    // New single chat
    document.getElementById('btn-create-single').addEventListener('click', () => this.createSingleChat());

    // Data management
    document.getElementById('btn-export-data').addEventListener('click', () => this.exportData());
    document.getElementById('btn-clear-data').addEventListener('click', () => this.confirmClearData());

    // Config sync (跨设备同步: 仅配置, 不含聊天记录)
    document.getElementById('btn-export-config').addEventListener('click', () => this.exportConfigFile());
    document.getElementById('btn-import-config').addEventListener('click', () => {
      document.getElementById('file-import-config').click();
    });
    document.getElementById('file-import-config').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) this.importConfigFromFile(e.target.files[0], 'settings');
      e.target.value = '';
    });

    // QR Sync
    document.getElementById('btn-sync-export').addEventListener('click', () => this.showQrSync());
    const btnScanQr = document.getElementById('btn-scan-qr');
    if (btnScanQr) btnScanQr.addEventListener('click', () => this.scanQrCode());
    const btnQrFileImport = document.getElementById('btn-qr-file-import');
    if (btnQrFileImport) btnQrFileImport.addEventListener('click', () => {
      document.getElementById('qr-file-input').click();
    });
    const qrFileInput = document.getElementById('qr-file-input');
    if (qrFileInput) qrFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) this.importConfigFromFile(e.target.files[0], 'qr');
      e.target.value = '';
    });
    const btnQrManual = document.getElementById('btn-qr-manual-import');
    if (btnQrManual) btnQrManual.addEventListener('click', () => {
      const text = document.getElementById('qr-manual-input').value.trim();
      if (text) this.importFromQr(text);
    });

    // Confirm modal
    document.getElementById('btn-confirm-no').addEventListener('click', () => this.closeModal('modal-confirm'));
    document.getElementById('btn-confirm-yes').addEventListener('click', () => this.handleConfirm());

    // Mention button removed: @ functionality is preserved via typing @ in textarea (group chat only).
    // See handleMentionInput / showMentionDropdown for the type-trigger implementation.

    // Mobile menu toggle
    const menuToggle = document.getElementById('btn-menu-toggle');
    if (menuToggle) menuToggle.addEventListener('click', () => this.toggleMobileSidebar());
    const backdrop = document.getElementById('mobile-backdrop');
    if (backdrop) backdrop.addEventListener('click', () => this.closeMobileSidebar());
  },

  // ============ Mobile sidebar toggle ============
  toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');
    if (sidebar.classList.contains('mobile-open')) {
      this.closeMobileSidebar();
    } else {
      sidebar.classList.add('mobile-open');
      backdrop.classList.add('show');
    }
  },

  closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');
    sidebar.classList.remove('mobile-open');
    backdrop.classList.remove('show');
  },

  openMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');
    if (!sidebar) return;
    sidebar.classList.add('mobile-open');
    if (backdrop) backdrop.classList.add('show');
  },

  // Highlight the active mobile bottom tab (chats / contacts / me)
  setBottomTab(tab) {
    document.querySelectorAll('.bottom-tabbar .tab-item').forEach(el => el.classList.remove('active'));
    const map = { chats: 'tab-chats', contacts: 'tab-contacts', me: 'tab-me' };
    const el = document.getElementById(map[tab]);
    if (el) el.classList.add('active');
  },

  // ============ Navigation ============
  switchNav(nav) {
    this.currentNav = nav;
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('nav-chats').classList.toggle('active', nav === 'chats');
    document.getElementById('nav-contacts').classList.toggle('active', nav === 'contacts');

    document.getElementById('chats-panel').style.display = nav === 'chats' ? 'flex' : 'none';
    document.getElementById('contacts-panel').style.display = nav === 'contacts' ? 'flex' : 'none';

    if (nav === 'contacts') {
      this.renderContactsList();
    }
  },

  // ============ Render all ============
  renderAll() {
    this.renderConvList();
    this.renderActiveChat();
    this.loadSettingsForm();
  },

  // ============ Conversation list ============
  renderConvList(filter = '') {
    const list = document.getElementById('conv-list');
    const convs = Store.getConversations().filter(c => {
      if (!filter) return true;
      return c.name.toLowerCase().includes(filter.toLowerCase());
    });

    if (convs.length === 0) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:#999;font-size:13px;">还没有聊天，点击下方按钮新建</div>';
      return;
    }

    list.innerHTML = convs.map(conv => {
      const isActive = conv.id === Store.data.activeConversationId;
      const lastMsg = conv.lastMessage || '暂无消息';
      const time = this.formatTime(conv.lastMessageTime || conv.createdAt);

      return `
        <div class="conv-item ${isActive ? 'active' : ''}" data-id="${conv.id}">
          <div class="conv-avatar" style="background:${conv.avatarColor || '#6b7280'}">
            ${conv.avatar || (conv.type === 'group' ? '👥' : '🤖')}
          </div>
          <div class="conv-info">
            <div class="conv-name">${this.escapeHtml(conv.name)}</div>
            <div class="conv-last-msg">${this.escapeHtml(lastMsg)}</div>
          </div>
          <div class="conv-time">${time}</div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.conv-item').forEach(item => {
      item.addEventListener('click', () => {
        Store.setActiveConversation(item.dataset.id);
        this.renderConvList();
        this.renderActiveChat();
        this.closeMobileSidebar();
      });
    });
  },

  filterConversations(filter) {
    this.renderConvList(filter);
  },

  // ============ Contacts List (WeChat style) ============
  renderContactsList() {
    const list = document.getElementById('contacts-list');
    const agents = Store.getAgents();

    if (agents.length === 0) {
      list.innerHTML = '<div style="padding:24px;text-align:center;color:#999;font-size:13px;">还没有AI好友，点击+添加</div>';
      return;
    }

    list.innerHTML = agents.map(agent => {
      const configured = agent.apiKey && agent.apiKey.length > 0;
      const roleInfo = AIService.agentRoles[agent.role] || AIService.agentRoles.custom;
      const roleBadge = roleInfo ? `${roleInfo.icon} ${roleInfo.name}` : '✏️ 自定义';
      const channelDisplay = this.getAgentChannelDisplay(agent);

      return `
        <div class="contact-item" data-id="${agent.id}">
          <div class="contact-avatar" style="background:${agent.color || '#4f46e5'}">${agent.avatar || '🤖'}</div>
          <div class="contact-info">
            <div class="contact-name">
              ${this.escapeHtml(agent.name)}
              <span class="contact-rule-badge">${roleBadge}</span>
            </div>
            <div class="contact-desc">${this.escapeHtml(channelDisplay)} ${configured ? '' : '(未配置API Key)'}</div>
          </div>
          <div class="contact-status-dot ${configured ? 'online' : 'offline'}"></div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.contact-item').forEach(item => {
      item.addEventListener('click', () => {
        this.showContactProfile(item.dataset.id);
      });
    });
  },

  // ============ Contact Profile ============
  showContactProfile(agentId) {
    const agent = Store.getAgent(agentId);
    if (!agent) return;

    const configured = agent.apiKey && agent.apiKey.length > 0;
    const roleInfo = AIService.agentRoles[agent.role] || AIService.agentRoles.custom;
    const roleName = roleInfo ? `${roleInfo.icon} ${roleInfo.name}` : '✏️ 自定义';
    const template = AIService.ruleTemplates[agent.ruleTemplate];
    const ruleName = template ? template.name : '自定义';
    const ruleDesc = template ? template.description : '';
    const channelLabel = this.getAgentChannelDisplay(agent);

    // Build rules summary
    const opts = agent.ruleOptions || {};
    const ruleItems = [];
    if (opts.replyToAll) ruleItems.push('回复每个发言者');
    if (opts.labelTarget) ruleItems.push('标注回复对象');
    if (opts.questionOthers) ruleItems.push('反问/质疑他人');
    if (opts.canAgree) ruleItems.push('可以同意他人');
    if (opts.seekConsensus) ruleItems.push('追求达成共识');
    if (opts.outputConsensus) ruleItems.push('输出共识结论文档');

    const content = document.getElementById('contact-profile-content');
    content.innerHTML = `
      <div class="contact-profile">
        <div class="contact-profile-header">
          <div class="contact-profile-avatar" style="background:${agent.color || '#4f46e5'}">${agent.avatar || '🤖'}</div>
          <div class="contact-profile-name">${this.escapeHtml(agent.name)}</div>
          <div class="contact-profile-model">${this.escapeHtml(channelLabel)} ${configured ? '' : '(未配置)'}</div>
        </div>
        <div class="contact-profile-body">
          <div class="contact-profile-row">
            <span class="contact-profile-label">接入方式</span>
            <span class="contact-profile-value">${this.escapeHtml(this.getAgentChannelDisplay(agent))}</span>
          </div>
          <div class="contact-profile-row">
            <span class="contact-profile-label">状态</span>
            <span class="contact-profile-value" style="color:${configured ? 'var(--accent)' : '#fbbf24'}">${configured ? '已配置' : '未配置API Key'}</span>
          </div>
          <div class="contact-profile-row">
            <span class="contact-profile-label">所属角色</span>
            <span class="contact-profile-value">${roleName}</span>
          </div>
          ${agent.rolePrompt ? `
            <div class="contact-profile-rules">
              <strong>角色定位：</strong><br>
              ${this.escapeHtml(agent.rolePrompt)}
            </div>
          ` : ''}
          <div class="contact-profile-row">
            <span class="contact-profile-label">聊天规则</span>
            <span class="contact-profile-value">${ruleName}</span>
          </div>
          ${ruleDesc ? `<div class="contact-profile-rules">${this.escapeHtml(ruleDesc)}</div>` : ''}
          ${ruleItems.length > 0 ? `
            <div class="contact-profile-rules">
              <strong>群聊规则（已启用）：</strong><br>
              ${ruleItems.map(r => '- ' + r).join('<br>')}
            </div>
          ` : ''}
          ${agent.customRules ? `
            <div class="contact-profile-rules">
              <strong>自定义规则：</strong><br>
              ${this.escapeHtml(agent.customRules)}
            </div>
          ` : ''}
        </div>
        <div class="contact-profile-actions">
          <button class="btn-primary" id="btn-profile-chat" ${!configured ? 'disabled' : ''}>发起单聊</button>
          <button class="btn-secondary" id="btn-profile-edit">编辑</button>
          <button class="btn-danger" id="btn-profile-delete">删除</button>
        </div>
      </div>
    `;

    this.openModal('modal-contact-profile');

    document.getElementById('btn-profile-chat').addEventListener('click', () => {
      this.closeModal('modal-contact-profile');
      const conv = Store.createSingleChat(agentId);
      this.switchNav('chats');
      this.renderConvList();
      this.renderActiveChat();
      this.showToast('聊天已创建');
    });

    document.getElementById('btn-profile-edit').addEventListener('click', () => {
      this.closeModal('modal-contact-profile');
      this.openAgentModal(agentId);
    });

    document.getElementById('btn-profile-delete').addEventListener('click', () => {
      this.closeModal('modal-contact-profile');
      this.confirmDeleteAgent(agentId);
    });
  },

  // ============ Active chat ============
  renderActiveChat() {
    const conv = Store.getConversation(Store.data.activeConversationId);

    if (!conv) {
      document.getElementById('chat-empty').style.display = 'flex';
      document.getElementById('chat-active').style.display = 'none';
      this.closeInfoPanel();
      return;
    }

    document.getElementById('chat-empty').style.display = 'none';
    document.getElementById('chat-active').style.display = 'flex';

    // Header
    document.getElementById('chat-header-name').textContent = conv.name;
    let subText = '';
    if (conv.type === 'group') {
      const memberNames = conv.memberAgentIds.map(id => {
        const a = Store.getAgent(id);
        return a ? a.name : '?';
      });
      subText = `${memberNames.length} 个成员：${memberNames.join('、')}`;
      const settings = Store.getSettings();
      const effectiveMax = conv.maxRounds > 0 ? conv.maxRounds : (settings.maxRounds || 0);
      if (effectiveMax > 0) {
        subText += ` | 最多${effectiveMax}轮`;
      }
    } else {
      const agent = Store.getAgent(conv.memberAgentIds[0]);
      if (agent) {
        subText = this.getAgentChannelDisplay(agent);
        if (!agent.apiKey) subText += ' (未配置API Key)';
      }
    }
    document.getElementById('chat-header-sub').textContent = subText;

    // Group member chips bar (WeChat-style add/remove)
    const membersBar = document.getElementById('chat-header-members');
    if (conv.type === 'group') {
      membersBar.style.display = 'flex';
      membersBar.innerHTML = conv.memberAgentIds.map(id => {
        const a = Store.getAgent(id);
        if (!a) return '';
        return `
          <div class="member-chip" data-id="${id}" title="${this.escapeHtml(a.name)}">
            <div class="member-chip-avatar" style="background:${a.color}">${a.avatar}</div>
            <button class="member-chip-remove" data-id="${id}" title="移出群聊">×</button>
          </div>`;
      }).join('') + `
          <button class="member-chip-add" id="btn-add-member" title="添加成员">+</button>`;
    } else {
      membersBar.style.display = 'none';
      membersBar.innerHTML = '';
    }

    // 会话级参考资料 chips（文档/代码）
    this.renderAttachmentChips();

    // Messages
    this.renderMessages();

    // Info panel
    this.renderInfoPanel(conv);
  },

  renderMessages() {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;

    const container = document.getElementById('messages-container');
    const user = Store.getUser();

    if (conv.messages.length === 0) {
      container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#999;gap:8px;">
          <div style="font-size:40px;">${conv.avatar || '💬'}</div>
          <p style="font-size:14px;">${conv.type === 'group' ? '群聊已创建，发送消息开始讨论' : '发送消息开始对话'}</p>
          ${conv.topic ? `<p style="font-size:13px;color:#aaa;">话题：${this.escapeHtml(conv.topic)}</p>` : ''}
          ${conv.type === 'group' && conv.replyOrder ? `<p style="font-size:12px;color:#bbb;">回复顺序：${conv.replyOrder.map(id => { const a = Store.getAgent(id); return a ? a.name : '?'; }).join(' → ')}</p>` : ''}
        </div>
      `;
      return;
    }

    let html = '';
    let lastRound = -1;

    for (const msg of conv.messages) {
      // Insert round divider
      if (msg.senderType === 'user' && conv.type === 'group') {
        lastRound++;
        if (lastRound > 0) {
          html += `<div class="round-divider">第 ${lastRound} 轮讨论</div>`;
        } else {
          html += `<div class="round-divider">讨论开始</div>`;
        }
      }
      html += this.renderMessage(msg, conv);
    }

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  },

  renderMessage(msg, conv) {
    const user = Store.getUser();

    if (msg.senderType === 'system') {
      return `
        <div class="message system">
          <div class="message-bubble">${this.escapeHtml(msg.content)}</div>
        </div>
      `;
    }

    const isUser = msg.senderType === 'user';
    const avatar = isUser ? (user.avatar || '🙂') : (msg.senderAvatar || '🤖');
    const avatarColor = isUser ? '#6b7280' : (msg.senderColor || '#4f46e5');
    const senderName = isUser ? (user.name || '我') : (msg.senderName || 'AI');
    const isError = msg.isError;
    const isStreaming = msg.isStreaming;

    return `
      <div class="message ${isUser ? 'user' : 'agent'} ${isError ? 'message-error' : ''}" data-msg-id="${msg.id}">
        <div class="message-avatar" style="background:${avatarColor}">${avatar}</div>
        <div class="message-content">
          ${conv.type === 'group' || !isUser ? `<div class="message-sender">${this.escapeHtml(senderName)}</div>` : ''}
          <div class="message-bubble ${isStreaming ? 'streaming' : ''}">${this.formatMessageContent(msg.content)}</div>
        </div>
      </div>
    `;
  },

  formatMessageContent(content) {
    if (!content) return '';
    let html = this.escapeHtml(content);

    // Code blocks
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      return `<pre style="background:#1e1e1e;color:#d4d4d4;padding:12px;border-radius:6px;overflow-x:auto;font-size:12px;margin:4px 0;"><code>${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code style="background:#f0f0f0;padding:2px 6px;border-radius:3px;font-size:13px;">$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    return html;
  },

  // ============ Send message ============
  async sendMessage() {
    if (this.isGenerating) {
      this.stopGeneration = true;
      return;
    }

    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;

    // Detect "暂停" / "停止" / "pause" commands → stop auto-continue
    const lower = content.toLowerCase();
    if (conv.type === 'group' && (lower === '暂停' || lower === '停止' || lower === 'pause' || lower === '停')) {
      this.autoContinuePaused = true;
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: '⏸ 已暂停自动讨论。需要时输入任意文字或点击"继续讨论"按钮即可让 AI 继续。',
      });
      input.value = '';
      this.autoResize(input);
      this.renderMessages();
      this.renderConvList();
      return;
    }

    // Detect "重新讨论" / "resume" → re-open current topic after consensus
    if (conv.type === 'group' && conv.consensusReached && (content === '重新讨论' || lower === 'resume' || lower === 'restart')) {
      conv.consensusReached = false;
      conv.discussionRound = 0; // 会从下面的 +1 变成 1
      Store.save();
      input.value = '';
      this.autoResize(input);
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: '🔄 已重新打开当前话题，从头开始新一轮讨论。',
      });
      this.renderMessages();
      // Fall through to the normal send flow (round will be incremented)
    }

    // Detect "继续" / "continue" → resume auto-continue and trigger next round
    if (conv.type === 'group' && (lower === '继续' || lower === '继续讨论' || lower === 'continue')) {
      this.autoContinuePaused = false;
      input.value = '';
      this.autoResize(input);
      this.renderMessages();
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: '▶️ 已恢复自动讨论。',
      });
      this.renderMessages();
      // Kick off another round
      this.isGenerating = true;
      this.updateSendButton();
      conv.discussionRound = (conv.discussionRound || 0) + 1;
      Store.save();

      // Check max rounds before generating
      const contSettings = Store.getSettings();
      const contMaxRounds = conv.maxRounds > 0 ? conv.maxRounds : (contSettings.maxRounds || 0);
      if (contMaxRounds > 0 && conv.discussionRound > contMaxRounds) {
        Store.addMessage(conv.id, {
          senderType: 'system',
          content: `✅ 已达到最大讨论轮次（${contMaxRounds}轮），讨论结束。`,
        });
        this.renderMessages();
        this.isGenerating = false;
        this.updateSendButton();
        return;
      }

      if (conv.type === 'group') {
        await this.generateGroupForConv(conv);
      }
      this.isGenerating = false;
      this.stopGeneration = false;
      this.updateSendButton();
      await this.maybeAutoContinue(conv);
      return;
    }

    // Reset paused state when user genuinely says something new
    this.autoContinuePaused = false;

    // Check if agents are configured
    const unconfigured = conv.memberAgentIds.filter(id => {
      const a = Store.getAgent(id);
      return !a || !a.apiKey;
    });

    if (unconfigured.length === conv.memberAgentIds.length) {
      this.showToast('请先在通讯录中配置AI好友的API Key');
      return;
    }

    // Add user message
    const user = Store.getUser();
    Store.addMessage(conv.id, {
      senderType: 'user',
      senderId: 'user',
      senderName: user.name,
      senderAvatar: user.avatar,
      senderColor: '#6b7280',
      content: content,
    });

    // 共识后用户发送的新消息视作新话题：清掉共识标记并重置轮次（不累加旧值）
    if (conv.type === 'group' && conv.consensusReached) {
      conv.consensusReached = false;
      conv.discussionRound = 0;
      Store.save();
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: '🆕 上一话题已结束。新话题开启，轮次重新计算（第 1 轮）。',
      });
    }

    // Increment round
    conv.discussionRound = (conv.discussionRound || 0) + 1;
    Store.save();

    input.value = '';
    this.autoResize(input);
    this.renderMessages();
    this.renderConvList();

    // Generate AI responses
    this.isGenerating = true;
    this.updateSendButton();

    const settings = Store.getSettings();

    if (conv.type === 'group') {
      // Effective max rounds: conversation's own setting, or fall back to global setting
      const effectiveMaxRounds = conv.maxRounds > 0 ? conv.maxRounds : (settings.maxRounds || 0);
      if (effectiveMaxRounds > 0 && conv.discussionRound > effectiveMaxRounds) {
        Store.addMessage(conv.id, {
          senderType: 'system',
          content: `已达到最大讨论轮次（${effectiveMaxRounds}轮），讨论结束。`,
        });
        this.renderMessages();
      } else {
        await this.generateGroupForConv(conv);
      }
    } else {
      await this.generateSingle(conv);
    }

    this.isGenerating = false;
    this.stopGeneration = false;
    this.updateSendButton();
    this.renderConvList();

    // Group discussion: check consensus and auto-continue if enabled
    if (conv.type === 'group' && !this.autoContinuePaused) {
      await this.maybeAutoContinue(conv);
    }
  },

  // Wrapper for sequential / parallel group generation (kept for backwards compat)
  async generateGroupForConv(conv) {
    const settings = Store.getSettings();
    const mode = settings.replyMode;
    if (mode === 'parallel') {
      await this.generateGroupParallel(conv);
    } else {
      await this.generateGroupSequential(conv);
    }
  },

  // After a group round finishes, decide whether to keep going automatically
  async maybeAutoContinue(conv) {
    if (this.autoContinuePaused) return;
    if (this.stopGeneration) return;

    // 共识已达成后不再自动继续，等待用户抛新话题
    if (conv.consensusReached) return;

    const settings = Store.getSettings();

    // Re-read conv (state may have changed)
    const currentConv = Store.getConversation(conv.id);
    if (!currentConv) return;

    const lastRound = currentConv.discussionRound || 0;
    const lastRoundMessages = currentConv.messages.filter(
      m => m.senderType === 'agent' && (m.round || 0) === lastRound
    );

    // === 共识度计算环节（v1.4.8，由最后一个发言的 AI 执行）===
    // 本轮所有成员都发言后，由最后发言的 AI 收集并整理各方观点、计算共识度（0-100%）。
    // 达到阈值（settings.consensusThreshold）即强制输出共识文档并结束对话；未达则继续讨论。
    if (lastRoundMessages.length >= currentConv.memberAgentIds.length && lastRoundMessages.length > 0) {
      const reached = await this.tryConsensusByDegree(currentConv, lastRoundMessages, settings);
      if (reached) return;
    }

    // Check consensus: do all AIs from the most recent round agree? (关键词判定，作为兜底)
    //  1) 这一轮所有成员都发言了
    //  2) 每个成员的发言都明确包含「同意」/「赞同」/「达成共识」等立场词
    //  3) 每个成员的发言同时包含「理由」/「依据」/「因为」/「数据」等佐证词
    const agreeKeywords = ['同意', '赞同', '达成共识', '一致同意', '认可', '支持'];
    const reasonKeywords = ['理由', '依据', '因为', '由于', '数据', '证据', '研究表明', '论据', '基于'];
    const allAgree =
      lastRoundMessages.length >= currentConv.memberAgentIds.length &&
      lastRoundMessages.length > 0 &&
      lastRoundMessages.every(m => {
        const c = m.content || '';
        const agreeHit = agreeKeywords.some(k => c.includes(k));
        const reasonHit = reasonKeywords.some(k => c.includes(k));
        return agreeHit && reasonHit;
      });

    // 强信号共识判定（v1.4.7 新增）：
    // 现实中往往是「共识整理者」明确写出"无核心分歧 / 已达成共识"等总结，
    // 而其他成员只是表态同意、并未逐字复述关键词。原来的严格判定要求每个成员
    // 都要同时说出立场词+佐证词，几乎永远不成立，导致一直误报"未达成共识"。
    // 这里改为：只要上一轮参与人数达标（>=N-1），且任一条发言出现强共识信号，
    // 即视为达成共识，立即输出共识文档并结束自动轮次。
    const strongSignals = [
      '无核心分歧', '核心分歧：无', '无分歧', '无实质分歧',
      '完全一致', '已达成共识', '共识达成', '无异议', '各方一致', '均表示同意',
    ];
    const participatedLastRound = new Set(
      lastRoundMessages.map(m => m.senderId || m.agentId || m.role)
    ).size;
    const minParticipated = Math.max(1, currentConv.memberAgentIds.length - 1);
    const strongHit =
      lastRoundMessages.length >= minParticipated &&
      participatedLastRound >= minParticipated &&
      lastRoundMessages.some(m => strongSignals.some(s => (m.content || '').includes(s)));

    if (strongHit || allAgree) {
      await this.outputConsensusSummary(currentConv);
      return;
    }

    // 已达最大轮次仍未达成共识 → 强行终止话题
    const effectiveMaxRounds1 = currentConv.maxRounds > 0 ? currentConv.maxRounds : (settings.maxRounds || 0);
    if (effectiveMaxRounds1 > 0 && currentConv.discussionRound >= effectiveMaxRounds1) {
      Store.addMessage(currentConv.id, {
        senderType: 'system',
        content: `✅ 已达到最大讨论轮次（${effectiveMaxRounds1}轮），讨论结束。`,
      });
      this.renderMessages();
      this.renderConvList();
      return;
    }

    // 用户关闭了自动继续 → 不再进入下一轮（共识度计算环节已在上面执行过）
    if (settings.autoContinue === false) return;

    // Show countdown indicator
    const waitSec = 5;
    const thresholdNow = (typeof settings.consensusThreshold === 'number') ? settings.consensusThreshold : 95;
    Store.addMessage(currentConv.id, {
      senderType: 'system',
      content: `⏳ 本轮共识度未达阈值（${thresholdNow}%），${waitSec} 秒后自动进入下一轮...\n（说"暂停"可停止，输入新观点会加入讨论）`,
    });
    this.renderMessages();
    this.renderConvList();

    // Countdown - check every second whether user has interjected
    for (let i = waitSec; i > 0; i--) {
      if (this.stopGeneration) return;
      if (this.autoContinuePaused) return;

      await this.sleep(1000);

      // If user added a new message during countdown, abandon auto-continue
      const refreshed = Store.getConversation(currentConv.id);
      if (refreshed && refreshed.messages.length > currentConv.messages.length + 1) {
        return;
      }
    }

    if (this.stopGeneration || this.autoContinuePaused) return;

    // Increment round and trigger next round
    const finalConv = Store.getConversation(currentConv.id);
    if (!finalConv) return;

    finalConv.discussionRound = (finalConv.discussionRound || 0) + 1;
    Store.save();

    Store.addMessage(finalConv.id, {
      senderType: 'system',
      content: `--- 第 ${finalConv.discussionRound} 轮讨论 ---`,
    });
    this.renderMessages();

    this.isGenerating = true;
    this.updateSendButton();

    // Check max rounds again after incrementing
    const effectiveMaxRounds2 = finalConv.maxRounds > 0 ? finalConv.maxRounds : (settings.maxRounds || 0);
    if (effectiveMaxRounds2 > 0 && finalConv.discussionRound > effectiveMaxRounds2) {
      Store.addMessage(finalConv.id, {
        senderType: 'system',
        content: `✅ 已达到最大讨论轮次（${effectiveMaxRounds2}轮），讨论结束。`,
      });
      this.renderMessages();
    } else {
      await this.generateGroupForConv(finalConv);
    }

    this.isGenerating = false;
    this.stopGeneration = false;
    this.updateSendButton();
    this.renderConvList();

    // Recurse - check again
    await this.maybeAutoContinue(finalConv);
  },

  // 共识度计算环节：由最后一个发言的 AI 收集并整理本轮各方观点、计算共识度（0-100%）。
  // 返回 true 表示已达阈值（已输出共识文档并终止），false 表示未达（交由上层继续讨论）。
  async tryConsensusByDegree(conv, lastRoundMessages, settings) {
    const threshold = (typeof settings.consensusThreshold === 'number') ? settings.consensusThreshold : 95;

    // 最后一个发言的 AI 作为共识计算者
    const lastMsg = lastRoundMessages[lastRoundMessages.length - 1];
    const calculator = Store.getAgent(lastMsg.senderId) ||
      Store.getAgent(conv.memberAgentIds[conv.memberAgentIds.length - 1]);
    if (!calculator || !calculator.apiKey) return false;

    // 收集本轮所有 AI 成员观点（用户不参与共识判定）
    const memberViews = lastRoundMessages.map(m => {
      const a = Store.getAgent(m.senderId);
      const name = (a && a.name) || m.senderName || '?';
      return `【${name}】\n${(m.content || '').slice(0, 2000)}`;
    }).join('\n\n');

    Store.addMessage(conv.id, {
      senderType: 'system',
      content: `📊 进入共识度计算环节（由本轮最后发言的 ${calculator.name} 执行）…`,
    });
    this.renderMessages();

    const prompt =
      `你是本轮最后发言的 AI（${calculator.name}），现在以"共识整理者"身份进入【共识度计算】环节。\n\n` +
      `以下是本轮所有 AI 成员的观点（用户不参与共识判定）：\n${memberViews}\n\n` +
      `请完成：\n` +
      `1. 用一句话归纳各方的核心立场与结论。\n` +
      `2. 判断各方在"结论 / 建议 / 关键事实"上的语义一致程度。\n` +
      `3. 给出共识度 consensusDegree（0-100 的整数，代表各方立场语义一致的比例）。\n` +
      `4. 若 consensusDegree >= ${threshold}，请额外输出一份完整共识文档 consensusDoc（Markdown，包含：①讨论主题 ②达成的共识要点 ③各方主要贡献 ④最终结论与可执行建议 ⑤遗留分歧）。\n\n` +
      `仅输出如下 JSON，不要输出 JSON 以外的任何内容：\n` +
      `{"consensusDegree": <int 0-100>, "coreView": "<一句话归纳>", "consensusDoc": "<达阈值时的完整文档，否则为空字符串>"}`;

    const calcMessages = [];
    if (calculator.systemPrompt) calcMessages.push({ role: 'system', content: calculator.systemPrompt });
    calcMessages.push({ role: 'user', content: prompt });

    let raw;
    try {
      raw = await AIService.request(calculator, calcMessages);
    } catch (e) {
      // 计算失败 → 回退到关键词判定
      return false;
    }

    const parsed = this.parseConsensusJson(raw);
    if (!parsed) return false;
    const degree = Number(parsed.consensusDegree);
    if (!Number.isFinite(degree)) return false;

    const reached = degree >= threshold;
    const calcText =
      `📊 **共识度计算报告**（${calculator.name}）\n` +
      `· 各方核心立场：${parsed.coreView || '（未提供）'}\n` +
      `· 本轮共识度：**${degree}%**（阈值 ${threshold}%）\n` +
      `· 结论：${reached ? '已达阈值 ✅ 输出共识文档' : '未达阈值，继续讨论 🔄'}`;
    Store.addMessage(conv.id, {
      senderType: 'agent',
      senderId: calculator.id,
      senderName: calculator.name,
      senderAvatar: calculator.avatar,
      senderColor: calculator.color,
      content: calcText,
      round: conv.discussionRound,
      isConsensusCalc: true,
    });
    this.renderMessages();

    if (reached) {
      await this.outputConsensusSummary(conv, {
        doc: (parsed.consensusDoc && parsed.consensusDoc.trim()) ? parsed.consensusDoc : (parsed.coreView || ''),
        degree: degree,
        author: calculator,
      });
      return true;
    }
    return false;
  },

  // 从可能夹杂说明文字的模型返回中尽量解析出 JSON 对象
  parseConsensusJson(raw) {
    if (!raw) return null;
    const s = (raw || '').trim();
    try { return JSON.parse(s); } catch (e) { /* try slice below */ }
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(s.slice(first, last + 1)); } catch (e) { /* give up */ }
    }
    return null;
  },

  // Force a designated AI (consensus builder) to output the consensus doc
  async outputConsensusSummary(conv, prebuilt) {
    // Find the consensus_builder agent if any, else use first member
    const members = conv.memberAgentIds.map(id => Store.getAgent(id)).filter(a => a);
    const summarizer = members.find(a => a.ruleTemplate === 'consensus_builder') || members[0];
    if (!summarizer) return;

    // Mark consensus reached so that:
    //  - maybeAutoContinue won't trigger another round
    //  - user knows the topic is closed
    conv.consensusReached = true;
    Store.save();

    // 预生成文档路径（共识度计算环节直接产出）：直接落盘，不重复调用模型
    if (prebuilt && prebuilt.doc && prebuilt.doc.trim()) {
      const author = prebuilt.author || summarizer;
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: `🎉 共识度达 ${prebuilt.degree != null ? prebuilt.degree : ''}%，所有参与者已达成共识！${author.name} 整理的共识文档如下：`,
      });
      this.renderMessages();
      Store.addMessage(conv.id, {
        senderType: 'agent',
        senderId: author.id,
        senderName: author.name,
        senderAvatar: author.avatar,
        senderColor: author.color,
        content: prebuilt.doc,
        round: conv.discussionRound,
        isConsensusDoc: true,
      });
      this.renderMessages();
      this.appendConsensusClosedNote(conv);
      this.renderConvList();
      return;
    }

    Store.addMessage(conv.id, {
      senderType: 'system',
      content: `🎉 所有参与者似乎已达成共识！${summarizer.name} 正在输出共识总结...`,
    });
    this.renderMessages();

    this.isGenerating = true;
    this.updateSendButton();

    try {
      const messages = AIService.buildMessages(summarizer, conv, { round: conv.discussionRound });
      // Force a consensus-output prompt
      messages.push({
        role: 'user',
        content: '【系统提示】所有参与者似乎已达成共识。请输出一份正式的共识结论文档，包含：\n1. 讨论主题\n2. 达成的共识要点（编号列出）\n3. 各方主要贡献\n4. 最终结论与可执行建议\n5. 如有遗留分歧，请明确列出',
      });
      if (summarizer.stream) {
        const msgId = Store.genId();
        conv.messages.push({
          id: msgId,
          senderType: 'agent',
          senderId: summarizer.id,
          senderName: summarizer.name,
          senderAvatar: summarizer.avatar,
          senderColor: summarizer.color,
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
          round: conv.discussionRound,
        });
        Store.save();
        this.renderMessages();
        await this.callAgentStream(summarizer, messages, conv.id, msgId);
      } else {
        const content = await AIService.request(summarizer, messages);
        Store.addMessage(conv.id, {
          senderType: 'agent',
          senderId: summarizer.id,
          senderName: summarizer.name,
          senderAvatar: summarizer.avatar,
          senderColor: summarizer.color,
          content: content,
          round: conv.discussionRound,
        });
        this.renderMessages();
      }
    } catch (e) {
      // Consensus output failed - clear flag so future messages can still flow
      conv.consensusReached = false;
      Store.save();
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: `共识总结失败: ${e.message}`,
      });
      this.renderMessages();
    }

    this.isGenerating = false;
    this.stopGeneration = false;
    this.updateSendButton();
    this.renderConvList();

    // Tell user clearly: topic closed, waiting for their next move
    if (conv.consensusReached) {
      this.appendConsensusClosedNote(conv);
    }
  },

  // 追加"话题已结束"系统提示（共识达成后统一复用）
  appendConsensusClosedNote(conv) {
    Store.addMessage(conv.id, {
      senderType: 'system',
      content: `🛑 本次话题已达成共识，自动讨论已停止。\n\n👉 请等待你抛出新的疑问或新话题后，AI们会重新开始一轮讨论（轮次不会沿用之前的累加数，会重新计算）。\n\n小提示：直接发新消息即可；要说"重新讨论"也可以恢复当前话题。`,
    });
    this.renderMessages();
    this.renderConvList();
  },

  // Single chat response
  async generateSingle(conv) {
    const agent = Store.getAgent(conv.memberAgentIds[0]);
    if (!agent || !agent.apiKey) {
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: 'AI好友未配置API Key，请在通讯录中配置。',
      });
      this.renderMessages();
      return;
    }

    await this.callAgent(conv, agent, {});
  },

  // Group chat: sequential (follows reply order)
  async generateGroupSequential(conv) {
    const settings = Store.getSettings();
    // Use replyOrder if available, otherwise use memberAgentIds
    const order = conv.replyOrder && conv.replyOrder.length > 0 ? conv.replyOrder : conv.memberAgentIds;
    const agents = order
      .map(id => Store.getAgent(id))
      .filter(a => a && a.apiKey);

    if (agents.length === 0) {
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: '没有已配置的AI好友，请先在通讯录中配置API Key。',
      });
      this.renderMessages();
      return;
    }

    // v1.4.5: 被 @ 提到的 AI 优先回复
    const reordered = this.reorderByMentions(conv, agents);

    for (const agent of reordered) {
      if (this.stopGeneration) break;

      if (settings.replyDelay > 0) {
        await this.sleep(settings.replyDelay);
      }

      if (this.stopGeneration) break;
      await this.callAgent(conv, agent, { round: conv.discussionRound });
    }
  },

  // @ 提及优先级：解析最近若干条消息里的 @名字，把被 @ 的 agent 提升到顺序最前
  parseMentionedAgentIds(conv) {
    const members = conv.memberAgentIds.map(id => Store.getAgent(id)).filter(a => a);
    const recent = conv.messages.slice(-30);
    const ids = [];
    const re = /@([^\s@,，。;；:：、]+)/g;
    for (const m of recent) {
      if (!m || !m.content) continue;
      if (m.senderType !== 'user' && m.senderType !== 'agent') continue;
      const text = m.content;
      re.lastIndex = 0;
      let match;
      while ((match = re.exec(text)) !== null) {
        const name = match[1].trim();
        if (!name) continue;
        let hit = members.find(a => a.name === name);
        if (!hit) hit = members.find(a => a.name.includes(name) || name.includes(a.name));
        if (hit && !ids.includes(hit.id)) ids.push(hit.id);
      }
    }
    return ids;
  },

  reorderByMentions(conv, agents) {
    const mentionedIds = this.parseMentionedAgentIds(conv);
    if (mentionedIds.length === 0) return agents;
    const mentionedAgents = [];
    const restAgents = [];
    for (const a of agents) {
      if (mentionedIds.includes(a.id)) mentionedAgents.push(a);
      else restAgents.push(a);
    }
    if (mentionedAgents.length > 0) {
      const lastUserMsg = [...conv.messages].reverse().find(m => m.senderType === 'user');
      const lastHasAt = lastUserMsg && lastUserMsg.content && /@\S+/.test(lastUserMsg.content);
      const lastSys = [...conv.messages].reverse().find(m => m.senderType === 'system');
      const alreadyShown = lastSys && lastSys.content && lastSys.content.includes('被提及');
      // 用户消息中已写明 @ 时不要重复系统提示
      if (!lastHasAt && !alreadyShown) {
        const names = mentionedAgents.map(a => a.name).join('、');
        Store.addMessage(conv.id, {
          senderType: 'system',
          content: '🔔 ' + names + ' 被提及，将优先回复',
        });
        this.renderMessages();
      }
    }
    return [...mentionedAgents, ...restAgents];
  },

  // Group chat: parallel
  async generateGroupParallel(conv) {
    const agents = conv.memberAgentIds
      .map(id => Store.getAgent(id))
      .filter(a => a && a.apiKey);

    if (agents.length === 0) {
      Store.addMessage(conv.id, {
        senderType: 'system',
        content: '没有已配置的AI好友，请先在通讯录中配置API Key。',
      });
      this.renderMessages();
      return;
    }

    await Promise.all(agents.map(agent => this.callAgent(conv, agent, { round: conv.discussionRound })));
  },

  // Call a single agent
  async callAgent(conv, agent, extraContext) {
    const latestConv = Store.getConversation(conv.id);
    const messages = AIService.buildMessages(agent, latestConv, extraContext);

    // Create a placeholder message for streaming
    const msgId = Store.genId();
    const currentRound = extraContext.round !== undefined ? extraContext.round : (conv.discussionRound || 0);
    const placeholderMsg = {
      id: msgId,
      senderType: 'agent',
      senderId: agent.id,
      senderName: agent.name,
      senderAvatar: agent.avatar,
      senderColor: agent.color,
      content: '',
      timestamp: Date.now(),
      isStreaming: true,
      round: currentRound,
    };

    latestConv.messages.push(placeholderMsg);
    Store.save();
    this.renderMessages();

    let finalContent = '';
    let streamError = null;

    try {
      if (agent.stream) {
        finalContent = await this.callAgentStream(agent, messages, conv.id, msgId);
      } else {
        finalContent = await AIService.request(agent, messages);
        Store.updateMessage(conv.id, msgId, {
          content: finalContent,
          isStreaming: false,
        });
        this.renderMessages();
      }
    } catch (e) {
      streamError = e;
    }

    // Detect empty / no response and replace with friendly message
    const trimmedContent = (finalContent || '').trim();
    if (!trimmedContent) {
      const errMsg = streamError
        ? `错误: ${streamError.message}`
        : '（该 AI 此次未返回内容，请重试）';
      Store.updateMessage(conv.id, msgId, {
        content: errMsg,
        isStreaming: false,
        isError: !streamError,
      });
      this.renderMessages();
      return trimmedContent;
    }

    return trimmedContent;
  },

  // Streaming call
  async callAgentStream(agent, messages, convId, msgId) {
    return new Promise((resolve, reject) => {
      const requestId = Store.genId();
      let settled = false; // guard against double-resolve/reject

      this.streamListeners.set(requestId, {
        onChunk: (chunk) => {
          if (this.stopGeneration) return;
          const conv = Store.getConversation(convId);
          const msg = conv.messages.find(m => m.id === msgId);
          if (msg) {
            msg.content += chunk;
            this.updateStreamingMessage(convId, msgId);
          }
        },
        onEnd: (fullContent) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          Store.updateMessage(convId, msgId, {
            content: fullContent,
            isStreaming: false,
          });
          this.renderMessages();
          this.streamListeners.delete(requestId);
          resolve(fullContent);
        },
        onError: (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          Store.updateMessage(convId, msgId, {
            content: `错误: ${error}`,
            isStreaming: false,
            isError: true,
          });
          this.renderMessages();
          this.streamListeners.delete(requestId);
          reject(new Error(error));
        },
      });

      const streamCallbacks = this.streamListeners.get(requestId);

      // Safety timeout: if no stream end/error within 90s, force-reject
      const timeoutId = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.streamListeners.delete(requestId);
        Store.updateMessage(convId, msgId, {
          content: '错误: 请求超时（90秒无响应）',
          isStreaming: false,
          isError: true,
        });
        this.renderMessages();
        reject(new Error('请求超时（90秒无响应）'));
      }, 90000);

      APIBridge.aiRequestStream({
        url: agent.apiUrl,
        apiKey: agent.apiKey,
        requestId: requestId,
        body: AIService._adaptRequestBody({
          model: agent.model,
          messages: messages,
          temperature: agent.temperature || 0.7,
          max_tokens: agent.maxTokens || 2048,
          stream: true,
        }, agent.apiUrl),
      }, {
        onChunk: (content) => streamCallbacks.onChunk && streamCallbacks.onChunk(content),
        onEnd: (fullContent) => streamCallbacks.onEnd && streamCallbacks.onEnd(fullContent),
        onError: (error) => streamCallbacks.onError && streamCallbacks.onError(error),
      }).then(result => {
        // If the IPC returned a non-success result (e.g. non-2xx HTTP status),
        // reject the promise.  We check !result.success (NOT result.error)
        // because some error responses have an empty body, which would make
        // result.error falsy and leave the promise hanging forever.
        if (settled) return;
        if (!result || !result.success) {
          const errMsg = (result && result.error) ? result.error : '请求失败（未知错误）';
          const statusCode = (result && result.statusCode) ? ` (HTTP ${result.statusCode})` : '';
          Store.updateMessage(convId, msgId, {
            content: `错误${statusCode}: ${errMsg}`,
            isStreaming: false,
            isError: true,
          });
          this.renderMessages();
          this.streamListeners.delete(requestId);
          clearTimeout(timeoutId);
          settled = true;
          reject(new Error(errMsg));
        }
        // If result.success is true, the onEnd callback already resolved the promise
      }).catch(e => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        this.streamListeners.delete(requestId);
        reject(e);
      });
    });
  },

  updateStreamingMessage(convId, msgId) {
    const conv = Store.getConversation(convId);
    const msg = conv.messages.find(m => m.id === msgId);
    if (!msg) return;

    const container = document.getElementById('messages-container');
    const msgEl = container.querySelector(`[data-msg-id="${msgId}"] .message-bubble`);
    if (msgEl) {
      msgEl.innerHTML = this.formatMessageContent(msg.content);
      container.scrollTop = container.scrollHeight;
    }
  },

  // ============ Agent modal (Add/Edit AI Friend) ============
  openAgentModal(agentId = null) {
    const title = document.getElementById('agent-modal-title');

    // 先填接入方式下拉
    this.populateChannelSelect();

    // Reset form
    document.getElementById('agent-channel').value = '';
    document.getElementById('agent-ai-model').value = '';
    document.getElementById('agent-ai-model').innerHTML = '<option value="">-- 再选择AI --</option>';
    document.getElementById('agent-name').value = '';
    document.getElementById('agent-avatar').value = '';
    document.getElementById('agent-api-url').value = '';
    document.getElementById('agent-api-key').value = '';
    document.getElementById('agent-model').value = '';
    document.getElementById('agent-system-prompt').value = '';
    document.getElementById('agent-temperature').value = '0.7';
    document.getElementById('agent-max-tokens').value = '2048';
    document.getElementById('agent-stream').checked = true;
    // 新的人设字段（所属角色 + 角色定位）
    document.getElementById('agent-role').value = 'custom';
    document.getElementById('agent-role-prompt').value = '';
    this.updateRoleDesc('custom');
    // 行为规则（聊天规则 + 群聊规则）
    document.getElementById('agent-rule-template').value = 'strategic_advisor';
    document.getElementById('agent-custom-rules').value = '';
    document.getElementById('rule-reply-to-all').checked = false;
    document.getElementById('rule-label-target').checked = false;
    document.getElementById('rule-question-others').checked = false;
    document.getElementById('rule-can-agree').checked = false;
    // 追求达成共识 + 输出共识结论文档 + 简单问题/不展开/共识后不拆解 是群聊必备规则，新成员默认勾选，用户可自行取消
    document.getElementById('rule-seek-consensus').checked = true;
    document.getElementById('rule-output-consensus').checked = true;
    document.getElementById('rule-simple-answer').checked = true;
    document.getElementById('rule-no-expand').checked = true;
    document.getElementById('rule-no-redissect-consensus').checked = true;
    document.getElementById('test-result').style.display = 'none';
    document.getElementById('channel-info').style.display = 'none';
    document.getElementById('api-key-hint').style.display = 'none';
    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.color-option[data-color="#4f46e5"]').classList.add('selected');
    this.updateRuleTemplateDesc('strategic_advisor');

    if (agentId) {
      const agent = Store.getAgent(agentId);
      if (agent) {
        title.textContent = '编辑 AI 好友';
        document.getElementById('agent-name').value = agent.name || '';
        document.getElementById('agent-avatar').value = agent.avatar || '';
        document.getElementById('agent-api-url').value = agent.apiUrl || '';
        document.getElementById('agent-api-key').value = agent.apiKey || '';
        document.getElementById('agent-model').value = agent.model || '';
        document.getElementById('agent-system-prompt').value = agent.systemPrompt || '';
        document.getElementById('agent-temperature').value = agent.temperature || 0.7;
        document.getElementById('agent-max-tokens').value = agent.maxTokens || 2048;
        document.getElementById('agent-stream').checked = agent.stream !== false;
        // 回填角色
        document.getElementById('agent-role').value = agent.role || 'custom';
        document.getElementById('agent-role-prompt').value = agent.rolePrompt || '';
        this.updateRoleDesc(agent.role || 'custom');
        // 回填规则
        document.getElementById('agent-rule-template').value = agent.ruleTemplate || 'custom';
        document.getElementById('agent-custom-rules').value = agent.customRules || '';
        this.updateRuleTemplateDesc(agent.ruleTemplate || 'custom');

        const opts = agent.ruleOptions || {};
        document.getElementById('rule-reply-to-all').checked = !!opts.replyToAll;
        document.getElementById('rule-label-target').checked = !!opts.labelTarget;
        document.getElementById('rule-question-others').checked = !!opts.questionOthers;
        document.getElementById('rule-can-agree').checked = !!opts.canAgree;
        document.getElementById('rule-seek-consensus').checked = !!opts.seekConsensus;
        document.getElementById('rule-output-consensus').checked = !!opts.outputConsensus;
        document.getElementById('rule-simple-answer').checked = opts.simpleAnswer !== false; // 默认勾选，缺省视为 true
        document.getElementById('rule-no-expand').checked = opts.noExpand !== false;
        document.getElementById('rule-no-redissect-consensus').checked = opts.noRedissectConsensus !== false;

        if (agent.color) {
          document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
          const colorOpt = document.querySelector(`.color-option[data-color="${agent.color}"]`);
          if (colorOpt) colorOpt.classList.add('selected');
        }

        // v1.4.5: 接入方式优先的级联。先恢复 channel，再恢复 modelKey
        // 旧 aiModel+channel 数据会自动迁移到新 (channel, modelKey) 结构
        if (agent.channel) {
          document.getElementById('agent-channel').value = agent.channel;

          // 模型 key：旧数据存的是 aiModel 作为"AI 名称"；新版可能直接存了新 modelKey
          // 如果 agent.aiModel 恰好等于新 modelKey，直接使用；否则用 legacyModelMap 映射
          let modelKey = agent.aiModel;
          const modelsInChannel = AIService.getModelsForChannel(agent.channel);
          if (!modelsInChannel[modelKey]) {
            // 旧 aiModel 不是新 key 形式，查 legacyModelMap
            const legacy = AIService.lookupLegacy(agent.aiModel, agent.channel);
            if (legacy && legacy.channel === agent.channel) {
              modelKey = legacy.modelKey;
            } else {
              // 最后兜底：用通道下第一个模型
              modelKey = Object.keys(modelsInChannel)[0] || '';
            }
          }

          this.populateAIModelSelect(agent.channel);
          if (modelKey && modelsInChannel[modelKey]) {
            document.getElementById('agent-ai-model').value = modelKey;
            this.applyModelConfig(agent.channel, modelKey);
          }
          // Restore user-edited values that may differ from preset
          document.getElementById('agent-name').value = agent.name || '';
          document.getElementById('agent-avatar').value = agent.avatar || '';
          document.getElementById('agent-api-url').value = agent.apiUrl || '';
          document.getElementById('agent-model').value = agent.model || '';
          document.getElementById('agent-system-prompt').value = agent.systemPrompt || '';
        }

        this._editingAgentId = agentId;
      }
    } else {
      title.textContent = '添加 AI 好友';
      this._editingAgentId = null;
    }

    this.openModal('modal-agent');
  },

  // ============ Agent role selector ============
  onAgentRoleChange(roleKey) {
    if (!roleKey) return;
    this.updateRoleDesc(roleKey);

    // 自动填充默认角色定位（编辑模式且已有内容时不覆盖）
    const promptEl = document.getElementById('agent-role-prompt');
    const role = AIService.agentRoles[roleKey];
    if (role && roleKey !== 'custom') {
      const isEditing = !!this._editingAgentId;
      const currentVal = (promptEl.value || '').trim();
      if (!isEditing || !currentVal) {
        promptEl.value = role.defaultPrompt || '';
      }
    }
  },

  updateRoleDesc(roleKey) {
    const descEl = document.getElementById('role-desc');
    const role = AIService.agentRoles[roleKey];
    if (!role) {
      descEl.style.display = 'none';
      return;
    }
    descEl.style.display = 'block';
    descEl.innerHTML = `<strong>${role.icon || ''} ${role.name}</strong>${role.defaultPrompt ? ' — ' + this.escapeHtml(role.defaultPrompt.slice(0, 60)) + (role.defaultPrompt.length > 60 ? '…' : '') : '（不指定业务角色，由你自己定义人设）'}`;
  },

  updateRuleTemplateDesc(templateKey) {
    const descEl = document.getElementById('rule-template-desc');
    const template = AIService.ruleTemplates[templateKey];
    if (template && template.description) {
      descEl.textContent = template.description;
      descEl.style.display = 'block';

      // Auto-check relevant rules based on template
      if (templateKey === 'strategic_advisor') {
        this._autoCheckRules({ replyToAll: true, labelTarget: true, questionOthers: true, canAgree: true, seekConsensus: true, outputConsensus: true });
      } else if (templateKey === 'first_principles') {
        this._autoCheckRules({ replyToAll: true, labelTarget: true, questionOthers: true, canAgree: true, seekConsensus: true, outputConsensus: true });
      } else if (templateKey === 'socratic') {
        this._autoCheckRules({ replyToAll: true, labelTarget: true, questionOthers: true, canAgree: true, seekConsensus: true, outputConsensus: false });
      } else if (templateKey === 'devils_advocate') {
        this._autoCheckRules({ replyToAll: true, labelTarget: true, questionOthers: true, canAgree: false, seekConsensus: false, outputConsensus: false });
      } else if (templateKey === 'consensus_builder') {
        this._autoCheckRules({ replyToAll: true, labelTarget: true, questionOthers: true, canAgree: true, seekConsensus: true, outputConsensus: true });
      } else if (templateKey === 'analyst') {
        this._autoCheckRules({ replyToAll: false, labelTarget: false, questionOthers: true, canAgree: true, seekConsensus: false, outputConsensus: false });
      }
    } else {
      descEl.style.display = 'none';
    }
  },

  _autoCheckRules(opts) {
    // Only auto-check if this is a new agent (not editing)
    if (!this._editingAgentId) {
      document.getElementById('rule-reply-to-all').checked = !!opts.replyToAll;
      document.getElementById('rule-label-target').checked = !!opts.labelTarget;
      document.getElementById('rule-question-others').checked = !!opts.questionOthers;
      document.getElementById('rule-can-agree').checked = !!opts.canAgree;
      document.getElementById('rule-seek-consensus').checked = !!opts.seekConsensus;
      document.getElementById('rule-output-consensus').checked = !!opts.outputConsensus;
      document.getElementById('rule-simple-answer').checked = opts.simpleAnswer !== false;
      document.getElementById('rule-no-expand').checked = opts.noExpand !== false;
      document.getElementById('rule-no-redissect-consensus').checked = opts.noRedissectConsensus !== false;
    }
  },

  // ============ Cascading 接入方式 → AI Model selector (v1.4.5) ============

  // 先填充接入方式下拉（顺序：官网直连 / openZen / openCode-go / OpenRouter / WorkBuddy / TokenHub）
  populateChannelSelect() {
    const select = document.getElementById('agent-channel');
    select.innerHTML = '<option value="">-- 先选择接入方式 --</option>';
    for (const [key, ch] of Object.entries(AIService.getChannels())) {
      const badge = ch.badge ? ` [${ch.badge}]` : '';
      select.innerHTML += `<option value="${key}">${ch.label}${badge}</option>`;
    }
  },

  // 选择接入方式后，弹出该通道下所有可用 AI 模型
  populateAIModelSelect(channel) {
    const select = document.getElementById('agent-ai-model');
    select.innerHTML = '<option value="">-- 再选择AI --</option>';
    if (!channel) return;
    const models = AIService.getModelsForChannel(channel);
    for (const [key, m] of Object.entries(models)) {
      const badge = m.badge ? ` [${m.badge}]` : '';
      select.innerHTML += `<option value="${key}">${this.escapeHtml(m.name)}${badge}</option>`;
    }
  },

  // 选 channel → 自动填模型下拉（不自动选中模型，让用户主动选）
  onChannelChange(channel) {
    if (!channel) return;
    this.populateAIModelSelect(channel);
    // 清除已选模型、API url 等
    document.getElementById('agent-name').value = '';
    document.getElementById('agent-avatar').value = '';
    document.getElementById('agent-api-url').value = '';
    document.getElementById('agent-model').value = '';
    document.getElementById('agent-api-key').placeholder = 'sk-...';
    document.getElementById('api-key-hint').style.display = 'none';
    document.getElementById('channel-info').style.display = 'none';
  },

  // 选模型 → 应用配置
  onAIModelChange(modelKey) {
    if (!modelKey) return;
    const channel = document.getElementById('agent-channel').value;
    if (!channel) return;
    this.applyModelConfig(channel, modelKey);
  },

  applyModelConfig(channel, modelKey) {
    const config = AIService.getConfig(channel, modelKey);
    if (!config) return;

    document.getElementById('agent-name').value = config.name;
    document.getElementById('agent-avatar').value = config.avatar;
    document.getElementById('agent-api-url').value = config.apiUrl;
    document.getElementById('agent-model').value = config.model;
    document.getElementById('agent-system-prompt').value = config.systemPrompt;

    // Update API key placeholder and hint
    document.getElementById('agent-api-key').placeholder = config.keyPlaceholder || 'sk-...';
    const hintEl = document.getElementById('api-key-hint');
    hintEl.textContent = config.keyHint || '';
    hintEl.style.display = config.keyHint ? 'block' : 'none';

    // Update channel info box
    const infoEl = document.getElementById('channel-info');
    let badgeHtml = '';
    if (config.badge === '免费') {
      badgeHtml = '<span class="badge badge-free">免费模型</span>';
    } else if (config.badge === '订阅') {
      badgeHtml = '<span class="badge badge-sub">需订阅</span>';
    } else if (config.badge === '已付费') {
      badgeHtml = '<span class="badge badge-paid">已付费</span>';
    }
    infoEl.innerHTML = `<strong>${config.name}</strong> via ${config.channelLabel}${badgeHtml}<br>模型ID: <code>${config.model}</code>`;
    infoEl.style.display = 'block';

    // Update color
    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
    const colorOpt = document.querySelector(`.color-option[data-color="${config.color}"]`);
    if (colorOpt) colorOpt.classList.add('selected');
  },

  // ============ Update checking ============
  async checkForUpdates(manual = false) {
    try {
      const result = await APIBridge.checkForUpdates();
      if (result.hasUpdate) {
        this.showUpdateBar(result.version, result.releaseNotes || '');
        if (manual) {
          document.getElementById('update-status').innerHTML =
            `<span style="color:var(--accent);">发现新版本 v${result.version}！点击上方"立即更新"按钮下载。</span>`;
        }
      } else {
        if (manual) {
          document.getElementById('update-status').innerHTML =
            `<span style="color:var(--text-secondary);">当前已是最新版本 (v${result.currentVersion})</span>`;
        }
      }
    } catch (e) {
      if (manual) {
        document.getElementById('update-status').innerHTML =
          `<span style="color:#dc2626;">检查更新失败: ${e.message}</span>`;
      }
    }
  },

  showUpdateBar(version, notes) {
    const bar = document.getElementById('update-bar');
    document.getElementById('update-bar-text').textContent =
      `发现新版本 v${version}，建议更新以获得最新功能。${notes ? ' ' + notes : ''}`;
    bar.style.display = 'flex';
  },

  dismissUpdateBar() {
    document.getElementById('update-bar').style.display = 'none';
  },

  async downloadUpdate() {
    const btn = document.getElementById('btn-download-update');
    btn.disabled = true;
    btn.textContent = '下载中...';

    try {
      const result = await APIBridge.downloadUpdate();
      if (result.success) {
        btn.textContent = '下载完成，正在安装...';
        // The installer will be launched by main process
      } else {
        btn.disabled = false;
        btn.textContent = '立即更新';
        this.showToast('下载失败: ' + (result.error || '未知错误'));
      }
    } catch (e) {
      btn.disabled = false;
      btn.textContent = '立即更新';
      this.showToast('下载失败: ' + e.message);
    }
  },

  saveAgent() {
    const name = document.getElementById('agent-name').value.trim();
    if (!name) {
      this.showToast('请输入名称');
      return;
    }

    const selectedColor = document.querySelector('.color-option.selected');
    const color = selectedColor ? selectedColor.dataset.color : '#4f46e5';

    const agentData = {
      name: name,
      avatar: document.getElementById('agent-avatar').value.trim() || '\u{1F916}',
      color: color,
      channel: document.getElementById('agent-channel').value || 'official',
      // v1.4.5: aiModel 字段现在存的是接入方式下的具体 model key（如 kimi_k3、gpt_5_4_mini）
      aiModel: document.getElementById('agent-ai-model').value || '',
      apiUrl: document.getElementById('agent-api-url').value.trim(),
      apiKey: document.getElementById('agent-api-key').value.trim(),
      model: document.getElementById('agent-model').value.trim(),
      role: document.getElementById('agent-role').value || 'custom',
      rolePrompt: document.getElementById('agent-role-prompt').value.trim(),
      systemPrompt: document.getElementById('agent-system-prompt').value.trim(),
      temperature: parseFloat(document.getElementById('agent-temperature').value) || 0.7,
      maxTokens: parseInt(document.getElementById('agent-max-tokens').value) || 2048,
      stream: document.getElementById('agent-stream').checked,
      ruleTemplate: document.getElementById('agent-rule-template').value,
      ruleOptions: {
        replyToAll: document.getElementById('rule-reply-to-all').checked,
        labelTarget: document.getElementById('rule-label-target').checked,
        questionOthers: document.getElementById('rule-question-others').checked,
        canAgree: document.getElementById('rule-can-agree').checked,
        seekConsensus: document.getElementById('rule-seek-consensus').checked,
        outputConsensus: document.getElementById('rule-output-consensus').checked,
        simpleAnswer: document.getElementById('rule-simple-answer').checked,
        noExpand: document.getElementById('rule-no-expand').checked,
        noRedissectConsensus: document.getElementById('rule-no-redissect-consensus').checked,
      },
      customRules: document.getElementById('agent-custom-rules').value.trim(),
    };

    if (this._editingAgentId) {
      Store.updateAgent(this._editingAgentId, agentData);
    } else {
      Store.addAgent(agentData);
    }

    Store.save();
    this.closeModal('modal-agent');
    this.renderContactsList();
    this.renderConvList();
    this.showToast('保存成功');
  },

  async testAgent() {
    const btn = document.getElementById('btn-test-agent');
    const resultEl = document.getElementById('test-result');
    btn.disabled = true;
    btn.textContent = '测试中...';
    resultEl.style.display = 'none';

    const agent = {
      name: document.getElementById('agent-name').value,
      apiUrl: document.getElementById('agent-api-url').value.trim(),
      apiKey: document.getElementById('agent-api-key').value.trim(),
      model: document.getElementById('agent-model').value.trim(),
      systemPrompt: document.getElementById('agent-system-prompt').value.trim(),
      temperature: 0.7,
      maxTokens: 50,
    };

    const result = await AIService.testConnection(agent);

    btn.disabled = false;
    btn.textContent = '测试连接';
    resultEl.style.display = 'block';

    if (result.success) {
      resultEl.className = 'test-result success';
      resultEl.textContent = `连接成功！AI回复：${result.response}`;
    } else {
      resultEl.className = 'test-result error';
      resultEl.textContent = `连接失败：${result.error}`;
    }
  },

  confirmDeleteAgent(agentId) {
    const agent = Store.getAgent(agentId);
    if (!agent) return;
    this.showConfirm('删除AI好友', `确定删除「${agent.name}」吗？相关聊天也会被删除。`, () => {
      Store.deleteAgent(agentId);
      this.renderContactsList();
      this.renderConvList();
      this.renderActiveChat();
      this.showToast('已删除');
    });
  },

  // ============ New group flow (WeChat style) ============
  openNewGroupModal() {
    this.groupStep = 1;
    this.selectedFriends = [];
    this.replyOrder = [];
    this.renderFriendSelectList();
    this.updateGroupStep();
    this.openModal('modal-new-group');
  },

  renderFriendSelectList() {
    const list = document.getElementById('friend-select-list');
    const agents = Store.getAgents();

    if (agents.length === 0) {
      list.innerHTML = '<div class="friend-select-empty">请先在通讯录中添加AI好友</div>';
      return;
    }

    list.innerHTML = agents.map(agent => {
      const configured = agent.apiKey && agent.apiKey.length > 0;
      const isSelected = this.selectedFriends.includes(agent.id);
      const roleInfo = AIService.agentRoles[agent.role] || AIService.agentRoles.custom;
      const roleBadge = roleInfo ? `${roleInfo.icon} ${roleInfo.name}` : '✏️ 自定义';
      const channelDisplay = this.getAgentChannelDisplay(agent);

      return `
        <div class="friend-select-item ${isSelected ? 'selected' : ''}" data-id="${agent.id}">
          <input type="checkbox" ${isSelected ? 'checked' : ''} ${!configured ? 'disabled' : ''} />
          <div class="friend-select-avatar" style="background:${agent.color}">${agent.avatar}</div>
          <div class="friend-select-info">
            <div class="friend-select-name">
              ${this.escapeHtml(agent.name)}
              <span class="friend-select-rule">${roleBadge}</span>
              ${!configured ? '<span style="color:#fbbf24;">(未配置)</span>' : ''}
            </div>
            <div class="friend-select-desc">${this.escapeHtml(channelDisplay)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Bind clicks
    list.querySelectorAll('.friend-select-item').forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox.disabled) return;

      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
          checkbox.checked = !checkbox.checked;
        }
        const id = item.dataset.id;
        if (checkbox.checked) {
          if (!this.selectedFriends.includes(id)) {
            this.selectedFriends.push(id);
          }
        } else {
          this.selectedFriends = this.selectedFriends.filter(fid => fid !== id);
        }
        item.classList.toggle('selected', checkbox.checked);
        document.getElementById('selected-count').textContent = `已选择 ${this.selectedFriends.length} 个好友`;
      });
    });

    document.getElementById('selected-count').textContent = `已选择 ${this.selectedFriends.length} 个好友`;
  },

  groupNextStep() {
    if (this.groupStep === 1) {
      if (this.selectedFriends.length === 0) {
        this.showToast('请至少选择一个AI好友');
        return;
      }
      if (this.selectedFriends.length < 2) {
        this.showToast('群聊至少需要选择2个AI好友');
        return;
      }

      // Initialize reply order with selected friends
      this.replyOrder = [...this.selectedFriends];
      this.groupStep = 2;
      this.updateGroupStep();
      this.renderReplyOrderList();
    }
  },

  groupPrevStep() {
    this.groupStep = 1;
    this.updateGroupStep();
  },

  updateGroupStep() {
    const step1 = document.getElementById('group-step-1');
    const step2 = document.getElementById('group-step-2');
    const step1El = document.getElementById('step-1');
    const step2El = document.getElementById('step-2');
    const btnNext = document.getElementById('btn-group-next');
    const btnPrev = document.getElementById('btn-group-prev');
    const btnCreate = document.getElementById('btn-create-group');

    if (this.groupStep === 1) {
      step1.style.display = 'block';
      step2.style.display = 'none';
      step1El.classList.add('active');
      step1El.classList.remove('completed');
      step2El.classList.remove('active', 'completed');
      btnNext.style.display = 'inline-block';
      btnPrev.style.display = 'none';
      btnCreate.style.display = 'none';
    } else {
      step1.style.display = 'none';
      step2.style.display = 'block';
      step1El.classList.remove('active');
      step1El.classList.add('completed');
      step2El.classList.add('active');
      btnNext.style.display = 'none';
      btnPrev.style.display = 'inline-block';
      btnCreate.style.display = 'inline-block';
    }
  },

  renderReplyOrderList() {
    const list = document.getElementById('reply-order-list');

    list.innerHTML = this.replyOrder.map((id, index) => {
      const agent = Store.getAgent(id);
      if (!agent) return '';
      return `
        <div class="reply-order-item" data-id="${id}" data-index="${index}">
          <div class="reply-order-num">${index + 1}</div>
          <div class="reply-order-avatar" style="background:${agent.color}">${agent.avatar}</div>
          <div class="reply-order-name">${this.escapeHtml(agent.name)}</div>
          <div class="reply-order-actions">
            <button class="reply-order-btn btn-move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''} title="上移">↑</button>
            <button class="reply-order-btn btn-move-down" data-index="${index}" ${index === this.replyOrder.length - 1 ? 'disabled' : ''} title="下移">↓</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind move buttons
    list.querySelectorAll('.btn-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        if (idx > 0) {
          [this.replyOrder[idx - 1], this.replyOrder[idx]] = [this.replyOrder[idx], this.replyOrder[idx - 1]];
          this.renderReplyOrderList();
        }
      });
    });

    list.querySelectorAll('.btn-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        if (idx < this.replyOrder.length - 1) {
          [this.replyOrder[idx + 1], this.replyOrder[idx]] = [this.replyOrder[idx], this.replyOrder[idx + 1]];
          this.renderReplyOrderList();
        }
      });
    });

    // Drag and drop
    let dragSrcIndex = null;
    list.querySelectorAll('.reply-order-item').forEach(item => {
      item.draggable = true;

      item.addEventListener('dragstart', (e) => {
        dragSrcIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetIndex = parseInt(item.dataset.index);
        if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
          const moved = this.replyOrder.splice(dragSrcIndex, 1)[0];
          this.replyOrder.splice(targetIndex, 0, moved);
          this.renderReplyOrderList();
        }
        dragSrcIndex = null;
      });
    });
  },

  createGroup() {
    const name = document.getElementById('group-name').value.trim();
    const avatar = document.getElementById('group-avatar').value.trim() || '👥';
    const topic = document.getElementById('group-topic').value.trim();
    // Use the group form's maxRounds if set, otherwise fall back to global setting
    const formMaxRounds = parseInt(document.getElementById('group-max-rounds').value);
    const globalMaxRounds = (Store.getSettings().maxRounds !== undefined) ? Store.getSettings().maxRounds : 5;
    const maxRounds = (!isNaN(formMaxRounds) && formMaxRounds > 0) ? formMaxRounds : (globalMaxRounds || 0);

    if (!name) {
      this.showToast('请输入群名称');
      return;
    }

    const conv = Store.createGroupChat(name, avatar, topic, this.selectedFriends, this.replyOrder, maxRounds);
    this.closeModal('modal-new-group');
    this.switchNav('chats');
    this.renderConvList();
    this.renderActiveChat();
    this.showToast('群聊创建成功');
  },

  // ============ In-group member management ============
  openAddMemberModal() {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv || conv.type !== 'group') return;
    this.addMemberSelected = [];
    this.renderAddMemberList();
    this.openModal('modal-add-member');
  },

  renderAddMemberList() {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;
    const list = document.getElementById('add-member-list');
    const candidates = Store.getAgents().filter(a => !conv.memberAgentIds.includes(a.id));

    if (candidates.length === 0) {
      list.innerHTML = '<div class="friend-select-empty">通讯录里没有可添加的好友（已都在群里，或通讯录为空）</div>';
      document.getElementById('add-member-count').textContent = '已选择 0 个好友';
      return;
    }

    list.innerHTML = candidates.map(agent => {
      const configured = agent.apiKey && agent.apiKey.length > 0;
      const isSelected = this.addMemberSelected.includes(agent.id);
      const roleInfo = AIService.agentRoles[agent.role] || AIService.agentRoles.custom;
      const roleBadge = roleInfo ? `${roleInfo.icon} ${roleInfo.name}` : '✏️ 自定义';
      const channelDisplay = this.getAgentChannelDisplay(agent);
      return `
        <div class="friend-select-item ${isSelected ? 'selected' : ''}" data-id="${agent.id}">
          <input type="checkbox" ${isSelected ? 'checked' : ''} ${!configured ? 'disabled' : ''} />
          <div class="friend-select-avatar" style="background:${agent.color}">${agent.avatar}</div>
          <div class="friend-select-info">
            <div class="friend-select-name">
              ${this.escapeHtml(agent.name)}
              <span class="friend-select-rule">${roleBadge}</span>
              ${!configured ? '<span style="color:#fbbf24;">(未配置)</span>' : ''}
            </div>
            <div class="friend-select-desc">${this.escapeHtml(channelDisplay)}</div>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('.friend-select-item').forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox.disabled) return;
      item.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') checkbox.checked = !checkbox.checked;
        const id = item.dataset.id;
        if (checkbox.checked) {
          if (!this.addMemberSelected.includes(id)) this.addMemberSelected.push(id);
        } else {
          this.addMemberSelected = this.addMemberSelected.filter(fid => fid !== id);
        }
        item.classList.toggle('selected', checkbox.checked);
        document.getElementById('add-member-count').textContent = `已选择 ${this.addMemberSelected.length} 个好友`;
      });
    });

    document.getElementById('add-member-count').textContent = `已选择 ${this.addMemberSelected.length} 个好友`;
  },

  confirmAddMembers() {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;
    if (this.addMemberSelected.length === 0) {
      this.showToast('请至少选择一个AI好友');
      return;
    }
    let added = 0;
    this.addMemberSelected.forEach(id => {
      if (Store.addGroupMember(conv.id, id)) added++;
    });
    this.closeModal('modal-add-member');
    this.renderConvList();
    this.renderActiveChat();
    this.showToast(`已添加 ${added} 个成员`);
  },

  removeGroupMember(agentId) {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;
    const agent = Store.getAgent(agentId);
    if (!agent) return;
    this.showConfirm('移除群成员', `确定将「${agent.name}」移出群聊吗？`, () => {
      Store.removeGroupMember(conv.id, agentId);
      this.renderConvList();
      this.renderActiveChat();
      this.showToast('已移除');
    });
  },

  // ============ New single chat modal ============
  openNewSingleModal() {
    const agents = Store.getAgents();
    const list = document.getElementById('friend-select-list-single');

    if (agents.length === 0) {
      list.innerHTML = '<div class="friend-select-empty">请先在通讯录中添加AI好友</div>';
    } else {
list.innerHTML = agents.map(agent => {
      const configured = agent.apiKey && agent.apiKey.length > 0;
      const template = AIService.ruleTemplates[agent.ruleTemplate];
      const ruleName = template ? template.name : '自定义';
      const channelDisplay = this.getAgentChannelDisplay(agent);

      return `
        <div class="friend-select-item" data-id="${agent.id}">
          <input type="radio" name="single-agent" value="${agent.id}" ${!configured ? 'disabled' : ''} />
          <div class="friend-select-avatar" style="background:${agent.color}">${agent.avatar}</div>
          <div class="friend-select-info">
            <div class="friend-select-name">
              ${this.escapeHtml(agent.name)}
              <span class="friend-select-rule">${ruleName}</span>
              ${!configured ? '<span style="color:#fbbf24;">(未配置)</span>' : ''}
            </div>
            <div class="friend-select-desc">${this.escapeHtml(channelDisplay)}</div>
          </div>
        </div>
      `;
    }).join('');

      list.querySelectorAll('.friend-select-item').forEach(item => {
        const radio = item.querySelector('input[type="radio"]');
        if (radio.disabled) return;

        item.addEventListener('click', (e) => {
          if (e.target.tagName !== 'INPUT') {
            radio.checked = true;
          }
        });
      });
    }

    this.openModal('modal-new-single');
  },

  createSingleChat() {
    const selected = document.querySelector('#friend-select-list-single input[type="radio"]:checked');
    if (!selected) {
      this.showToast('请选择一个AI好友');
      return;
    }

    Store.createSingleChat(selected.value);
    this.closeModal('modal-new-single');
    this.renderConvList();
    this.renderActiveChat();
    this.showToast('聊天已创建');
  },

  // ============ Info panel ============
  renderInfoPanel(conv) {
    const content = document.getElementById('info-content');
    const user = Store.getUser();

    let html = `
      <div class="info-section">
        <div class="info-section-title">群成员</div>
        <div class="info-member">
          <div class="info-member-avatar" style="background:#6b7280">${user.avatar || '🙂'}</div>
          <div>
            <div class="info-member-name">${this.escapeHtml(user.name || '我')}</div>
            <div class="info-member-role">群主</div>
          </div>
        </div>
    `;

    const order = conv.replyOrder && conv.replyOrder.length > 0 ? conv.replyOrder : conv.memberAgentIds;
    order.forEach((id, idx) => {
      const agent = Store.getAgent(id);
      if (agent) {
        const configured = agent.apiKey && agent.apiKey.length > 0;
        const roleInfo = AIService.agentRoles[agent.role] || AIService.agentRoles.custom;
        const roleName = roleInfo ? `${roleInfo.icon} ${roleInfo.name}` : '✏️ 自定义';
        const channelDisplay = this.getAgentChannelDisplay(agent);
        html += `
          <div class="info-member">
            <div class="info-member-avatar" style="background:${agent.color}">${agent.avatar}</div>
            <div>
              <div class="info-member-name">${this.escapeHtml(agent.name)} ${conv.type === 'group' ? `<span style="font-size:10px;color:var(--accent);">#${idx + 1}</span>` : ''}</div>
              <div class="info-member-role">${configured ? channelDisplay : '未配置'} | ${roleName}</div>
            </div>
          </div>
        `;
      }
    });

    html += '</div>';

    if (conv.topic) {
      html += `
        <div class="info-section">
          <div class="info-section-title">话题</div>
          <p style="font-size:13px;line-height:1.6;">${this.escapeHtml(conv.topic)}</p>
        </div>
      `;
    }

    if (conv.type === 'group') {
      html += `
        <div class="info-section">
          <div class="info-section-title">群聊设置</div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.8;">
            <div>回复模式：${Store.getSettings().replyMode === 'sequential' ? '顺序回复' : '并行回复'}</div>
            <div>讨论轮次：${conv.discussionRound || 0}${(() => { const mr = conv.maxRounds > 0 ? conv.maxRounds : (Store.getSettings().maxRounds || 0); return mr > 0 ? ' / ' + mr : ' (不限)'; })()}</div>
          </div>
        </div>
      `;
    }

    html += `
      <div class="info-section">
        <div class="info-section-title">操作</div>
        <button class="btn-danger" style="width:100%;margin-bottom:8px;" onclick="App.confirmDeleteConversation()">删除聊天</button>
      </div>
    `;

    content.innerHTML = html;
  },

  toggleInfoPanel() {
    const panel = document.getElementById('info-panel');
    if (panel.style.display === 'none') {
      panel.style.display = 'flex';
    } else {
      panel.style.display = 'none';
    }
  },

  closeInfoPanel() {
    document.getElementById('info-panel').style.display = 'none';
  },

  confirmDeleteConversation() {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;
    this.showConfirm('删除聊天', `确定删除「${conv.name}」吗？聊天记录将无法恢复。`, () => {
      Store.deleteConversation(conv.id);
      this.renderConvList();
      this.renderActiveChat();
      this.showToast('已删除');
    });
  },

  // ============ Clear chat ============
  confirmClearChat() {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;
    this.showConfirm('清空聊天记录', `确定清空「${conv.name}」的聊天记录吗？`, () => {
      Store.clearMessages(conv.id);
      this.renderMessages();
      this.renderConvList();
      this.showToast('已清空');
    });
  },

  // ============ Settings ============
  loadSettingsForm() {
    const user = Store.getUser();
    const settings = Store.getSettings();
    document.getElementById('setting-username').value = user.name || '';
    document.getElementById('setting-useravatar').value = user.avatar || '';
    document.getElementById('setting-reply-mode').value = settings.replyMode || 'sequential';
    document.getElementById('setting-reply-delay').value = settings.replyDelay || 500;
    document.getElementById('setting-auto-continue').checked = settings.autoContinue !== false;
    document.getElementById('setting-max-rounds').value = settings.maxRounds !== undefined ? settings.maxRounds : 5;
    const ctEl = document.getElementById('setting-consensus-threshold');
    if (ctEl) ctEl.value = settings.consensusThreshold !== undefined ? settings.consensusThreshold : 95;
  },

  switchSettingsTab(tab) {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.settings-tab[data-tab="${tab}"]`).classList.add('active');
    document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
    document.querySelector(`.settings-pane[data-pane="${tab}"]`).classList.add('active');
  },

  saveSettings() {
    Store.updateUser({
      name: document.getElementById('setting-username').value.trim() || '我',
      avatar: document.getElementById('setting-useravatar').value.trim() || '🙂',
    });
    Store.updateSettings({
      replyMode: document.getElementById('setting-reply-mode').value,
      replyDelay: parseInt(document.getElementById('setting-reply-delay').value) || 500,
      autoContinue: document.getElementById('setting-auto-continue').checked,
      maxRounds: parseInt(document.getElementById('setting-max-rounds').value) || 0,
      consensusThreshold: Math.min(100, Math.max(0, parseInt(document.getElementById('setting-consensus-threshold').value) || 95)),
    });
    this.closeModal('modal-settings');
    this.renderAll();
    this.showToast('设置已保存');
  },

  // ============ Data management ============
  exportData() {
    const data = Store.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-group-chat-full-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('全部数据已导出（含聊天记录）');
  },

  // Export config ONLY (agents + user + settings, NO chat records)
  exportConfigFile() {
    const data = Store.exportConfigFile();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-group-chat-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('配置已导出（仅好友列表与设置，不含聊天记录）');
  },

  // Import config from a file (works on desktop AND mobile)
  importConfigFromFile(file, source) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = await Store.importConfig(reader.result);
      const resultEl = document.getElementById('qr-scan-result');
      if (result.success) {
        this.renderAll();
        this.showToast(`已导入 ${result.count} 个AI好友（新增 ${result.added} / 更新 ${result.updated}）`);
        if (resultEl) resultEl.innerHTML = `<p style="color:green;">导入成功！共 ${result.count} 个AI好友（新增 ${result.added} / 更新 ${result.updated}）</p>`;
      } else {
        this.showToast(result.error, true);
        if (resultEl) resultEl.innerHTML = `<p style="color:red;">${result.error}</p>`;
      }
    };
    reader.onerror = () => {
      this.showToast('读取文件失败', true);
    };
    reader.readAsText(file);
  },

  // ============ File / Document / Code reading ============
  // 统一读取入口：文本/代码 readAsText；PDF 用 pdfjs；DOCX 用原生解压抽取文本
  async readFileContent(file) {
    const MAX = 200 * 1024; // 存入上下文的文本上限（约 200KB），避免撑爆 localStorage
    const name = file.name || '未命名文件';
    const lower = name.toLowerCase();
    const isPdf = lower.endsWith('.pdf') || file.type === 'application/pdf';
    const isDocx = lower.endsWith('.docx');
    try {
      if (isPdf) {
        const buf = await file.arrayBuffer();
        const text = await this.extractPdfText(buf);
        return { name, content: this._capText(text, MAX), kind: 'pdf' };
      }
      if (isDocx) {
        const buf = await file.arrayBuffer();
        const text = await this.extractDocxText(buf);
        return { name, content: this._capText(text, MAX), kind: 'docx' };
      }
      // 文本 / 代码
      const text = await file.text();
      return { name, content: this._capText(text, MAX), kind: 'text' };
    } catch (e) {
      console.error('readFileContent error', e);
      throw e;
    }
  },

  _capText(text, max) {
    if (!text) return '';
    const t = String(text);
    if (t.length > max) {
      return t.slice(0, max) + `\n\n…（内容过长，已截断至 ${max} 字符，原始文件更大）`;
    }
    return t;
  },

  // DOCX：中央目录解析 ZIP + deflate-raw 解压，抽取 word/document.xml 文本
  async extractDocxText(buf) {
    const files = await this._unzipCentral(buf);
    let xml = files['word/document.xml'] || '';
    if (!xml) {
      const k = Object.keys(files).find(x => x.endsWith('document.xml'));
      xml = k ? files[k] : '';
    }
    if (!xml) return '(未能从 docx 提取到文本)';
    let text = xml
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:br\s*\/?>/g, '\n')
      .replace(/<w:tab\s*\/?>/g, '\t');
    text = text.replace(/<[^>]+>/g, '');
    text = this._xmlDecode(text);
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    return text || '(未能从 docx 提取到文本)';
  },

  _xmlDecode(s) {
    return String(s)
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)))
      .replace(/&amp;/g, '&');
  },

  // 解析 ZIP 中央目录（DOCX/XLSX 等），返回文件名→文本
  async _unzipCentral(buf) {
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    const files = {};
    // 定位 EOCD 签名 0x06054b50
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= 0; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('文件不是有效的压缩包');
    const cdStart = dv.getUint32(eocd + 16, true);
    const cdCount = dv.getUint16(eocd + 10, true);
    let p = cdStart;
    for (let n = 0; n < cdCount; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true);
      const extraLen = dv.getUint16(p + 30, true);
      const commentLen = dv.getUint16(p + 32, true);
      const localOffset = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nameLen));
      const lNameLen = dv.getUint16(localOffset + 26, true);
      const lExtraLen = dv.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + lNameLen + lExtraLen;
      const compData = u8.subarray(dataStart, dataStart + compSize);
      let content;
      if (method === 0) {
        content = compData;
      } else if (method === 8) {
        const ds = new DecompressionStream('deflate-raw');
        const ab = await new Response(new Blob([compData]).stream().pipeThrough(ds)).arrayBuffer();
        content = new Uint8Array(ab);
      } else {
        content = compData;
      }
      files[name] = new TextDecoder().decode(content);
      p += 46 + nameLen + extraLen + commentLen;
    }
    return files;
  },

  // PDF：动态加载 vendored pdfjs（ESM），抽取全部页面文本
  async extractPdfText(buf) {
    let pdfjs;
    try {
      pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    } catch (e1) {
      pdfjs = await import('vendor/pdfjs/pdf.min.mjs');
    }
    pdfjs.GlobalWorkerOptions.workerSrc = './vendor/pdfjs/pdf.worker.min.mjs';
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let out = '';
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      out += content.items.map(it => it.str || '').join(' ') + '\n';
    }
    return out.trim() || '(未能从 PDF 提取到文本)';
  },

  async onAttachFiles(fileList) {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;
    for (const file of files) {
      try {
        this.showToast(`正在读取 ${file.name} ...`);
        const res = await this.readFileContent(file);
        const att = {
          id: 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          name: res.name,
          kind: res.kind,
          size: file.size,
          content: res.content,
        };
        Store.addAttachment(conv.id, att);
      } catch (e) {
        this.showToast(`读取 ${file.name} 失败：${e.message || e}`, true);
      }
    }
    this.renderAttachmentChips();
    this.showToast('参考资料已添加，后续对话中 AI 都能看到');
  },

  openAttachFilePicker() {
    const input = document.getElementById('file-attach');
    if (input) input.click();
  },

  renderAttachmentChips() {
    const container = document.getElementById('attachment-previews');
    if (!container) return;
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv || !conv.attachments || !conv.attachments.length) {
      container.innerHTML = '';
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';
    const icon = { pdf: '📕', docx: '📘', text: '📄' };
    container.innerHTML = conv.attachments.map(a => `
      <div class="attachment-chip" data-id="${a.id}">
        <span class="attachment-icon">${icon[a.kind] || '📄'}</span>
        <span class="attachment-name" title="${this.escapeHtml(a.name)}">${this.escapeHtml(a.name)}</span>
        <button class="attachment-remove" data-id="${a.id}" title="移除" type="button">×</button>
      </div>
    `).join('');
    container.querySelectorAll('.attachment-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeAttachmentById(btn.dataset.id);
      });
    });
  },

  removeAttachmentById(attId) {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;
    Store.removeAttachment(conv.id, attId);
    this.renderAttachmentChips();
    this.showToast('已移除该参考资料');
  },

  confirmClearData() {
    this.showConfirm('清空所有数据', '确定清空所有聊天记录和AI配置吗？此操作不可恢复。', () => {
      Store.clearAllData();
      this.renderAll();
      this.showToast('所有数据已清空');
    });
  },

  // ============ QR Code Sync ============
  async showQrSync() {
    let configStr;
    try {
      configStr = await Store.exportConfigQr();
    } catch (e) {
      this.showToast('生成二维码失败: ' + e.message, true);
      return;
    }

    // Show modal
    this.openModal('modal-qr-sync');

    // Clear previous QR code & result
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = '';
    const resultEl = document.getElementById('qr-scan-result');
    if (resultEl) resultEl.innerHTML = '';

    // QR capacity guard (~2953 bytes for version 40-L). Show fallback message if too large.
    if (configStr.length > 2900) {
      qrContainer.innerHTML = '<p style="color:red;padding:16px;">配置数据过大，二维码无法承载。<br>请改用「导出配置」生成文件，再在其他设备上「导入配置」。</p>';
    } else {
      try {
        new QRCode(qrContainer, {
          text: configStr,
          width: 256,
          height: 256,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.L,
        });
      } catch (e) {
        qrContainer.innerHTML = '<p style="color:red;">生成二维码失败：' + e.message + '</p>';
        console.error('QR generation error:', e);
      }
    }

    // Show camera-scan button only on mobile; file import + manual paste work everywhere
    const scanBtn = document.getElementById('btn-scan-qr');
    if (scanBtn) scanBtn.style.display = APIBridge.isMobile() ? 'block' : 'none';
  },

  async scanQrCode() {
    const resultEl = document.getElementById('qr-scan-result');
    resultEl.innerHTML = '<p style="color:#666;">正在启动扫码...</p>';

    try {
      // Use Capacitor BarcodeScanner if available
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BarcodeScanner) {
        const { BarcodeScanner } = window.Capacitor.Plugins;
        const result = await BarcodeScanner.scan();
        if (result.content) {
          this.importFromQr(result.content);
        } else {
          resultEl.innerHTML = '<p style="color:red;">未扫描到内容</p>';
        }
      } else {
        // Fallback: manual paste (static UI already present in modal)
        const ti = document.getElementById('qr-manual-input');
        if (ti) ti.focus();
        resultEl.innerHTML = '<p style="color:#666;">扫码插件不可用，请在上方粘贴配置字符串后点「导入」。</p>';
      }
    } catch (e) {
      resultEl.innerHTML = `<p style="color:red;">扫码失败: ${e.message}</p>`;
    }
  },

  async importFromQr(configStr) {
    const resultEl = document.getElementById('qr-scan-result');
    const result = await Store.importConfig(configStr);

    if (result.success) {
      if (resultEl) resultEl.innerHTML = `<p style="color:green;">导入成功！共 ${result.count} 个AI好友（新增 ${result.added} / 更新 ${result.updated}）</p>`;
      this.renderAll();
      this.showToast(`已导入 ${result.count} 个AI好友`);
    } else {
      if (resultEl) resultEl.innerHTML = `<p style="color:red;">${result.error}</p>`;
      this.showToast(result.error, true);
    }
  },

  // ============ Mention dropdown ============
  // Auto-trigger when user types @
  handleMentionInput(e) {
    const input = e.target;
    const text = input.value;
    const cursorPos = input.selectionStart;

    // Find the @ symbol before the cursor (must be at start or preceded by whitespace)
    const subText = text.substring(0, cursorPos);
    const match = subText.match(/(^|\s)@(\S*)$/);

    if (match) {
      const prefix = match[2]; // What user typed after @
      this.showMentionDropdown(prefix);
    } else {
      this.closeMentionDropdown();
    }
  },

  showMentionDropdown(filterText = '') {
    const conv = Store.getConversation(Store.data.activeConversationId);
    if (!conv) return;

    // 单聊不开 @ 下拉（单聊只有 1 个 AI，没有成员选择意义）
    if (conv.type !== 'group' || conv.memberAgentIds.length < 2) return;

    const agents = conv.memberAgentIds
      .map(id => Store.getAgent(id))
      .filter(a => a);

    if (agents.length === 0) return;

    const filtered = filterText
      ? agents.filter(a => a.name.toLowerCase().includes(filterText.toLowerCase()))
      : agents;

    if (filtered.length === 0) {
      this.closeMentionDropdown();
      return;
    }

    // Remove existing dropdown
    this.closeMentionDropdown();

    const dropdown = document.createElement('div');
    dropdown.className = 'mention-dropdown';
    dropdown.innerHTML = filtered.map(a => `
      <div class="mention-item" data-name="${this.escapeHtml(a.name)}">
        <div class="mention-item-avatar" style="background:${a.color}">${a.avatar}</div>
        <span>${this.escapeHtml(a.name)}</span>
      </div>
    `).join('');

    const input = document.getElementById('message-input');
    const rect = input.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
    dropdown.style.left = Math.max(rect.left + 12, 8) + 'px';
    dropdown.style.zIndex = '9999';

    document.body.appendChild(dropdown);

    dropdown.querySelectorAll('.mention-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.insertMention(item.dataset.name);
      });
    });
  },

  closeMentionDropdown() {
    const existing = document.querySelector('.mention-dropdown');
    if (existing) existing.remove();
  },

  // Insert mention at cursor position
  insertMention(name) {
    const input = document.getElementById('message-input');
    const text = input.value;
    const cursorPos = input.selectionStart;

    // Find the @ symbol position
    const subText = text.substring(0, cursorPos);
    const match = subText.match(/(^|\s)@(\S*)$/);
    if (!match) return;

    const atPos = cursorPos - match[2].length; // Position of @ minus the typed suffix
    const before = text.substring(0, atPos);
    const after = text.substring(cursorPos);
    // Use WeChat-style mention: @Name (with non-breaking space to prevent edit)
    const mention = `@${name} `;
    input.value = before + mention + after;
    input.focus();
    const newPos = before.length + mention.length;
    input.setSelectionRange(newPos, newPos);
    this.autoResize(input);
    this.closeMentionDropdown();
  },

  // ============ Confirm modal ============
  showConfirm(title, message, onConfirm) {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    this._confirmCallback = onConfirm;
    this.openModal('modal-confirm');
  },

  handleConfirm() {
    if (this._confirmCallback) {
      this._confirmCallback();
      this._confirmCallback = null;
    }
    this.closeModal('modal-confirm');
  },

  // ============ Send button ============
  updateSendButton() {
    const btn = document.getElementById('btn-send');
    if (this.isGenerating) {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
      btn.title = '停止生成';
      btn.classList.add('stop-btn');
      btn.classList.remove('send-btn');
    } else {
      btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
      btn.title = '发送';
      btn.classList.add('send-btn');
      btn.classList.remove('stop-btn');
    }
  },

  // ============ Modal helpers ============
  openModal(id) {
    document.getElementById(id).style.display = 'flex';
  },

  closeModal(id) {
    document.getElementById(id).style.display = 'none';
  },

  // ============ Toast ============
  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  },

  // ============ Utility ============
  getAgentChannelDisplay(agent) {
    if (!agent) return '';
    // v1.4.5: 新数据结构 (channel, modelKey)，并兼容旧 (aiModel, channel)
    const channel = agent.channel;
    const aiModel = agent.aiModel;

    // 旧 aiModel 名称（如 'kimi', 'deepseek'）转成更友好的显示名
    const oldAiNameMap = {
      'deepseek': 'DeepSeek', 'claude': 'Claude', 'gpt': 'ChatGPT',
      'glm': '智谱GLM', 'kimi': 'Kimi', 'gemini': 'Gemini',
      'grok': 'Grok', 'qwen': '通义千问', 'doubao': '豆包', 'workbuddy': 'WorkBuddy',
    };
    const aiName = oldAiNameMap[aiModel] || aiModel;

    // 在新结构中找模型名
    const ch = AIService.providerMatrix.channels[channel];
    if (ch) {
      let m = ch.models?.[aiModel];
      let name = m ? m.name : (oldAiNameMap[aiModel] || aiModel);
      return `${name} · ${ch.label}`;
    }
    // 旧 channel 名走兼容表
    const legacyLabel = CHANNEL_LABEL_MAP[channel] || channel;
    return `${aiName} · ${legacyLabel}`;
  },

  autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  },

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    if (date.toDateString() === now.toDateString()) {
      return date.toTimeString().slice(0, 5);
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return '昨天';
    return (date.getMonth() + 1) + '/' + date.getDate();
  },

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
