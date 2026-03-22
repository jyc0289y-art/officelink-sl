// MarkLink SL — Ollama Client (Local LLM Integration)
// Adapted from T1.15wc security consultation agent architecture

const OLLAMA_BASE = 'http://localhost:11434';

// Model tiers matched to PC specs
export const MODEL_TIERS = [
  {
    id: 'small',
    label: 'Light (1.5B)',
    model: 'qwen2.5:1.5b',
    minRAM: 4,
    size: '~1GB',
    desc: '가벼운 모델 — 4GB RAM 이상, 빠른 응답',
    descEn: 'Lightweight — 4GB+ RAM, fast responses',
  },
  {
    id: 'medium',
    label: 'Standard (7B)',
    model: 'qwen2.5:7b',
    minRAM: 8,
    size: '~4.5GB',
    desc: '균형 잡힌 모델 — 8GB RAM 이상 권장',
    descEn: 'Balanced — 8GB+ RAM recommended',
  },
  {
    id: 'large',
    label: 'Pro (14B)',
    model: 'qwen2.5:14b',
    minRAM: 16,
    size: '~9GB',
    desc: '고성능 모델 — 16GB RAM 이상 권장',
    descEn: 'High quality — 16GB+ RAM recommended',
  },
  {
    id: 'xlarge',
    label: 'Ultra (32B)',
    model: 'qwen2.5:32b',
    minRAM: 32,
    size: '~20GB',
    desc: '최고 성능 — 32GB RAM 이상 권장',
    descEn: 'Best quality — 32GB+ RAM recommended',
  },
];

/**
 * Detect device RAM and recommend model tier
 */
export function getRecommendedTier() {
  const ram = navigator.deviceMemory || 8; // default 8GB if API unavailable
  if (ram >= 32) return 'xlarge';
  if (ram >= 16) return 'large';
  if (ram >= 8) return 'medium';
  return 'small';
}

/**
 * Check if Ollama is running
 */
export async function checkOllamaStatus() {
  try {
    const res = await fetch(OLLAMA_BASE, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const text = await res.text();
      return { running: text.includes('Ollama'), version: text };
    }
    return { running: false };
  } catch {
    return { running: false };
  }
}

/**
 * List installed models
 */
export async function listModels() {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return data.models || [];
  } catch {
    return [];
  }
}

/**
 * Pull (download) a model — returns a ReadableStream for progress
 */
export async function pullModel(modelName, onProgress) {
  const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        const data = JSON.parse(line);
        if (onProgress) onProgress(data);
      } catch { /* skip partial JSON */ }
    }
  }
}

/**
 * Chat with Ollama — streaming response
 */
export async function chat(model, messages, systemPrompt, onToken) {
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    stream: true,
  };

  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = '';
  let tokenStats = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        const data = JSON.parse(line);
        if (data.message?.content) {
          fullContent += data.message.content;
          if (onToken) onToken(data.message.content, fullContent);
        }
        if (data.done) {
          tokenStats = {
            promptTokens: data.prompt_eval_count || 0,
            completionTokens: data.eval_count || 0,
            totalDurationMs: Math.round((data.total_duration || 0) / 1_000_000),
            model,
          };
        }
      } catch { /* skip partial JSON */ }
    }
  }

  return { content: fullContent, tokenStats };
}
