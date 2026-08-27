import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ProviderError,
  ProviderErrorCode,
  publicProviderError,
  resolveProviderRuntime,
} from "./providers/index.mjs";
import { systemPrompt } from "./prompt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionDir = path.resolve(__dirname, "../extension");
loadDotEnv(path.join(__dirname, ".env"));

const portFlagIndex = process.argv.indexOf("--port");
const commandLinePort = portFlagIndex >= 0 ? process.argv[portFlagIndex + 1] : "";
const PORT = Number(commandLinePort || process.env.PORT || 8787);
const defaultRuntime = resolveProviderRuntime(process.env);
const { provider: defaultProvider, config: defaultProviderConfig, registry } = defaultRuntime;

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function json(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(data));
}

const STATIC_CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function redirect(res, location) {
  res.writeHead(302, {
    Location: location,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end();
}

function servePreview(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const relativePath = requestUrl.pathname === "/preview/"
    ? "options.html"
    : decodeURIComponent(requestUrl.pathname.slice("/preview/".length));
  const file = path.resolve(extensionDir, relativePath);
  if (file !== extensionDir && !file.startsWith(`${extensionDir}${path.sep}`)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  res.writeHead(200, {
    "Content-Type": STATIC_CONTENT_TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'",
    "X-Content-Type-Options": "nosniff",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
  return true;
}

async function readJson(req, maxBytes = 500_000) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBytes) {
      const error = new Error("Request body too large");
      error.status = 413;
      throw error;
    }
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    const error = new Error("Invalid JSON request body");
    error.status = 400;
    throw error;
  }
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(message => message
      && (message.role === "user" || message.role === "assistant")
      && typeof message.content === "string")
    .slice(-12)
    .map(message => ({ role: message.role, content: message.content.slice(0, 6000) }));
}

function runtimeFromPayload(payload) {
  if (!payload?.provider) return defaultRuntime;
  const providerId = String(payload.provider.id || "").trim();
  const provider = registry.get(providerId);
  return {
    provider,
    config: provider.resolveClientConfig(payload.provider),
    registry,
  };
}

function isAllowedExtensionOrigin(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  return origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://");
}

function isJsonRequest(req) {
  return String(req.headers["content-type"] || "").toLowerCase().includes("application/json");
}

function safeLogProviderError(publicError) {
  const { providerId, code, upstreamStatus } = publicError.log;
  console.error(`[Provider] ${providerId} | ${code}${upstreamStatus ? ` | HTTP ${upstreamStatus}` : ""}`);
}

async function handleChat(req, res) {
  const payload = await readJson(req);
  const requestRuntime = runtimeFromPayload(payload);
  const { provider, config: providerConfig } = requestRuntime;
  const history = cleanMessages(payload.messages);
  if (!history.length || history[history.length - 1].role !== "user") {
    return json(res, 400, {
      error: {
        code: "invalid_request",
        message: String(payload.locale || "").toLowerCase().startsWith("en")
          ? "The final message must use the user role."
          : "messages 必须以 user 消息结束。",
        retryable: false,
      },
    });
  }

  const abortController = new AbortController();
  let responseStarted = false;
  res.on("close", () => {
    if (!res.writableEnded) abortController.abort();
  });

  try {
    await provider.chatStream({
      messages: [
        { role: "system", content: systemPrompt(payload) },
        ...history,
      ],
      signal: abortController.signal,
    }, providerConfig, {
      onReady() {
        responseStarted = true;
        res.writeHead(200, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Content-Type-Options": "nosniff",
        });
      },
      onDelta(delta) {
        if (!res.writableEnded) res.write(delta);
      },
    });
  } catch (error) {
    const publicError = publicProviderError(error, provider.id);
    safeLogProviderError(publicError);
    if (!responseStarted) return json(res, publicError.status, publicError.body);
    if (!res.writableEnded && publicError.body.error.code !== ProviderErrorCode.REQUEST_ABORTED) {
      res.write(`\n\n[${publicError.body.error.message}]`);
    }
  } finally {
    if (responseStarted && !res.writableEnded) res.end();
  }
}

async function handleProviderTest(req, res) {
  const payload = await readJson(req, 100_000);
  const { provider, config } = runtimeFromPayload(payload);
  try {
    const result = await provider.testConnection(config);
    return json(res, 200, result);
  } catch (error) {
    const publicError = publicProviderError(error, provider.id);
    safeLogProviderError(publicError);
    return json(res, publicError.status, publicError.body);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if ((req.method === "GET" || req.method === "HEAD") && req.url === "/") {
      return redirect(res, "/preview/");
    }
    if ((req.method === "GET" || req.method === "HEAD") && req.url === "/preview") {
      return redirect(res, "/preview/");
    }
    if ((req.method === "GET" || req.method === "HEAD") && req.url.startsWith("/preview/")) {
      if (servePreview(req, res)) return;
    }
    if (req.method === "GET" && req.url === "/health") {
      return json(res, 200, {
        ok: true,
        service: "sideask-local-gateway",
        ...defaultProvider.safeConfigSummary(defaultProviderConfig),
        providers: registry.list().map(item => item.id),
      });
    }
    if (req.method === "POST" && !isAllowedExtensionOrigin(req)) {
      return json(res, 403, { error: { code: "origin_not_allowed", message: "此请求来源不允许访问 SideAsk Local Gateway。", retryable: false } });
    }
    if (req.method === "POST" && !isJsonRequest(req)) {
      return json(res, 415, { error: { code: "content_type_not_allowed", message: "SideAsk Gateway 只接受 JSON 请求。", retryable: false } });
    }
    if (req.method === "POST" && req.url === "/api/chat") {
      return await handleChat(req, res);
    }
    if (req.method === "POST" && req.url === "/api/providers/test") {
      return await handleProviderTest(req, res);
    }
    return json(res, 404, { error: { code: "not_found", message: "Not found", retryable: false } });
  } catch (error) {
    if (error instanceof ProviderError) {
      const publicError = publicProviderError(error, defaultProvider.id);
      safeLogProviderError(publicError);
      return json(res, publicError.status, publicError.body);
    }
    const status = Number(error?.status) || 500;
    const message = status < 500 ? error.message : "本地网关发生内部错误。";
    return json(res, status, { error: { code: "gateway_error", message, retryable: status >= 500 } });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const summary = defaultProvider.safeConfigSummary(defaultProviderConfig);
  console.log(`\nSideAsk Local Gateway running: http://127.0.0.1:${PORT}`);
  console.log(`Provider: ${summary.displayName}`);
  console.log(`Model: ${summary.model || "missing"}`);
  console.log(`Endpoint: ${summary.endpoint}`);
  console.log(`API key: ${summary.apiKeyConfigured ? `configured ✓${summary.keyType ? ` (${summary.keyType})` : ""}` : "missing ✗"}`);
  console.log(`Health: http://127.0.0.1:${PORT}/health\n`);
  console.log(`Preview: http://127.0.0.1:${PORT}/preview/\n`);
});
