import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";

const root = path.dirname(fileURLToPath(import.meta.url));
const json = JSON.parse(fs.readFileSync(path.join(root, "plugin.json"), "utf8"));
const zip = new JSZip();

const add = (name, source = name) => zip.file(name, fs.readFileSync(path.join(root, source)));
add("plugin.json");
add("icon.png");
add("LICENSE");
add(json.readme, "README.md");
add(json.changelogs, "CHANGELOG.md");
for (const file of fs.readdirSync(path.join(root, "dist"))) add(file, path.join("dist", file));

const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
fs.writeFileSync(path.join(root, "plugin.zip"), buffer);
console.log(`plugin.zip written (${buffer.length} bytes)`);
