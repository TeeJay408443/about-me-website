const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function readMessages() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, "[]\n");
  return JSON.parse(fs.readFileSync(MESSAGES_FILE, "utf8"));
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": MIME_TYPES[".json"], "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 100000) request.destroy();
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname === "/api/messages" && request.method === "GET") return sendJson(response, 200, readMessages());
  if (requestUrl.pathname === "/api/messages" && request.method === "POST") {
    try {
      const input = JSON.parse(await collectBody(request));
      if (!input.name || !input.email || !input.message) return sendJson(response, 400, { error: "Name, email, and message are required." });
      const messages = readMessages();
      const message = {
        id: crypto.randomUUID(),
        name: String(input.name).trim().slice(0, 100),
        email: String(input.email).trim().slice(0, 200),
        subject: String(input.subject || "").trim().slice(0, 160),
        message: String(input.message).trim().slice(0, 3000),
        createdAt: new Date().toISOString()
      };
      messages.unshift(message);
      fs.writeFileSync(MESSAGES_FILE, `${JSON.stringify(messages, null, 2)}\n`);
      return sendJson(response, 201, { ok: true, id: message.id });
    } catch {
      return sendJson(response, 400, { error: "Invalid request." });
    }
  }

  let filePath = requestUrl.pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, requestUrl.pathname);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Page not found");
  }
  const extension = path.extname(filePath);
  response.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(PORT, "0.0.0.0", () => console.log(`About-me website running on port ${PORT}`));