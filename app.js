const MAX_FILES = 6;
const STORAGE_KEY = "anglelab-history";
const API_KEY_STORAGE = "anglelab-openai-key";

const state = {
  files: [],
  storyboards: [],
  history: loadHistory(),
  activeJobs: new Set(),
};

const refs = {
  form: document.querySelector("#storyboard-form"),
  uploadInput: document.querySelector("#product-images"),
  apiKeyInput: document.querySelector("#api-key"),
  dropzone: document.querySelector("#dropzone"),
  previewStrip: document.querySelector("#preview-strip"),
  uploadSummary: document.querySelector("#upload-summary"),
  storyboardGrid: document.querySelector("#storyboard-grid"),
  resultGrid: document.querySelector("#result-grid"),
  statusBanner: document.querySelector("#status-banner"),
  statusPill: document.querySelector("#status-pill"),
  generateAll: document.querySelector("#generate-all"),
  clearHistory: document.querySelector("#clear-history"),
  historyList: document.querySelector("#history-list"),
  previewTemplate: document.querySelector("#preview-template"),
  cardTemplate: document.querySelector("#card-template"),
  resultTemplate: document.querySelector("#result-template"),
};

const categoryProfiles = {
  beauty: {
    label: "美妆护肤",
    environment: "clean translucent surfaces, dew, glass reflections, premium cosmetic studio set",
    textures: "serum droplets, frosted glass, satin shadows",
  },
  electronics: {
    label: "3C 数码",
    environment: "precise industrial surfaces, metallic gradients, controlled rim light, futuristic studio",
    textures: "anodized metal, glass, electric glow, soft mist",
  },
  food: {
    label: "食品饮料",
    environment: "editorial food set, appetizing ingredients, natural directional light, premium tabletop scene",
    textures: "steam, condensation, crisp texture, ingredient motion",
  },
  fashion: {
    label: "服饰配件",
    environment: "editorial campaign set, fabric movement, sculptural shadows, tactile surfaces",
    textures: "woven fabric, leather grain, brushed metal, soft reflections",
  },
  home: {
    label: "家居生活",
    environment: "warm designed interior, tactile materials, lifestyle staging, natural daylight",
    textures: "wood grain, linen, ceramics, calm shadows",
  },
  generic: {
    label: "通用消费品",
    environment: "premium commercial still life, layered set design, controlled shadows, generous copy space",
    textures: "clean surfaces, shape-driven highlights, branded details",
  },
};

const moodProfiles = {
  clean: "bright minimal campaign, airy, crisp, premium, restrained props",
  luxury: "luxury editorial lighting, sculptural highlights, dark-to-light gradient backdrop, elevated material richness",
  tech: "high contrast futuristic composition, electric edge light, engineered precision, sleek motion cues",
  lifestyle: "warm narrative scene, believable use context, human touch without distracting from the product",
  appetite: "rich appetizing color, dynamic ingredient energy, cinematic food styling, tactile freshness",
};

const fidelityProfiles = {
  faithful: "Preserve the exact product silhouette, proportions, material color, logo placement, packaging graphics, and key details from the reference images. Avoid imaginative changes to the product itself.",
  balanced: "Keep the product clearly recognizable and faithful to the reference images while elevating the environment, lighting, and composition for a premium ad look.",
  creative: "Preserve the core recognizable product identity from the reference images, but allow bold environmental styling, dramatic lighting, and expressive campaign composition.",
};

const shotLibrary = [
  {
    label: "Shot 01",
    title: "主视觉开场",
    angle: "3/4 主英雄镜头，产品占画面中央偏下，留出标题区。",
    direction: "适合作为封面图或第一屏主 KV。",
    badge: "Hero",
    framing: "front three-quarter hero composition with bold negative space",
  },
  {
    label: "Shot 02",
    title: "材质特写",
    angle: "拉近到产品核心材质或包装细节，突出质感。",
    direction: "适合强调纹理、按键、泵头、标签、表面光泽等卖点。",
    badge: "Macro",
    framing: "macro detail shot with tactile texture emphasis and precise depth of field",
  },
  {
    label: "Shot 03",
    title: "侧面轮廓",
    angle: "从侧面或半侧面展现轮廓，强化结构层次。",
    direction: "适合展示轻薄、厚度、边框、瓶身线条和造型。",
    badge: "Profile",
    framing: "clean side profile composition with strong silhouette lighting",
  },
  {
    label: "Shot 04",
    title: "场景植入",
    angle: "把产品放进真实但克制的使用场景里。",
    direction: "适合品牌故事、受众联想和真实使用氛围。",
    badge: "Lifestyle",
    framing: "context-rich lifestyle composition that still keeps the product as the hero",
  },
  {
    label: "Shot 05",
    title: "功能卖点",
    angle: "放大一个功能重点，用构图或道具暗示产品能力。",
    direction: "适合突出成分、续航、防水、保温、便携等能力。",
    badge: "Feature",
    framing: "feature-led advertising shot with visual storytelling around the main benefit",
  },
  {
    label: "Shot 06",
    title: "收束定版",
    angle: "回到规整的中心式构图，适合作为收尾或广告落版。",
    direction: "适合用在详情页、轮播尾图、转化页主图。",
    badge: "Closeout",
    framing: "refined centered closing shot with elegant symmetry and campaign-level polish",
  },
  {
    label: "Shot 07",
    title: "尺度关系",
    angle: "通过手部、桌面或配件展示产品体量与比例。",
    direction: "适合让用户快速理解大小、手感或便携性。",
    badge: "Scale",
    framing: "scale-defining shot with supporting objects or subtle human interaction",
  },
  {
    label: "Shot 08",
    title: "俯拍陈列",
    angle: "俯拍整理式构图，把产品和辅助元素平铺展开。",
    direction: "适合做电商详情图、信息流卡片和成分展示。",
    badge: "Flat Lay",
    framing: "top-down editorial arrangement with precise spacing and graphic order",
  },
];

bindEvents();
hydrateApiKey();
renderPreviews();
renderStoryboards();
renderResults();
renderHistory();

function bindEvents() {
  refs.dropzone.addEventListener("click", () => refs.uploadInput.click());
  refs.dropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      refs.uploadInput.click();
    }
  });

  refs.dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.dropzone.classList.add("dragover");
  });

  refs.dropzone.addEventListener("dragleave", () => {
    refs.dropzone.classList.remove("dragover");
  });

  refs.dropzone.addEventListener("drop", async (event) => {
    event.preventDefault();
    refs.dropzone.classList.remove("dragover");
    await addFiles(event.dataTransfer.files);
  });

  refs.uploadInput.addEventListener("change", async (event) => {
    await addFiles(event.target.files);
    refs.uploadInput.value = "";
  });

  refs.form.addEventListener("submit", (event) => {
    event.preventDefault();
    handleBuildStoryboard();
  });

  refs.generateAll.addEventListener("click", generateAllFrames);
  refs.clearHistory.addEventListener("click", clearHistory);
  refs.apiKeyInput.addEventListener("input", persistApiKey);
}

async function addFiles(fileList) {
  const incoming = Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));
  if (!incoming.length) {
    setStatus("只支持上传图片文件。", "error");
    return;
  }

  const availableSlots = Math.max(0, MAX_FILES - state.files.length);
  const accepted = incoming.slice(0, availableSlots);

  if (!accepted.length) {
    setStatus(`最多上传 ${MAX_FILES} 张产品图。`, "error");
    return;
  }

  const prepared = await Promise.all(
    accepted.map(async (file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: await fileToDataUrl(file),
    })),
  );

  state.files = [...state.files, ...prepared];
  renderPreviews();

  if (incoming.length > accepted.length) {
    setStatus(`已接收前 ${accepted.length} 张图片，超过 ${MAX_FILES} 张的部分已忽略。`, "error");
    return;
  }

  setStatus("产品图已更新，可以生成新的分镜蓝图了。", "idle");
}

function renderPreviews() {
  refs.previewStrip.innerHTML = "";

  if (!state.files.length) {
    refs.uploadSummary.textContent = "还没有上传产品图。";
    return;
  }

  refs.uploadSummary.textContent = `已上传 ${state.files.length} 张产品图。建议至少 3 张不同角度参考图。`;

  state.files.forEach((entry) => {
    const node = refs.previewTemplate.content.firstElementChild.cloneNode(true);
    const img = node.querySelector("img");
    const remove = node.querySelector(".preview-remove");

    img.src = entry.previewUrl;
    img.alt = entry.file.name;
    remove.addEventListener("click", () => {
      state.files = state.files.filter((item) => item.id !== entry.id);
      renderPreviews();
    });

    refs.previewStrip.appendChild(node);
  });
}

function handleBuildStoryboard() {
  if (!state.files.length) {
    setStatus("先上传至少 1 张产品图，再生成分镜蓝图。", "error");
    return;
  }

  const formData = new FormData(refs.form);
  const config = {
    category: formData.get("category"),
    shotCount: Number(formData.get("shotCount") || 6),
    mood: formData.get("mood"),
    fidelity: formData.get("fidelity"),
    quality: formData.get("quality"),
    audience: String(formData.get("audience") || "").trim(),
    productName: String(formData.get("productName") || "").trim(),
    highlights: tokenizeMultiline(String(formData.get("highlights") || "")),
    directives: String(formData.get("directives") || "").trim(),
  };

  state.storyboards = buildStoryboard(config);
  persistHistory(config);
  renderStoryboards();
  renderResults();
  setStatus("分镜蓝图已生成。你可以逐张生成，也可以点击“逐张生成全部”。", "working");
}

function buildStoryboard(config) {
  const productName =
    config.productName ||
    state.files[0].file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
    "产品";
  const categoryProfile = categoryProfiles[config.category] || categoryProfiles.generic;
  const mood = moodProfiles[config.mood] || moodProfiles.clean;
  const fidelity = fidelityProfiles[config.fidelity] || fidelityProfiles.balanced;
  const audienceLine = config.audience ? `Target audience context: ${config.audience}.` : "";
  const highlightLine = config.highlights.length
    ? `Core selling points to express visually: ${config.highlights.join(", ")}.`
    : "";
  const directiveLine = config.directives ? `Additional creative constraints: ${config.directives}.` : "";
  const referenceLine =
    state.files.length > 1
      ? "Use all uploaded reference images to preserve the product identity consistently across every shot."
      : "Use the uploaded reference image as the source of truth for product shape, color, and branding.";

  return shotLibrary.slice(0, config.shotCount).map((shot, index) => {
    const referenceImageUrl = state.files[Math.min(index, state.files.length - 1)].previewUrl;
    const prompt = [
      `Create a premium 16:9 commercial product image for ${productName}.`,
      `Shot type: ${shot.title}.`,
      `Composition goal: ${shot.framing}.`,
      `Product category cues: ${categoryProfile.environment}; tactile details: ${categoryProfile.textures}.`,
      `Visual direction: ${mood}.`,
      fidelity,
      audienceLine,
      highlightLine,
      directiveLine,
      referenceLine,
      "Keep the product as the primary subject, centered in commercial hierarchy, with believable studio-grade lighting.",
      "No text, no watermark, no fake extra accessories unless clearly motivated by the scene, no duplicate products unless compositionally needed.",
      "Render as a polished advertising still frame with realistic materials, clean edges, and high-end retouching.",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      id: crypto.randomUUID(),
      index: index + 1,
      label: shot.label,
      title: shot.title,
      angle: shot.angle,
      direction: shot.direction,
      badge: shot.badge,
      prompt,
      imageUrl: referenceImageUrl,
      referenceImageUrl,
      renderedImageUrl: "",
      renderedAt: "",
      errorMessage: "",
      usage: null,
      state: "blueprint",
      config,
    };
  });
}

function renderStoryboards() {
  refs.storyboardGrid.innerHTML = "";

  if (!state.storyboards.length) {
    refs.storyboardGrid.innerHTML = `
      <article class="empty-state">
        <p class="empty-title">还没有分镜蓝图</p>
        <p class="empty-text">上传产品图后，系统会自动为你生成多角度广告分镜建议。</p>
      </article>
    `;
    return;
  }

  state.storyboards.forEach((story) => {
    const node = refs.cardTemplate.content.firstElementChild.cloneNode(true);
    const img = node.querySelector(".story-image");
    const generateButton = node.querySelector(".card-generate");
    const downloadLink = node.querySelector(".card-download");
    const errorNode = node.querySelector(".story-error");

    img.src = story.imageUrl;
    img.alt = `${story.title} 预览`;
    node.querySelector(".story-index").textContent = `0${story.index}`;
    node.querySelector(".story-state").textContent = mapStoryState(story.state);
    node.querySelector(".story-label").textContent = story.label;
    node.querySelector(".story-title").textContent = story.title;
    node.querySelector(".story-badge").textContent = story.badge;
    node.querySelector(".story-angle").textContent = story.angle;
    node.querySelector(".story-direction").textContent = story.direction;
    node.querySelector(".story-prompt").textContent = story.prompt;

    if (story.state === "rendered") {
      generateButton.textContent = "重新生成";
    }

    if (story.state === "error" && story.errorMessage) {
      errorNode.hidden = false;
      errorNode.textContent = story.errorMessage;
    }

    if (story.renderedImageUrl) {
      downloadLink.hidden = false;
      downloadLink.href = story.renderedImageUrl;
      downloadLink.download = buildDownloadName(story);
    }

    if (state.activeJobs.has(story.id)) {
      generateButton.disabled = true;
      generateButton.textContent = "生成中...";
      img.classList.add("loading");
    }

    generateButton.addEventListener("click", () => generateFrame(story.id));
    refs.storyboardGrid.appendChild(node);
  });
}

function renderResults() {
  refs.resultGrid.innerHTML = "";

  const renderedStories = state.storyboards
    .filter((story) => Boolean(story.renderedImageUrl))
    .sort((left, right) => new Date(right.renderedAt || 0) - new Date(left.renderedAt || 0));

  if (!renderedStories.length) {
    refs.resultGrid.innerHTML = `
      <article class="empty-state empty-state-compact">
        <div>
          <p class="empty-title">还没有生成图片</p>
          <p class="empty-text">生成成功后，图片会固定保留在这里，方便你直接查看和下载。</p>
        </div>
      </article>
    `;
    return;
  }

  renderedStories.forEach((story) => {
    const node = refs.resultTemplate.content.firstElementChild.cloneNode(true);
    const img = node.querySelector(".result-image");
    const downloadLink = node.querySelector(".result-download");
    const meta = [];

    img.src = story.renderedImageUrl;
    img.alt = `${story.title} 生成结果`;
    node.querySelector(".result-label").textContent = story.label;
    node.querySelector(".result-title").textContent = story.title;
    node.querySelector(".result-badge").textContent = story.badge;

    if (story.renderedAt) {
      meta.push(`生成于 ${formatDate(story.renderedAt)}`);
    }
    meta.push(`质量 ${mapQuality(story.config.quality)}`);
    if (story.usage?.total_tokens) {
      meta.push(`tokens ${story.usage.total_tokens}`);
    }

    node.querySelector(".result-meta").textContent = meta.join(" · ");
    downloadLink.href = story.renderedImageUrl;
    downloadLink.download = buildDownloadName(story);
    refs.resultGrid.appendChild(node);
  });
}

async function generateFrame(storyId) {
  const story = state.storyboards.find((item) => item.id === storyId);
  if (!story || state.activeJobs.has(storyId)) {
    return;
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    setStatus("先输入你自己的 OpenAI API Key，再开始生成图片。", "error");
    refs.apiKeyInput.focus();
    return;
  }

  state.activeJobs.add(storyId);
  story.state = "working";
  story.errorMessage = "";
  renderStoryboards();
  setStatus(`正在生成「${story.title}」...`, "working");

  try {
    const payload = new FormData();
    payload.append("prompt", story.prompt);
    payload.append("quality", story.config.quality);
    payload.append("inputFidelity", story.config.fidelity === "faithful" ? "high" : "low");

    state.files.forEach((entry) => {
      payload.append("images", entry.file, entry.file.name);
    });

    const response = await fetch("/api/render-frame", {
      method: "POST",
      headers: {
        "x-openai-key": apiKey,
      },
      body: payload,
    });

    const data = await parseApiResponse(response);

    if (!response.ok) {
      throw new Error(formatApiError(response.status, data.error));
    }

    if (!data.image) {
      throw new Error("接口返回成功，但没有带回图片数据。请稍后重试。");
    }

    story.imageUrl = data.image;
    story.renderedImageUrl = data.image;
    story.renderedAt = new Date().toISOString();
    story.usage = data.usage || null;
    story.state = "rendered";
    story.errorMessage = "";
    setStatus(`「${story.title}」生成完成，结果已显示在下方结果区。`, "working");
  } catch (error) {
    story.state = "error";
    story.imageUrl = story.renderedImageUrl || story.referenceImageUrl;
    story.errorMessage = error instanceof Error ? error.message : "生成失败，请稍后再试。";
    setStatus(story.errorMessage, "error");
  } finally {
    state.activeJobs.delete(storyId);
    renderStoryboards();
    renderResults();
  }
}

async function generateAllFrames() {
  if (!state.storyboards.length) {
    setStatus("先生成分镜蓝图，再批量出图。", "error");
    return;
  }

  if (!getApiKey()) {
    setStatus("先输入你自己的 OpenAI API Key，再开始生成图片。", "error");
    refs.apiKeyInput.focus();
    return;
  }

  let successCount = 0;

  for (const story of state.storyboards) {
    const hadImage = Boolean(story.renderedImageUrl);
    await generateFrame(story.id);
    if (!hadImage && state.storyboards.find((item) => item.id === story.id)?.renderedImageUrl) {
      successCount += 1;
    }
  }

  const renderedCount = state.storyboards.filter((story) => story.renderedImageUrl).length;
  if (renderedCount) {
    setStatus(`批量处理完成，当前共有 ${renderedCount} 张结果图，其中本轮新增 ${successCount} 张。`, "working");
  }
}

function persistHistory(config) {
  const summary = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    title: config.productName || state.files[0].file.name.replace(/\.[^.]+$/, "") || "未命名产品",
    summary: `${categoryProfiles[config.category].label} / ${config.shotCount} 张 / ${labelMood(config.mood)}`,
  };

  state.history = [summary, ...state.history].slice(0, 6);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  refs.historyList.innerHTML = "";

  if (!state.history.length) {
    refs.historyList.innerHTML = `
      <div class="history-item">
        <div>
          <strong>暂无记录</strong>
          <span>生成过蓝图后，这里会保留最近 6 次配置摘要。</span>
        </div>
      </div>
    `;
    return;
  }

  state.history.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "history-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(entry.title)}</strong>
        <span>${escapeHtml(entry.summary)}</span>
      </div>
      <div class="history-stamp">${formatDate(entry.createdAt)}</div>
    `;
    refs.historyList.appendChild(item);
  });
}

function clearHistory() {
  state.history = [];
  window.localStorage.removeItem(STORAGE_KEY);
  renderHistory();
}

function hydrateApiKey() {
  try {
    const value = window.sessionStorage.getItem(API_KEY_STORAGE) || "";
    refs.apiKeyInput.value = value;
  } catch {
    refs.apiKeyInput.value = "";
  }
}

function persistApiKey() {
  const value = refs.apiKeyInput.value.trim();

  try {
    if (value) {
      window.sessionStorage.setItem(API_KEY_STORAGE, value);
    } else {
      window.sessionStorage.removeItem(API_KEY_STORAGE);
    }
  } catch {
    // Ignore sessionStorage access issues and keep the value only in memory.
  }
}

function getApiKey() {
  return refs.apiKeyInput.value.trim();
}

function setStatus(message, tone = "idle") {
  refs.statusBanner.textContent = message;
  refs.statusPill.textContent = tone === "working" ? "处理中" : tone === "error" ? "需要处理" : "准备就绪";
  refs.statusPill.className = `status-pill status-${tone}`;
}

function loadHistory() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function tokenizeMultiline(input) {
  return input.split(/\n|,|，/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
}

function labelMood(mood) {
  const labels = {
    clean: "清透极简",
    luxury: "高级质感",
    tech: "未来科技",
    lifestyle: "生活方式",
    appetite: "食欲大片",
  };

  return labels[mood] || "未分类";
}

function mapQuality(value) {
  const labels = {
    low: "低成本预览",
    medium: "中等质量",
    high: "高质感大片",
  };

  return labels[value] || "默认质量";
}

function mapStoryState(value) {
  const labels = {
    blueprint: "蓝图",
    working: "生成中",
    rendered: "已出图",
    error: "失败",
  };

  return labels[value] || "蓝图";
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return {
        error: "服务端返回了无法解析的 JSON 响应。",
      };
    }
  }

  const text = await response.text();
  return {
    error: text.trim() || `服务端返回了 ${response.status}，但没有附带详细错误信息。`,
  };
}

function formatApiError(status, message) {
  const detail = String(message || "请求失败，请稍后重试。").trim();

  if (status === 400) {
    return `请求参数有问题：${detail}`;
  }
  if (status === 401) {
    return `API Key 不可用：${detail}`;
  }
  if (status === 408 || status === 504) {
    return `图片生成超时：${detail}`;
  }
  if (status === 429) {
    return `请求过于频繁或额度不足：${detail}`;
  }
  if (status >= 500) {
    return `服务端处理失败 (${status})：${detail}`;
  }

  return `图片生成失败 (${status})：${detail}`;
}

function buildDownloadName(story) {
  const productName = story.config.productName || state.files[0]?.file?.name || "product";
  const safeName = productName
    .replace(/\.[^.]+$/, "")
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim()
    .replace(/\s+/g, "-");

  return `${safeName || "product"}-shot-${String(story.index).padStart(2, "0")}.jpg`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("图片读取失败。"));
    reader.readAsDataURL(file);
  });
}

function formatDate(value) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
