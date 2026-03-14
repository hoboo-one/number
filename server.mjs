import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { readFile } from "node:fs/promises";

import renderFrame from "./api/render-frame.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = __dirname;
const host = process.env.HOST || "::";
const port = Number(process.env.PORT || 3000);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    const requestHost = req.headers.host || (host.includes(":") ? `[${host}]:${port}` : `${host}:${port}`);
    const url = new URL(req.url || "/", `http://${requestHost}`);

    if (url.pathname === "/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (url.pathname === "/api/render-frame") {
      await handleApi(req, res, url);
      return;
    }

    await handleStatic(req, res, url);
  } catch (error) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Server error.",
      }),
    );
  }
});

server.listen(port, host, () => {
  console.log(`AngleLab server ready at http://${host}:${port}`);
});

async function handleApi(req, res, url) {
  const init = {
    method: req.method,
    headers: req.headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }

  const request = new Request(url, init);
  const response = await renderFrame(request);
  const body = req.method === "HEAD" ? null : Buffer.from(await response.arrayBuffer());

  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  res.end(body);
}

async function handleStatic(req, res, url) {
  const relativePath = resolveStaticPath(url.pathname);
  const filePath = path.resolve(rootDir, relativePath);

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[extension] || "application/octet-stream";

    res.writeHead(200, { "content-type": contentType });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

function resolveStaticPath(pathname) {
  if (pathname === "/") {
    return "index.html";
  }

  const cleanPath = pathname.replace(/^\/+/, "");
  if (path.extname(cleanPath)) {
    return cleanPath;
  }

  return `${cleanPath}.html`;
}
