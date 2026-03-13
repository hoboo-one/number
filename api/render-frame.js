const QUALITY_VALUES = new Set(["low", "medium", "high"]);

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

    const payload = new FormData();
    payload.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
    payload.append("prompt", prompt);
    payload.append("size", "1536x1024");
    payload.append("quality", quality);
    payload.append("output_format", "jpeg");
    payload.append("input_fidelity", inputFidelity === "high" ? "high" : "low");

    images.forEach((file) => {
      payload.append("image[]", file, file.name || "reference.png");
    });

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: payload,
    });

    const data = await readResponseBody(response);

    if (!response.ok) {
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
      return json({ error: "OpenAI 没有返回可用图片。" }, 502);
    }

    return json({
      image: `data:image/jpeg;base64,${imageBase64}`,
      usage: data?.usage || null,
    });
  } catch (error) {
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

  if (error.name === "AbortError") {
    return "请求 OpenAI 超时，请稍后重试。";
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
