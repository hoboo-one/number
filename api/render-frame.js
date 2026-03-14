const QUALITY_VALUES = new Set(["low", "medium", "high"]);
const DEFAULT_IMAGE_ENDPOINT = "https://api.openai.com/v1/images/edits";
const DEFAULT_IMAGE_SIZE = "1536x1024";
const OPENAI_TIMEOUT_MS = 120_000;

export const runtime = "nodejs";
export const maxDuration = 300;

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const apiKey = readFirstHeader(request, ["x-api-key", "x-openai-key"]).trim();
    const endpoint = resolveImageEndpoint(readFirstHeader(request, ["x-image-endpoint", "x-openai-base-url"]));
    const modelHint = readFirstHeader(request, ["x-image-model", "x-openai-image-model"]).trim();
    const form = await request.formData();
    const prompt = String(form.get("prompt") || "").trim();
    const inputFidelity = String(form.get("inputFidelity") || "low").trim();
    const quality = normalizeQuality(form.get("quality"));
    const model = pickModel(modelHint, quality);
    const images = form
      .getAll("images")
      .filter((item) => typeof item === "object" && item !== null && "name" in item);

    if (!apiKey) {
      return json({ error: "Missing API key. Enter your own key in the page first." }, 401);
    }

    if (!prompt) {
      return json({ error: "缺少生成提示词。" }, 400);
    }

    if (!images.length) {
      return json({ error: "至少需要 1 张参考产品图。" }, 400);
    }

    const totalBytes = images.reduce((sum, file) => sum + (typeof file.size === "number" ? file.size : 0), 0);
    console.log(
      "render-frame:start",
      JSON.stringify({
        endpoint,
        quality,
        model,
        imageCount: images.length,
        totalBytes,
        inputFidelity: inputFidelity === "high" ? "high" : "low",
      }),
    );

    const payload = new FormData();
    payload.append("model", model);
    payload.append("prompt", prompt);
    payload.append("size", DEFAULT_IMAGE_SIZE);
    payload.append("quality", quality);
    payload.append("output_format", "jpeg");
    payload.append("input_fidelity", inputFidelity === "high" ? "high" : "low");

    images.forEach((file) => {
      payload.append("image[]", file, file.name || "reference.webp");
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });

    const data = await readResponseBody(response);

    if (!response.ok) {
      const detail = formatUpstreamError(response.status, data);
      console.error("render-frame:upstream-error", JSON.stringify({ status: response.status, endpoint, detail }));
      return json({ error: detail }, response.status);
    }

    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) {
      console.error("render-frame:missing-image", JSON.stringify({ endpoint, hasData: Boolean(data?.data) }));
      return json({ error: "上游图片接口没有返回可用图片。" }, 502);
    }

    console.log("render-frame:success", JSON.stringify({ endpoint, usage: data?.usage || null }));
    return json({
      image: `data:image/jpeg;base64,${imageBase64}`,
      usage: data?.usage || null,
    });
  } catch (error) {
    if (error instanceof ProviderConfigError) {
      return json({ error: error.message }, 400);
    }

    console.error("render-frame:unhandled", error);
    return json({ error: formatUnhandledError(error) }, 500);
  }
}

class ProviderConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProviderConfigError";
  }
}

function readFirstHeader(request, names) {
  for (const name of names) {
    const value = request.headers.get(name);
    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeQuality(value) {
  const candidate = String(value || "low").trim().toLowerCase();
  return QUALITY_VALUES.has(candidate) ? candidate : "low";
}

function pickModel(modelHint, quality) {
  if (modelHint) {
    return modelHint;
  }

  if (process.env.OPENAI_IMAGE_MODEL) {
    return process.env.OPENAI_IMAGE_MODEL;
  }

  return quality === "low" ? "gpt-image-1-mini" : "gpt-image-1";
}

function resolveImageEndpoint(value) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return DEFAULT_IMAGE_ENDPOINT;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new ProviderConfigError("图片接口 URL 无效。请填写完整的 http(s) 地址。示例：https://api.openai.com/v1/images/edits");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new ProviderConfigError("图片接口 URL 只支持 http 或 https。请检查你填写的地址。");
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/images/edits") || pathname.endsWith("/images/generations")) {
    return url.toString();
  }

  url.pathname = joinUrlPath(pathname, "/images/edits");
  return url.toString();
}

function joinUrlPath(left, right) {
  const normalizedLeft = left && left !== "/" ? left.replace(/\/+$/, "") : "";
  const normalizedRight = right.replace(/^\/+/, "");
  return `${normalizedLeft}/${normalizedRight}`.replace(/\/+/g, "/");
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return { error: "上游图片接口返回了无法解析的 JSON 响应。" };
    }
  }

  const text = await response.text();
  return { error: text.trim() || "上游图片接口没有返回详细错误信息。" };
}

function formatUpstreamError(status, data) {
  const detail =
    data?.error?.message ||
    data?.error?.detail ||
    data?.error ||
    `上游图片接口调用失败 (${status})。`;

  if (status === 401) {
    return `当前 key、接口地址或模型名不匹配：${detail}`;
  }

  if (status === 404) {
    return `图片接口地址或模型名不存在：${detail}`;
  }

  return String(detail);
}

function formatUnhandledError(error) {
  if (!(error instanceof Error)) {
    return "服务端处理请求时出错。";
  }

  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return "上游图片接口超时了。建议先用 1 张参考图、低成本预览，或换一个更快的模型 / 节点再试。";
  }

  return error.message || "服务端处理请求时出错。";
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}