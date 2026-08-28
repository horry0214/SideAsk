import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
fs.mkdirSync(path.resolve(extensionDirectory, "../dist"), { recursive: true });
