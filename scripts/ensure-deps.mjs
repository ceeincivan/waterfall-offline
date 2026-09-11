import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const bin = process.platform === "win32" ? "node_modules/.bin/vite.cmd" : "node_modules/.bin/vite";
if (existsSync(bin)) process.exit(0);
console.log("Waterfall dependencies are missing. Installing…");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["install", "--no-audit", "--no-fund"], { stdio: "inherit" });
process.exit(result.status ?? 1);
