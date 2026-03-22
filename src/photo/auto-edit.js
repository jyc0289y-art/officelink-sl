/**
 * OfficeLink SL — Photo Auto-Edit (Local + Ollama + Claude API)
 * Ported from PhotoLink (React/TS → vanilla JS)
 */

/* ==================== Local Auto-Edit ==================== */

export function analyzeLocal(imageDataUrl, onProgress) {
  return new Promise((resolve) => {
    onProgress?.('이미지 분석 중...');
    const img = new Image();
    img.onload = () => {
      const maxSize = 512;
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      onProgress?.('히스토그램 분석 중...');
      const stats = computeStats(imageData.data, canvas.width, canvas.height);
      onProgress?.('사진 유형 감지 중...');
      const sceneType = detectScene(stats);
      onProgress?.('편집 파라미터 생성 중...');
      const params = generateParams(stats, sceneType);
      const summary = generateSummary(stats, sceneType);
      const recommendation = generateRecommendation(stats, sceneType);
      resolve({ summary, recommendation, params, stats, sceneType });
    };
    img.src = imageDataUrl;
  });
}

function computeStats(pixels, width, height) {
  const totalPixels = pixels.length / 4;
  let rSum = 0, gSum = 0, bSum = 0, brightnessSum = 0, satSum = 0, hueX = 0, hueY = 0;
  const histogram = new Uint32Array(256);
  let centerBrightnessSum = 0, centerCount = 0, edgeBrightnessSum = 0, edgeCount = 0;
  let skinToneCount = 0, greenDominantCount = 0, blueSkyCount = 0, darkPixelCount = 0;
  const cx = width / 2, cy = height / 2;
  const centerRadiusSq = (Math.min(width, height) * 0.3) ** 2;

  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    rSum += r; gSum += g; bSum += b;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    brightnessSum += lum;
    histogram[Math.round(lum)] = (histogram[Math.round(lum)] || 0) + 1;
    if (lum < 30) darkPixelCount++;
    const px = (i / 4) % width, py = Math.floor((i / 4) / width);
    const distSq = (px - cx) ** 2 + (py - cy) ** 2;
    if (distSq < centerRadiusSq) { centerBrightnessSum += lum; centerCount++; }
    else { edgeBrightnessSum += lum; edgeCount++; }
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && lum > 60 && lum < 230) skinToneCount++;
    if (g > r * 1.1 && g > b * 1.2 && g > 50) greenDominantCount++;
    if (b > r * 1.3 && b > g * 1.1 && b > 100 && lum > 100) blueSkyCount++;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 510;
    let sat = 0;
    if (max !== min) sat = l > 0.5 ? (max - min) / (510 - max - min) : (max - min) / (max + min);
    satSum += sat;
    if (max !== min) {
      let h = 0; const d = max - min;
      if (max === r) h = ((g - b) / d + 6) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      hueX += Math.cos(h * Math.PI / 180) * sat;
      hueY += Math.sin(h * Math.PI / 180) * sat;
    }
  }

  const avgBrightness = brightnessSum / totalPixels;
  const avgR = rSum / totalPixels, avgG = gSum / totalPixels, avgB = bSum / totalPixels;
  let varianceSum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    varianceSum += (lum - avgBrightness) ** 2;
  }
  const brightnessStdDev = Math.sqrt(varianceSum / totalPixels);
  let minBin = 255, maxBin = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > totalPixels * 0.001) { minBin = Math.min(minBin, i); maxBin = Math.max(maxBin, i); }
  }
  let shadowClip = 0, highlightClip = 0;
  for (let i = 0; i < 10; i++) shadowClip += histogram[i] || 0;
  for (let i = 245; i < 256; i++) highlightClip += histogram[i] || 0;
  const rbRatio = avgR / Math.max(avgB, 1);
  let colorTemp;
  if (rbRatio > 1.5) colorTemp = 3000;
  else if (rbRatio > 1.2) colorTemp = 4000;
  else if (rbRatio > 0.95) colorTemp = 5500;
  else if (rbRatio > 0.75) colorTemp = 7000;
  else colorTemp = 9000;
  let dominantChannel = 'neutral';
  const channelDiff = Math.max(avgR, avgG, avgB) - Math.min(avgR, avgG, avgB);
  if (channelDiff > 15) {
    if (avgR > avgG && avgR > avgB) dominantChannel = 'r';
    else if (avgG > avgR && avgG > avgB) dominantChannel = 'g';
    else dominantChannel = 'b';
  }
  return {
    avgBrightness, brightnessStdDev, avgSaturation: satSum / totalPixels,
    avgHue: ((Math.atan2(hueY, hueX) * 180 / Math.PI) + 360) % 360,
    colorTemp, dynamicRange: (maxBin - minBin) / 255,
    shadowClip: shadowClip / totalPixels, highlightClip: highlightClip / totalPixels,
    dominantChannel,
    centerBrightness: centerCount > 0 ? centerBrightnessSum / centerCount : avgBrightness,
    edgeBrightness: edgeCount > 0 ? edgeBrightnessSum / edgeCount : avgBrightness,
    skinToneRatio: skinToneCount / totalPixels,
    greenRatio: greenDominantCount / totalPixels,
    blueRatio: blueSkyCount / totalPixels,
    darkPixelRatio: darkPixelCount / totalPixels,
  };
}

function detectScene(stats) {
  if (stats.avgBrightness < 60 && stats.darkPixelRatio > 0.4) return 'night';
  if (stats.edgeBrightness - stats.centerBrightness > 40 && stats.highlightClip > 0.02) return 'backlit';
  if (stats.skinToneRatio > 0.15) return 'portrait';
  if (stats.greenRatio > 0.15 || (stats.greenRatio > 0.08 && stats.blueRatio > 0.05)) return 'landscape';
  if (stats.avgSaturation > 0.4 && stats.dynamicRange < 0.6 && stats.brightnessStdDev < 50) return 'macro';
  return 'general';
}

function generateParams(stats, scene) {
  const params = {};
  const targetBrightness = { portrait: 118, landscape: 112, night: 65, backlit: 105, macro: 115, general: 112 };
  const target = targetBrightness[scene];
  const brightnessDelta = target - stats.avgBrightness;
  if (scene === 'night') { if (brightnessDelta > 15) params.exposure = clamp(brightnessDelta / 80, 0.1, 0.6); }
  else if (scene === 'backlit') { params.exposure = clamp(brightnessDelta / 50, -0.5, 1.0); }
  else { if (Math.abs(brightnessDelta) > 10) params.exposure = clamp(brightnessDelta / 60, -1.0, 1.0); }

  const ct = { portrait: { low: 50, high: 80, gain: 0.5 }, landscape: { low: 55, high: 85, gain: 0.8 },
    night: { low: 45, high: 90, gain: 0.4 }, backlit: { low: 50, high: 80, gain: 0.6 },
    macro: { low: 55, high: 80, gain: 0.6 }, general: { low: 55, high: 80, gain: 0.6 } }[scene];
  if (stats.brightnessStdDev < ct.low) params.contrast = clamp(Math.round((ct.low - stats.brightnessStdDev) * ct.gain), 3, 25);
  else if (stats.brightnessStdDev > ct.high) params.contrast = clamp(Math.round((70 - stats.brightnessStdDev) * 0.4), -20, -3);

  if (scene === 'backlit') {
    params.highlights = clamp(Math.round(-stats.highlightClip * 2000), -60, -15);
    params.shadows = clamp(Math.round(stats.shadowClip * 2000 + 15), 15, 50);
  } else if (scene === 'night') {
    params.highlights = stats.highlightClip > 0.01 ? clamp(Math.round(-stats.highlightClip * 1500), -35, -5) : 0;
    params.shadows = clamp(Math.round(stats.shadowClip * 1000), 0, 20);
  } else {
    if (stats.highlightClip > 0.01) params.highlights = clamp(Math.round(-stats.highlightClip * 1500), -50, -5);
    if (stats.shadowClip > 0.01) params.shadows = clamp(Math.round(stats.shadowClip * 1500), 5, 35);
  }

  const tempDiff = stats.colorTemp - 5800;
  if (scene === 'night') { if (tempDiff < -800) params.colorTemp = clamp(Math.round(5800 - tempDiff * 0.2), 4800, 6500); }
  else if (scene === 'portrait') { if (Math.abs(tempDiff) > 400) params.colorTemp = clamp(Math.round(5900 - tempDiff * 0.25), 4500, 7000); }
  else { if (Math.abs(tempDiff) > 400) params.colorTemp = clamp(Math.round(5800 - tempDiff * 0.3), 4000, 7500); }

  if (scene === 'portrait') { params.vibrance = clamp(Math.round((0.3 - stats.avgSaturation) * 80), 0, 15); }
  else if (scene === 'landscape') { params.vibrance = clamp(Math.round((0.4 - stats.avgSaturation) * 100), 5, 25); params.saturation = clamp(Math.round((0.35 - stats.avgSaturation) * 50), 0, 12); }
  else if (scene === 'night') { if (stats.avgSaturation < 0.2) params.vibrance = clamp(Math.round((0.22 - stats.avgSaturation) * 80), 3, 12); }
  else {
    if (stats.avgSaturation < 0.2) { params.vibrance = clamp(Math.round((0.3 - stats.avgSaturation) * 100), 5, 20); params.saturation = clamp(Math.round((0.22 - stats.avgSaturation) * 60), 0, 10); }
    else if (stats.avgSaturation < 0.35) { params.vibrance = clamp(Math.round((0.35 - stats.avgSaturation) * 60), 3, 15); }
    else if (stats.avgSaturation > 0.55) { params.saturation = clamp(Math.round((0.5 - stats.avgSaturation) * 50), -15, -3); }
  }

  if (scene === 'portrait') { params.clarity = clamp(Math.round((0.75 - stats.dynamicRange) * 10), 0, 8); }
  else if (scene === 'landscape') { params.clarity = clamp(Math.round((0.85 - stats.dynamicRange) * 40), 8, 25); }
  else if (scene === 'night') { params.clarity = clamp(Math.round((0.75 - stats.dynamicRange) * 15), 0, 10); }
  else { params.clarity = stats.dynamicRange < 0.8 ? clamp(Math.round((0.8 - stats.dynamicRange) * 30), 5, 18) : 5; }

  return params;
}

function generateSummary(stats, scene) {
  const names = { portrait: '인물 사진', landscape: '풍경 사진', night: '야경/저조도', backlit: '역광 사진', macro: '접사/클로즈업', general: '일반 사진' };
  const parts = [`[${names[scene]}]`];
  if (stats.avgBrightness < 80) parts.push('어두운 이미지');
  else if (stats.avgBrightness < 120) parts.push('약간 어두운 이미지');
  else if (stats.avgBrightness > 180) parts.push('밝은 이미지');
  else parts.push('적정 밝기');
  if (stats.brightnessStdDev < 40) parts.push('낮은 콘트라스트');
  else if (stats.brightnessStdDev > 80) parts.push('높은 콘트라스트');
  if (stats.colorTemp < 4500) parts.push('차가운 색조');
  else if (stats.colorTemp > 6500) parts.push('따뜻한 색조');
  if (stats.avgSaturation < 0.15) parts.push('낮은 채도');
  else if (stats.avgSaturation > 0.5) parts.push('높은 채도');
  if (stats.highlightClip > 0.03) parts.push('하이라이트 클리핑');
  if (stats.shadowClip > 0.03) parts.push('섀도 클리핑');
  return parts.join(' · ');
}

function generateRecommendation(stats, scene) {
  const tips = [];
  switch (scene) {
    case 'portrait': tips.push('피부톤을 자연스럽게 보정합니다'); if (stats.brightnessStdDev > 70) tips.push('콘트라스트를 낮춰 부드러운 인물 느낌을 줍니다'); break;
    case 'landscape': tips.push('풍경의 색감과 디테일을 강화합니다'); break;
    case 'night': tips.push('야경 분위기를 유지하면서 디테일을 살립니다'); break;
    case 'backlit': tips.push('역광으로 어두워진 피사체를 복원합니다'); break;
    case 'macro': tips.push('접사 디테일과 색감을 강조합니다'); break;
  }
  if (stats.avgBrightness < 100 && scene !== 'night') tips.push('노출을 올려 디테일을 살립니다');
  else if (stats.avgBrightness > 170) tips.push('노출을 낮춰 디테일을 복원합니다');
  if (stats.highlightClip > 0.02) tips.push('하이라이트를 억제하여 날아간 부분을 복원합니다');
  if (stats.shadowClip > 0.02 && scene !== 'night') tips.push('섀도를 올려 어두운 부분의 디테일을 살립니다');
  if (stats.avgSaturation < 0.15) tips.push('자연채도를 높여 색감을 살립니다');
  if (tips.length === 0) tips.push('전체적으로 밸런스를 최적화합니다');
  return tips.join('. ') + '.';
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/* ==================== Ollama Auto-Edit ==================== */

export function getOllamaUrl() { return localStorage.getItem('officelink-ollama-url') || 'http://localhost:11434'; }
export function setOllamaUrl(url) { localStorage.setItem('officelink-ollama-url', url); }
export function getOllamaModel() { return localStorage.getItem('officelink-ollama-model') || 'llava'; }
export function setOllamaModel(model) { localStorage.setItem('officelink-ollama-model', model); }

export async function checkOllamaStatus() {
  const url = getOllamaUrl();
  try {
    const res = await fetch(`${url}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { connected: false, models: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    return { connected: true, models: (data.models || []).map(m => m.name) };
  } catch { return { connected: false, models: [] }; }
}

export async function pullOllamaModel(model, onProgress) {
  const url = getOllamaUrl();
  onProgress?.(`${model} 다운로드 시작...`);
  const res = await fetch(`${url}/api/pull`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: model, stream: true }),
  });
  if (!res.ok) throw new Error(`모델 다운로드 실패 (${res.status})`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error('스트림을 읽을 수 없습니다');
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        const json = JSON.parse(line);
        if (json.total && json.completed) onProgress?.(`${model} 다운로드 중... ${Math.round((json.completed / json.total) * 100)}%`);
        else if (json.status) onProgress?.(json.status);
      } catch { /* skip */ }
    }
  }
  onProgress?.(`${model} 설치 완료!`);
}

export async function analyzeWithOllama(imageDataUrl, onProgress) {
  const ollamaUrl = getOllamaUrl();
  const model = getOllamaModel();
  onProgress?.('이미지 준비 중...');
  const resizedBase64 = await resizeImage(imageDataUrl, 512);
  const prompt = `You are a professional photo editor. Analyze this photo and suggest edit parameters.
Respond ONLY with this JSON (no other text):
\`\`\`json
{"subject":"brief subject","mood":"mood","recommendation":"editing direction in Korean (2-3 sentences)","params":{"exposure":0,"contrast":0,"highlights":0,"shadows":0,"colorTemp":5800,"saturation":0,"vibrance":0,"clarity":0}}
\`\`\`
Parameter ranges: exposure -3~+3, contrast/highlights/shadows/saturation/vibrance/clarity -100~+100, colorTemp 2000~10000.`;
  onProgress?.(`${model} 모델로 분석 중...`);
  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, images: [resizedBase64], stream: false, options: { temperature: 0.3 } }),
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error(`모델 '${model}'을 찾을 수 없습니다.`);
    throw new Error(`Ollama 오류 (${response.status})`);
  }
  onProgress?.('응답 파싱 중...');
  const data = await response.json();
  const text = data.response || '';
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*"params"[\s\S]*\}/);
  if (!jsonMatch) throw new Error('LLM 응답에서 파라미터를 추출할 수 없습니다.');
  const analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const p = analysis.params;
  const safeParams = {};
  if (p.exposure !== undefined) safeParams.exposure = clamp(p.exposure, -3, 3);
  if (p.contrast !== undefined) safeParams.contrast = clamp(p.contrast, -100, 100);
  if (p.highlights !== undefined) safeParams.highlights = clamp(p.highlights, -100, 100);
  if (p.shadows !== undefined) safeParams.shadows = clamp(p.shadows, -100, 100);
  if (p.colorTemp !== undefined) safeParams.colorTemp = clamp(p.colorTemp, 2000, 10000);
  if (p.saturation !== undefined) safeParams.saturation = clamp(p.saturation, -100, 100);
  if (p.vibrance !== undefined) safeParams.vibrance = clamp(p.vibrance, -100, 100);
  if (p.clarity !== undefined) safeParams.clarity = clamp(p.clarity, -100, 100);
  return { ...analysis, params: safeParams };
}

/* ==================== Claude API Auto-Edit ==================== */

export function getApiKey() { return localStorage.getItem('officelink-photo-api-key'); }
export function setApiKey(key) { localStorage.setItem('officelink-photo-api-key', key); }

export async function analyzeWithClaude(imageDataUrl, apiKey, onProgress) {
  onProgress?.('사진 분석 중...');
  const resizedBase64 = await resizeImage(imageDataUrl, 1024);
  const prompt = `당신은 전문 사진 편집자입니다. 이 사진을 분석하고 최적의 편집 파라미터를 제안해주세요.
## 응답 형식 (반드시 이 JSON 구조로)
\`\`\`json
{"subject":"피사체 설명","mood":"분위기","recommendation":"편집 방향 (2-3문장)","params":{"exposure":0,"contrast":0,"highlights":0,"shadows":0,"colorTemp":5800,"saturation":0,"vibrance":0,"clarity":0}}
\`\`\`
파라미터 범위: exposure -3~+3, contrast/highlights/shadows/saturation/vibrance/clarity -100~+100, colorTemp 2000~10000.`;
  onProgress?.('AI가 피사체를 분석하고 있습니다...');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', 'x-api-key': apiKey,
      'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 1500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: resizedBase64 } },
        { type: 'text', text: prompt },
      ]}],
    }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('API 키가 유효하지 않습니다.');
    if (response.status === 429) throw new Error('API 요청 한도 초과.');
    throw new Error(`API 오류 (${response.status})`);
  }
  onProgress?.('편집 파라미터를 생성하고 있습니다...');
  const data = await response.json();
  const text = data.content[0].text;
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*"params"[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI 응답에서 파라미터를 추출할 수 없습니다.');
  const analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
  const p = analysis.params;
  const safeParams = {};
  if (p.exposure !== undefined) safeParams.exposure = clamp(p.exposure, -3, 3);
  if (p.contrast !== undefined) safeParams.contrast = clamp(p.contrast, -100, 100);
  if (p.highlights !== undefined) safeParams.highlights = clamp(p.highlights, -100, 100);
  if (p.shadows !== undefined) safeParams.shadows = clamp(p.shadows, -100, 100);
  if (p.colorTemp !== undefined) safeParams.colorTemp = clamp(p.colorTemp, 2000, 10000);
  if (p.saturation !== undefined) safeParams.saturation = clamp(p.saturation, -100, 100);
  if (p.vibrance !== undefined) safeParams.vibrance = clamp(p.vibrance, -100, 100);
  if (p.clarity !== undefined) safeParams.clarity = clamp(p.clarity, -100, 100);
  return { ...analysis, params: safeParams };
}

/* ==================== Helpers ==================== */

async function resizeImage(dataUrl, maxSize) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
    img.src = dataUrl;
  });
}
