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
  "extension/provider-catalog.js",
  "extension/options.html", "extension/options.js", "extension/options.css", "extension/preview-data.js",
  "extension/welcome.html", "extension/welcome.js", "extension/welcome.css", "extension/practice.html", "extension/practice.js", "extension/practice.css",
  "extension/_locales/en/messages.json", "extension/_locales/zh_CN/messages.json", "server/server.mjs",
  "store/README.md", "store/LISTING.md", "store/PRIVACY-DECLARATIONS.md", "store/REVIEW-NOTES.md", "store/SUBMISSION-CHECKLIST.md",
  "store/PRIVACY-CHROME.md", "store/PRIVACY-EDGE.md", "store/GATEWAY-README.md",
  "store-assets/shared/icon-128.png", "store-assets/shared/edge-logo-300.png", "store-assets/shared/promo-small-440x280.png", "store-assets/shared/promo-marquee-1400x560.png",
].forEach(exists);

[
  manifest.background.service_worker,
  manifest.options_ui?.page,
  ...Object.values(manifest.icons || {}),
  ...(manifest.content_scripts || []).flatMap(item => [...(item.js || []), ...(item.css || [])]),
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

const welcomeHtml = fs.readFileSync(path.join(extensionRoot, "welcome.html"), "utf8");
const welcomeJs = fs.readFileSync(path.join(extensionRoot, "welcome.js"), "utf8");
const welcomeIds = new Set([...welcomeHtml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
const welcomeReferences = new Set([...welcomeJs.matchAll(/\$\("#([^"]+)"\)/g)].map(match => match[1]));
for (const id of welcomeReferences) {
  if (!welcomeIds.has(id)) fail(`welcome.js references missing DOM id: ${id}`);
}

if (!manifest.optional_host_permissions?.includes("https://*/*")) fail("Website access must be optional for store builds");
if (manifest.host_permissions?.includes("<all_urls>")) fail("Store build must not require broad website access at install time");
for (const locale of ["en", "zh_CN"]) {
  const localeMessages = JSON.parse(fs.readFileSync(path.join(extensionRoot, "_locales", locale, "messages.json"), "utf8"));
  if (localeMessages.extensionDescription.message.length > 132) fail(`${locale} extension description exceeds 132 characters`);
}

function pngSize(relativePath) {
  const data = fs.readFileSync(path.join(root, relativePath));
  if (data.toString("ascii", 1, 4) !== "PNG") fail(`Not a PNG: ${relativePath}`);
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}
const expectedPngSizes = new Map([
  ["store-assets/shared/icon-128.png", "128x128"],
  ["store-assets/shared/edge-logo-300.png", "300x300"],
  ["store-assets/shared/promo-small-440x280.png", "440x280"],
  ["store-assets/shared/promo-marquee-1400x560.png", "1400x560"],
]);
for (const locale of ["en", "zh-CN"]) {
  for (let index = 1; index <= 5; index += 1) {
    const match = fs.readdirSync(path.join(root, "store-assets", locale, "screenshots")).find(name => name.startsWith(`0${index}-`));
    if (!match) fail(`Missing store screenshot ${index} for ${locale}`);
    expectedPngSizes.set(`store-assets/${locale}/screenshots/${match}`, "1280x800");
  }
}
for (const [relativePath, expected] of expectedPngSizes) {
  const actual = pngSize(relativePath).join("x");
  if (actual !== expected) fail(`Unexpected image size for ${relativePath}: ${actual}, expected ${expected}`);
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
console.log(`Manifest paths: OK · Options DOM refs: ${referencedIds.size} · Welcome DOM refs: ${welcomeReferences.size} · README links: OK · Credential scan: OK`);
