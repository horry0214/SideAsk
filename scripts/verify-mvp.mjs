import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionRoot = path.join(root, "extension");

function fail(message) {
  throw new Error(message);
}

function exists(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) fail(`Missing required file: ${relativePath}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(fs.readFileSync(path.join(extensionRoot, "manifest.json"), "utf8"));
if (manifest.version !== packageJson.version) fail(`Version mismatch: manifest=${manifest.version}, package=${packageJson.version}`);
if (packageJson.license !== "MIT") fail(`Unexpected package license: ${packageJson.license || "missing"}`);

[
  "README.md", "README.zh-CN.md", "LICENSE", "CHANGELOG.md", "CONTRIBUTING.md", "CONTRIBUTING.zh-CN.md",
  "SECURITY.md", "SECURITY.zh-CN.md", "PRIVACY.md", "PRIVACY.zh-CN.md", "CODE_OF_CONDUCT.md", "CODE_OF_CONDUCT.zh-CN.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml", ".github/ISSUE_TEMPLATE/feature_request.yml", ".github/PULL_REQUEST_TEMPLATE.md",
  "docs/PRODUCT.md", "docs/ARCHITECTURE.md", "docs/PROVIDERS.md", "docs/KNOWLEDGE_MODEL.md", "docs/ROADMAP.md",
  "extension/background.js", "extension/content.js", "extension/content.css", "extension/markdown.js", "extension/storage.js",
  "extension/options.html", "extension/options.js", "extension/options.css", "extension/preview-data.js", "server/server.mjs",
].forEach(exists);

[
  manifest.background.service_worker,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons || {}),
  ...manifest.content_scripts.flatMap(item => [...(item.js || []), ...(item.css || [])]),
  ...(manifest.web_accessible_resources || []).flatMap(item => item.resources || []),
].filter(Boolean).forEach(relativePath => {
  if (!fs.existsSync(path.join(extensionRoot, relativePath))) fail(`Manifest path does not exist: ${relativePath}`);
});

const optionsHtml = fs.readFileSync(path.join(extensionRoot, "options.html"), "utf8");
const optionsJs = fs.readFileSync(path.join(extensionRoot, "options.js"), "utf8");
const htmlIds = new Set([...optionsHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const referencedIds = new Set([...optionsJs.matchAll(/\$\("#([^"]+)"\)/g)].map(match => match[1]));
for (const id of referencedIds) {
  if (!htmlIds.has(id)) fail(`options.js references missing DOM id: ${id}`);
}

const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
for (const match of readme.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
  const target = match[1];
  if (/^(https?:\/\/|#)/i.test(target)) continue;
  if (!fs.existsSync(path.resolve(root, target))) fail(`Broken README link: ${target}`);
}

if (fs.existsSync(path.join(root, "server", ".env"))) fail("server/.env must not be included in a deliverable");

const textExtensions = new Set([".js", ".mjs", ".json", ".md", ".html", ".css", ".txt", ".example", ".sh", ".bat"]);
const secretPattern = /\bsk-(?:cp|api|proj|live)-[A-Za-z0-9_-]{24,}\b/g;
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(absolute);
    else if (textExtensions.has(path.extname(entry.name)) || entry.name === ".env.example") {
      const value = fs.readFileSync(absolute, "utf8");
      if (secretPattern.test(value)) fail(`Possible committed API Key: ${path.relative(root, absolute)}`);
      secretPattern.lastIndex = 0;
    }
  }
}
scan(root);

console.log(`SideAsk ${manifest.version} MVP verification passed.`);
console.log(`Manifest paths: OK · Options DOM refs: ${referencedIds.size} · README links: OK · Credential scan: OK`);
