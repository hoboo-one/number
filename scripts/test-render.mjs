import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const rootDir = process.cwd();
const apiKey = args["api-key"] || process.env.OPENAI_API_KEY || (await readEnvFile(rootDir)).OPENAI_API_KEY;
const prompt = args.prompt || "Create a premium 16:9 commercial product shot.";
const inputPath = args.input ? path.resolve(rootDir, args.input) : null;
const outputPath = path.resolve(rootDir, args.output || "tmp/test-render.jpg");
const endpoint = args.url || "http://127.0.0.1:3000/api/render-frame";

if (!apiKey) {
  console.error("Missing OpenAI API key. Set OPENAI_API_KEY in .env.local or pass --api-key.");
  process.exit(1);
}

const inputFile = inputPath ? await loadInputFile(inputPath) : await createPlaceholderFile();
const form = new FormData();
form.append("prompt", prompt);
form.append("quality", args.quality || "low");
form.append("inputFidelity", args.fidelity || "low");
form.append("images", inputFile, inputFile.name);

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "x-openai-key": apiKey,
  },
  body: form,
});

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(`Render failed with ${response.status}: ${payload.error || "Unknown error"}`);
  process.exit(1);
}

if (!payload.image || !payload.image.startsWith("data:image/")) {
  console.error("Render succeeded but no image payload was returned.");
  process.exit(1);
}

const base64 = payload.image.split(",", 2)[1];
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, Buffer.from(base64, "base64"));
console.log(`Saved render output to ${outputPath}`);
if (payload.usage) {
  console.log(JSON.stringify(payload.usage, null, 2));
}

async function loadInputFile(filePath) {
  const buffer = await readFile(filePath);
  return new File([buffer], path.basename(filePath), { type: detectType(filePath) });
}

async function createPlaceholderFile() {
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJkQAAAAASUVORK5CYII=", "base64");
  return new File([bytes], "placeholder.png", { type: "image/png" });
}

function detectType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

async function readEnvFile(cwd) {
  const envPath = path.join(cwd, ".env.local");
  try {
    const raw = await readFile(envPath, "utf8");
    return Object.fromEntries(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#") && line.includes("="))
        .map((line) => {
          const [key, ...rest] = line.split("=");
          return [key.trim(), rest.join("=").trim().replace(/^['\"]|['\"]$/g, "")];
        }),
    );
  } catch {
    return {};
  }
}

function parseArgs(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) continue;

    const key = entry.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
      continue;
    }

    result[key] = next;
    index += 1;
  }

  return result;
}
