import { spawn, execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import http from "node:http";

console.log("Building web application...");
execSync("npm run build", { stdio: "inherit" });

console.log("Generating static index.html from preview server...");

const preview = spawn("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", "8081"], {
  detached: true,
  stdio: "ignore",
});
preview.unref();

function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      })
      .on("error", reject);
  });
}

let html = "";
for (let i = 0; i < 15; i++) {
  try {
    await new Promise((r) => setTimeout(r, 400));
    html = await fetchHtml("http://127.0.0.1:8081");
    if (html && html.includes("<!DOCTYPE html>")) break;
  } catch (e) {
    // retrying
  }
}

try {
  process.kill(-preview.pid);
} catch (e) {
  execSync("kill $(lsof -t -i:8081) 2>/dev/null || true");
}

if (html) {
  writeFileSync("dist/client/index.html", html);
  console.log("Successfully created dist/client/index.html");
} else {
  console.error("Could not generate dist/client/index.html");
  process.exit(1);
}

console.log("Syncing with Capacitor Android project...");
execSync("npx cap sync android", { stdio: "inherit" });
console.log("Sync complete.");
