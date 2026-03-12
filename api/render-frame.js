const QUALITY_VALUES = new Set(["low", "medium", "high"]);

export const runtime = "nodejs";
export const maxDuration = 60;

export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  if (!process.env.OPENAI_API_KEY) {
    return json(
      {
        error: "当前环境没有配置 OPENAI_API_KEY。请先在 Vercel 项目环境变量里补上。",
      },
      503,
    );
  }

  try {
    const form = await request.formData();
    const prompt = String(form.get("prompt") || "").trim();
    const inputFidelity = String(form.get("inputFidelity") || "low").trim();
    const quality = normalizeQuality(form.get("quality"));
    const images = form
      .getAll("images")
      .filter((item) => typeof item === "object" && item !== null && "name" in item);

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
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: payload,
    });

    const data = await response.json();

    if (!response.ok) {
      return json(
        {
          error:
            data?.error?.message ||
            "OpenAI 图片接口调用失败，请检查 key、额度或提示词。",
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
        error: error instanceof Error ? error.message : "服务器处理请求时出错。",
      },
      500,
    );
  }
}

function normalizeQuality(value) {
  const candidate = String(value || "low").trim().toLowerCase();
  return QUALITY_VALUES.has(candidate) ? candidate : "low";
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
