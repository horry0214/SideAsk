import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = path.resolve(desktopRoot, "..");
const runtimeRoot = path.join(desktopRoot, "runtime");
const generatedRoot = path.join(desktopRoot, "generated");

fs.rmSync(runtimeRoot, { recursive: true, force: true });
fs.rmSync(generatedRoot, { recursive: true, force: true });
fs.mkdirSync(path.join(runtimeRoot, "extension"), { recursive: true });
fs.mkdirSync(generatedRoot, { recursive: true });

fs.cpSync(path.join(repositoryRoot, "server"), path.join(runtimeRoot, "server"), {
  recursive: true,
  filter(source) {
    const relative = path.relative(path.join(repositoryRoot, "server"), source);
    return ![".env", ".DS_Store"].includes(path.basename(source))
      && relative !== "test"
      && !relative.startsWith(`test${path.sep}`);
  },
});
fs.copyFileSync(
  path.join(repositoryRoot, "extension", "provider-catalog.js"),
  path.join(runtimeRoot, "extension", "provider-catalog.js"),
);
const { PROVIDER_CATALOG } = await import(pathToFileURL(path.join(repositoryRoot, "extension", "provider-catalog.js")).href);
fs.writeFileSync(
  path.join(runtimeRoot, "extension", "provider-catalog.json"),
  `${JSON.stringify(PROVIDER_CATALOG, null, 2)}\n`,
  "utf8",
);
fs.copyFileSync(
  path.join(repositoryRoot, "extension", "markdown.js"),
  path.join(generatedRoot, "markdown.js"),
);
fs.copyFileSync(
  path.join(repositoryRoot, "assets", "brand", "icon-128.png"),
  path.join(generatedRoot, "icon-128.png"),
);

const png = fs.readFileSync(path.join(generatedRoot, "icon-128.png"));
const iconHeader = Buffer.alloc(22);
iconHeader.writeUInt16LE(0, 0);
iconHeader.writeUInt16LE(1, 2);
iconHeader.writeUInt16LE(1, 4);
iconHeader.writeUInt8(128, 6);
iconHeader.writeUInt8(128, 7);
iconHeader.writeUInt8(0, 8);
iconHeader.writeUInt8(0, 9);
iconHeader.writeUInt16LE(1, 10);
iconHeader.writeUInt16LE(32, 12);
iconHeader.writeUInt32LE(png.length, 14);
iconHeader.writeUInt32LE(iconHeader.length, 18);
fs.writeFileSync(path.join(generatedRoot, "sideask.ico"), Buffer.concat([iconHeader, png]));

console.log("SideAsk desktop runtime prepared.");
