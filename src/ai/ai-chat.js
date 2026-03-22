// MarkLink SL — AI Chat Panel (Local LLM powered office assistant)
// Architecture adapted from T1.15wc security consultation agent

import {
  checkOllamaStatus, listModels, pullModel, chat,
  MODEL_TIERS, getRecommendedTier
} from './ollama-client.js';

let panelEl, chatListEl, chatInputEl, modelSelectEl, statusDotEl;
let isOpen = false;
let history = [];
let selectedModel = '';
let ollamaReady = false;

// ─── Office context providers (set by app.js) ──────────
let contextProviders = {};
export function setContextProviders(providers) {
  contextProviders = providers;
}

// ─── System prompt for office assistant ─────────────────
function getSystemPrompt() {
  return `You are MarkLink AI, a helpful office assistant built into MarkLink SL — a free web office suite.
You help users with:
- Writing, editing, and formatting documents
- Creating spreadsheet formulas and data analysis
- Designing presentations
- Translating text
- Summarizing content
- General writing assistance

When the user shares document content, analyze it and provide helpful suggestions.
When asked to generate content, provide it in a format suitable for the active editor.
For spreadsheet tasks, suggest formulas using standard Excel-compatible syntax.
Respond in the same language the user writes in.
Keep responses concise and actionable.`;
}

/**
 * Initialize AI Chat Panel
 */
export function initAiChat() {
  panelEl = document.getElementById('ai-panel');
  chatListEl = document.getElementById('ai-chat-list');
  chatInputEl = document.getElementById('ai-chat-input');
  modelSelectEl = document.getElementById('ai-model-select');
  statusDotEl = document.getElementById('ai-status-dot');
  if (!panelEl) return;

  // Toggle button
  document.getElementById('btn-ai')?.addEventListener('click', togglePanel);
  document.getElementById('ai-panel-close')?.addEventListener('click', togglePanel);

  // Send
  document.getElementById('ai-send-btn')?.addEventListener('click', sendMessage);
  chatInputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Context buttons
  document.getElementById('ai-ctx-doc')?.addEventListener('click', () => insertContext('document'));
  document.getElementById('ai-ctx-sheet')?.addEventListener('click', () => insertContext('sheet'));
  document.getElementById('ai-ctx-selection')?.addEventListener('click', () => insertContext('selection'));

  // Insert AI response into editor
  document.getElementById('ai-insert-btn')?.addEventListener('click', insertLastResponse);

  // Setup button
  document.getElementById('ai-setup-btn')?.addEventListener('click', showSetupModal);

  // Model select
  modelSelectEl?.addEventListener('change', () => {
    selectedModel = modelSelectEl.value;
    localStorage.setItem('marklink-ai-model', selectedModel);
  });

  // Clear
  document.getElementById('ai-clear-btn')?.addEventListener('click', () => {
    history = [];
    if (chatListEl) chatListEl.innerHTML = '';
    addSystemMessage('Chat cleared.');
  });

  // Restore saved model
  selectedModel = localStorage.getItem('marklink-ai-model') || '';

  // Check Ollama status
  checkStatus();
}

async function checkStatus() {
  const status = await checkOllamaStatus();
  ollamaReady = status.running;
  updateStatusUI(status.running);

  if (status.running) {
    const models = await listModels();
    populateModelSelect(models);
  }
}

function updateStatusUI(running) {
  if (statusDotEl) {
    statusDotEl.className = `ai-status-dot ${running ? 'online' : 'offline'}`;
    statusDotEl.title = running ? 'Ollama is running' : 'Ollama is not running — click AI Setup';
  }
}

function populateModelSelect(models) {
  if (!modelSelectEl) return;
  modelSelectEl.innerHTML = '';

  if (models.length === 0) {
    modelSelectEl.innerHTML = '<option value="">No models installed</option>';
    return;
  }

  const recommended = getRecommendedTier();
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.name;
    opt.textContent = m.name;
    modelSelectEl.appendChild(opt);
  }

  // Try to restore saved model or pick first
  if (selectedModel && models.find(m => m.name === selectedModel)) {
    modelSelectEl.value = selectedModel;
  } else if (models.length > 0) {
    selectedModel = models[0].name;
    modelSelectEl.value = selectedModel;
  }
}

function togglePanel() {
  isOpen = !isOpen;
  panelEl?.classList.toggle('open', isOpen);
  if (isOpen && !ollamaReady) {
    checkStatus();
  }
}

// ─── Messages ───────────────────────────────────────────

function addUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-user';
  div.textContent = text;
  chatListEl?.appendChild(div);
  scrollToBottom();
}

function addAiMessage(text) {
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-ai';
  div.innerHTML = renderMarkdown(text);
  chatListEl?.appendChild(div);
  scrollToBottom();
  return div;
}

function addSystemMessage(text) {
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-system';
  div.textContent = text;
  chatListEl?.appendChild(div);
  scrollToBottom();
}

function createStreamingMessage() {
  const div = document.createElement('div');
  div.className = 'ai-msg ai-msg-ai streaming';
  div.innerHTML = '<span class="ai-typing"></span>';
  chatListEl?.appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  if (chatListEl) chatListEl.scrollTop = chatListEl.scrollHeight;
}

function renderMarkdown(text) {
  // Basic markdown rendering for chat
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// ─── Send Message ───────────────────────────────────────

async function sendMessage() {
  const text = chatInputEl?.value?.trim();
  if (!text) return;

  if (!ollamaReady) {
    addSystemMessage('Ollama is not running. Click "AI Setup" to install and start.');
    return;
  }
  if (!selectedModel) {
    addSystemMessage('No model selected. Please install a model first.');
    return;
  }

  chatInputEl.value = '';
  addUserMessage(text);
  history.push({ role: 'user', content: text });

  const streamDiv = createStreamingMessage();

  try {
    const result = await chat(selectedModel, history, getSystemPrompt(), (token, full) => {
      streamDiv.innerHTML = renderMarkdown(full);
      streamDiv.classList.remove('streaming');
      scrollToBottom();
    });

    history.push({ role: 'assistant', content: result.content });

    // Show token stats
    if (result.tokenStats) {
      const stats = result.tokenStats;
      const statsEl = document.createElement('div');
      statsEl.className = 'ai-token-stats';
      statsEl.textContent = `${stats.promptTokens + stats.completionTokens} tokens · ${stats.totalDurationMs}ms · ${stats.model}`;
      streamDiv.appendChild(statsEl);
    }
  } catch (e) {
    streamDiv.innerHTML = `<span class="ai-error">Error: ${e.message}</span>`;
    streamDiv.classList.remove('streaming');
  }
}

// ─── Context Injection ──────────────────────────────────

function insertContext(type) {
  if (!chatInputEl) return;

  let content = '';
  if (type === 'document' && contextProviders.getDocContent) {
    content = contextProviders.getDocContent();
    if (content) {
      // Strip HTML tags for clean text
      const tmp = document.createElement('div');
      tmp.innerHTML = content;
      content = tmp.textContent || tmp.innerText;
    }
  } else if (type === 'sheet' && contextProviders.getSheetText) {
    content = contextProviders.getSheetText();
  } else if (type === 'selection') {
    const sel = window.getSelection();
    content = sel ? sel.toString() : '';
  }

  if (!content) {
    addSystemMessage(`No ${type} content to attach.`);
    return;
  }

  // Truncate if too long
  if (content.length > 5000) {
    content = content.substring(0, 5000) + '\n...(truncated)';
  }

  chatInputEl.value += `\n---\n[${type} content]:\n${content}\n---\n`;
  chatInputEl.focus();
  addSystemMessage(`${type} content attached (${content.length} chars).`);
}

function insertLastResponse() {
  if (history.length === 0) return;
  const lastAi = [...history].reverse().find(m => m.role === 'assistant');
  if (!lastAi) return;

  if (contextProviders.insertContent) {
    contextProviders.insertContent(lastAi.content);
    addSystemMessage('Response inserted into editor.');
  }
}

// ─── Setup Modal ────────────────────────────────────────

async function showSetupModal() {
  // Remove existing
  document.querySelector('.ai-setup-modal')?.remove();

  const status = await checkOllamaStatus();
  const models = status.running ? await listModels() : [];
  const recommended = getRecommendedTier();
  const ram = navigator.deviceMemory || '(unknown)';

  const modal = document.createElement('div');
  modal.className = 'ai-setup-modal';

  const installedNames = models.map(m => m.name);

  modal.innerHTML = `
    <div class="ai-setup-content">
      <div class="ai-setup-header">
        <h3>AI Setup</h3>
        <button class="ai-setup-close">&times;</button>
      </div>

      <div class="ai-setup-body">
        <div class="ai-setup-status ${status.running ? 'online' : 'offline'}">
          <span class="ai-status-icon">${status.running ? '✅' : '❌'}</span>
          <span>${status.running ? 'Ollama is running' : 'Ollama is not running'}</span>
        </div>

        ${!status.running ? `
        <div class="ai-install-section">
          <h4>Install Ollama (Free Local AI)</h4>
          <p class="ai-install-desc">
            Ollama runs AI models directly on your PC — <strong>completely free, no account needed, no data sent to servers.</strong>
            Your documents stay private on your device.
          </p>
          <a href="https://ollama.com/download" target="_blank" rel="noopener" class="ai-install-btn"
             title="Ollama is a free, open-source tool that runs AI models locally on your PC.&#10;&#10;Pros:&#10;• 100% free — no subscription fees&#10;• Complete privacy — your data never leaves your PC&#10;• No internet required after setup&#10;• Works offline&#10;&#10;Cons:&#10;• Requires download (300MB installer)&#10;• AI models are large files (1~20GB)&#10;• Uses your PC's CPU/GPU resources&#10;• Slower than cloud AI on low-spec PCs&#10;&#10;vs Paid AI (ChatGPT, Claude):&#10;• They charge $20+/month&#10;• They process your data on their servers&#10;• They require internet connection&#10;• They are faster on any device">
            Download Ollama (Free)
          </a>
          <p class="ai-install-note">
            After installing, run <code>ollama serve</code> in terminal, then refresh this page.
          </p>
        </div>
        ` : ''}

        <div class="ai-model-section">
          <h4>AI Models — Choose by your PC specs</h4>
          <p class="ai-ram-info">Detected RAM: <strong>${ram}GB</strong> · Recommended: <strong>${MODEL_TIERS.find(t => t.id === recommended)?.label || 'Standard'}</strong></p>

          <div class="ai-model-list">
            ${MODEL_TIERS.map(tier => {
              const installed = installedNames.some(n => n.startsWith(tier.model.split(':')[0]) && n.includes(tier.model.split(':')[1]));
              const isRec = tier.id === recommended;
              return `
              <div class="ai-model-card ${isRec ? 'recommended' : ''} ${installed ? 'installed' : ''}">
                <div class="ai-model-info">
                  <strong>${tier.label}</strong> ${isRec ? '<span class="ai-badge">Recommended</span>' : ''}
                  ${installed ? '<span class="ai-badge installed">Installed</span>' : ''}
                  <br><code>${tier.model}</code> · ${tier.size}
                  <br><small>${tier.desc}</small>
                  <br><small>Minimum: ${tier.minRAM}GB RAM</small>
                </div>
                <div class="ai-model-actions">
                  ${!installed && status.running ? `
                    <button class="ai-pull-btn" data-model="${tier.model}"
                      title="Download this model. File size: ${tier.size}.&#10;This is a one-time download.&#10;The model runs locally — free forever after download.">
                      Install
                    </button>
                  ` : installed ? '<span class="ai-check">✓</span>' : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>

        <div class="ai-progress-section hidden" id="ai-pull-progress">
          <div class="ai-progress-label" id="ai-pull-label">Downloading...</div>
          <div class="ai-progress-bar">
            <div class="ai-progress-fill" id="ai-pull-fill" style="width:0%"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close
  modal.querySelector('.ai-setup-close')?.addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

  // Pull buttons
  modal.querySelectorAll('.ai-pull-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const modelName = btn.dataset.model;
      btn.disabled = true;
      btn.textContent = 'Downloading...';

      const progressSection = document.getElementById('ai-pull-progress');
      const progressLabel = document.getElementById('ai-pull-label');
      const progressFill = document.getElementById('ai-pull-fill');
      progressSection?.classList.remove('hidden');

      try {
        await pullModel(modelName, (data) => {
          if (data.total && data.completed) {
            const pct = Math.round((data.completed / data.total) * 100);
            if (progressFill) progressFill.style.width = pct + '%';
            if (progressLabel) progressLabel.textContent = `${data.status || 'Downloading'} — ${pct}%`;
          } else if (data.status) {
            if (progressLabel) progressLabel.textContent = data.status;
          }
        });

        btn.textContent = '✓ Installed';
        if (progressLabel) progressLabel.textContent = 'Download complete!';

        // Refresh model list
        const newModels = await listModels();
        populateModelSelect(newModels);
        ollamaReady = true;
        updateStatusUI(true);
      } catch (e) {
        btn.textContent = 'Error';
        if (progressLabel) progressLabel.textContent = `Error: ${e.message}`;
      }
    });
  });
}

export { togglePanel as toggleAiPanel };
