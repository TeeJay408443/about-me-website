const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 5000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const MIME_TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".mp4": "video/mp4", ".mov": "video/quicktime", ".svg": "image/svg+xml" };
const SESSION_SECRET = process.env.SESSION_SECRET || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_COOKIE = "tyler_admin_session";
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map();

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

function adminAuthIsConfigured() {
  return Boolean(SESSION_SECRET && ADMIN_PASSWORD);
}

function passwordMatches(password) {
  if (!adminAuthIsConfigured() || typeof password !== "string" || password.length > 512) return false;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(`admin-password:${ADMIN_PASSWORD}`).digest();
  const supplied = crypto.createHmac("sha256", SESSION_SECRET).update(`admin-password:${password}`).digest();
  return crypto.timingSafeEqual(expected, supplied);
}

function getClientAddress(request) {
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length) return forwarded.split(",")[0].trim().slice(0, 100);
  return request.socket.remoteAddress || "unknown";
}

function cookieSecurityAttribute(request) {
  const forwardedProtocol = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return process.env.NODE_ENV === "production" || forwardedProtocol === "https" ? "; Secure" : "";
}

function createAdminCookie(request) {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(`admin-session:${expiresAt}`).digest("hex");
  return `${ADMIN_COOKIE}=${expiresAt}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(ADMIN_SESSION_TTL_MS / 1000)}${cookieSecurityAttribute(request)}`;
}

function isAdminAuthenticated(request) {
  if (!adminAuthIsConfigured()) return false;
  const cookie = String(request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  if (!cookie) return false;

  const [expiresText, signature, extra] = cookie.split(".");
  if (extra !== undefined || !/^\d+$/.test(expiresText || "") || !/^[a-f0-9]{64}$/i.test(signature || "")) return false;
  const expiresAt = Number(expiresText);
  const now = Date.now();
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > now + ADMIN_SESSION_TTL_MS + 60_000) return false;

  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(`admin-session:${expiresText}`).digest();
  const supplied = Buffer.from(signature, "hex");
  return supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied);
}

function getLoginAttempt(address) {
  const now = Date.now();
  for (const [key, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(key);
  }
  let attempt = loginAttempts.get(address);
  if (!attempt || attempt.resetAt <= now) {
    attempt = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(address, attempt);
  }
  return attempt;
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname === "/api/admin/login" && request.method === "POST") {
    if (!adminAuthIsConfigured()) return sendJson(response, 503, { error: "Admin access is not configured." });

    const attempts = getLoginAttempt(getClientAddress(request));
    if (attempts.count >= MAX_LOGIN_ATTEMPTS) return sendJson(response, 429, { error: "Too many sign-in attempts. Try again in 15 minutes." });

    let input;
    try {
      input = JSON.parse(await collectBody(request));
    } catch {
      return sendJson(response, 400, { error: "Invalid sign-in request." });
    }
    if (!passwordMatches(input.password)) {
      attempts.count += 1;
      return sendJson(response, 401, { error: "That password did not match. Try again." });
    }

    loginAttempts.delete(getClientAddress(request));
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[".json"],
      "Cache-Control": "no-store",
      "Set-Cookie": createAdminCookie(request)
    });
    return response.end(JSON.stringify({ ok: true }));
  }

  if (requestUrl.pathname === "/api/admin/logout" && request.method === "POST") {
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[".json"],
      "Cache-Control": "no-store",
      "Set-Cookie": `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${cookieSecurityAttribute(request)}`
    });
    return response.end(JSON.stringify({ ok: true }));
  }

  if (requestUrl.pathname === "/api/messages" && request.method === "GET") {
    if (!isAdminAuthenticated(request)) return sendJson(response, 401, { error: "Admin sign-in required." });
    return sendJson(response, 200, readMessages());
  }
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

  if (requestUrl.pathname === "/admin.html" && !isAdminAuthenticated(request)) {
    response.writeHead(302, { Location: "/admin-login.html", "Cache-Control": "no-store" });
    return response.end();
  }

  if (requestUrl.pathname === "/data" || requestUrl.pathname.startsWith("/data/")) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Page not found");
  }

  let filePath = requestUrl.pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, requestUrl.pathname);
  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Page not found");
  }
  const extension = path.extname(filePath);
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  const fileSize = fs.statSync(filePath).size;
  const isVideo = extension === ".mp4" || extension === ".mov";
  const range = request.headers.range;

  if (isVideo && range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      response.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
      return response.end();
    }
    const start = match[1] ? Number(match[1]) : 0;
    const requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;
    const end = Math.min(requestedEnd, fileSize - 1);
    if (start >= fileSize || start > end) {
      response.writeHead(416, { "Content-Range": `bytes */${fileSize}` });
      return response.end();
    }
    response.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache"
    });
    return fs.createReadStream(filePath, { start, end }).pipe(response);
  }

  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": fileSize,
    ...(isVideo ? { "Accept-Ranges": "bytes" } : {}),
    "Cache-Control": "no-cache"
  });
  fs.createReadStream(filePath).pipe(response);
});

server.listen(PORT, "0.0.0.0", () => console.log(`About-me website running on port ${PORT}`));