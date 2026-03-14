const QUALITY_VALUES = new Set(["low", "medium", "high"]);
const OPENAI_TIMEOUT_MS = 120_000;

export const runtime = "nodejs";
export const maxDuration = 300;

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const apiKey = request.headers.get("x-openai-key")?.trim();
    const form = await request.formData();
    const prompt = String(form.get("prompt") || "").trim();
    const inputFidelity = String(form.get("inputFidelity") || "low").trim();
    const quality = normalizeQuality(form.get("quality"));
    const model = pickModel(quality);
    const images = form
      .getAll("images")
      .filter((item) => typeof item === "object" && item !== null && "name" in item);

    if (!apiKey) {
      return json({ error: "Missing OpenAI API key. Enter your own key in the page first." }, 401);
    }

    if (!prompt) {
      return json({ error: "缺少生成提示词。" }, 400);
    }

    if (!images.length) {
      return json({ error: "至少需要 1 张参考产品图。" }, 400);
    }

    const totalBytes = images.reduce((sum, file) => sum + (typeof file.size === "number" ? file.size : 0), 0);
    console.log("render-frame:start", JSON.stringify({
      quality,
      model,
      imageCount: images.length,
      totalBytes,
      inputFidelity: inputFidelity === "high" ? "high" : "low",
    }));

    const payload = new FormData();
    payload.append("model", model);
    payload.append("prompt", prompt);
    payload.append("size", "1536x1024");
    payload.append("quality", quality);
    payload.append("output_format", "jpeg");
    payload.append("input_fidelity", inputFidelity === "high" ? "high" : "low");

    images.forEach((file) => {
      payload.append("image[]", file, file.name || "reference.webp");
    });

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
      signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
    });

    const data = await readResponseBody(response);

    if (!response.ok) {
      console.error("render-frame:openai-error", JSON.stringify({ status: response.status, error: data?.error || null }));
      return json(
        {
          error:
            data?.error?.message ||
            data?.error ||
            `OpenAI 图片接口调用失败 (${response.status})。请检查 key、额度或提示词。`,
        },
        response.status,
      );
    }

    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) {
      console.error("render-frame:missing-image", JSON.stringify({ hasData: Boolean(data?.data) }));
      return json({ error: "OpenAI 没有返回可用图片。" }, 502);
    }

    console.log("render-frame:success", JSON.stringify({ usage: data?.usage || null }));
    return json({
      image: `data:image/jpeg;base64,${imageBase64}`,
      usage: data?.usage || null,
    });
  } catch (error) {
    console.error("render-frame:unhandled", error);
    return json(
      {
        error: formatUnhandledError(error),
      },
      500,
    );
  }
}

function normalizeQuality(value) {
  const candidate = String(value || "low").trim().toLowerCase();
  return QUALITY_VALUES.has(candidate) ? candidate : "low";
}

function pickModel(quality) {
  if (process.env.OPENAI_IMAGE_MODEL) {
    return process.env.OPENAI_IMAGE_MODEL;
  }

  return quality === "low" ? "gpt-image-1-mini" : "gpt-image-1";
}

async function readResponseBody(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return { error: "OpenAI 返回了无法解析的 JSON 响应。" };
    }
  }

  const text = await response.text();
  return { error: text.trim() || "OpenAI 没有返回详细错误信息。" };
}

function formatUnhandledError(error) {
  if (!(error instanceof Error)) {
    return "服务器处理请求时出错。";
  }

  if (error.name === "TimeoutError" || error.name === "AbortError") {
    return "OpenAI 出图超时了。建议保持 1 张参考图、使用低成本预览，或换一张更小的产品图再试。";
  }

  return error.message || "服务器处理请求时出错。";
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
