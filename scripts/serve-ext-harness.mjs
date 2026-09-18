// Mini-statische server voor het extensie-dev-harnas (extension/dev/harness.html).
// Bewust dependency-vrij (node:http) — alleen voor lokale visuele verificatie.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import process from "node:process";

// Optioneel: root en poort als argumenten, zodat je ook een andere checkout
// (bv. een tijdelijke worktree) kunt serveren zonder cwd te verhuizen.
const root = process.argv[2] ?? process.cwd();
const port = Number(process.env.PORT ?? process.argv[3] ?? 8123);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json",
  ".map": "application/json",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    let path = normalize(decodeURIComponent(url.pathname)).replaceAll("\\", "/");
    if (path === "/" || path === "") path = "/extension/dev/harness.html";
    if (path.includes("..")) throw new Error("buiten root");
    const file = join(root, path);
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
}).listen(port, () => console.log(`harnas op http://localhost:${port}/ (root: ${root})`));
