// Verpakt de Chrome-extensie tot een Web-Store-uploadbare zip (F4b).
//
//   npm run build:ext && node scripts/pack-extension.mjs
//
// De zip bevat precies wat Chrome nodig heeft — manifest.json, icons/ en dist/
// — met het manifest op zip-root; src/, tools/ en tsconfig blijven eruit.
// Output: extension-build/beyen-tv-ext-v<versie>.zip (gitignored).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import process from "node:process";

const root = process.cwd();
const extDir = join(root, "extension");
const manifestPath = join(extDir, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

for (const required of ["dist/sw.js", "dist/popup.html", "dist/content/panel.js", "icons/icon128.png"]) {
  if (!existsSync(join(extDir, required))) {
    console.error(`Ontbreekt: extension/${required} — draai eerst \`npm run build:ext\`.`);
    process.exit(1);
  }
}

const outDir = join(root, "extension-build");
const stage = join(outDir, "stage");
const zipPath = join(outDir, `beyen-tv-ext-v${manifest.version}.zip`);
rmSync(stage, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(stage, { recursive: true });

cpSync(manifestPath, join(stage, "manifest.json"));
cpSync(join(extDir, "icons"), join(stage, "icons"), { recursive: true });
cpSync(join(extDir, "dist"), join(stage, "dist"), { recursive: true });

if (process.platform === "win32") {
  // Niet Compress-Archive: die schrijft backslash-paden in de zip, wat tegen de
  // zip-spec ingaat en waar de Web-Store-upload over kan struikelen.
  const ps = `
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $stage = "${stage}"
    $zip = [System.IO.Compression.ZipFile]::Open("${zipPath}", "Create")
    Get-ChildItem $stage -Recurse -File | ForEach-Object {
      $rel = $_.FullName.Substring($stage.Length + 1).Replace("\\", "/")
      [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $_.FullName, $rel) | Out-Null
    }
    $zip.Dispose()
  `;
  execFileSync("powershell.exe", ["-NoProfile", "-Command", ps], { stdio: "inherit" });
} else {
  execFileSync("zip", ["-r", zipPath, "."], { cwd: stage, stdio: "inherit" });
}
rmSync(stage, { recursive: true, force: true });
console.log(`Klaar: ${zipPath}`);
