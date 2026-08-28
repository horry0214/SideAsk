function normalizeGatewayUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("Invalid SideAsk Gateway URL.");
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]", "::1"].includes(hostname)) {
    throw new Error("SideAsk Gateway must use an HTTP loopback address.");
  }
  return url.href.replace(/\/$/, "");
}

async function responseError(response) {
  const raw = await response.text();
  try {
    const payload = raw ? JSON.parse(raw) : {};
    return payload?.error?.message || `Gateway request failed (HTTP ${response.status}).`;
  } catch {
    return raw.slice(0, 500) || `Gateway request failed (HTTP ${response.status}).`;
  }
}

class GatewayClient {
  constructor(baseUrl) {
    this.baseUrl = normalizeGatewayUrl(baseUrl);
  }

  async health(signal) {
    const response = await fetch(`${this.baseUrl}/health`, { signal });
    if (!response.ok) throw new Error(await responseError(response));
    return response.json();
  }

  async listProviders(signal) {
    const response = await fetch(`${this.baseUrl}/api/providers`, { signal });
    if (!response.ok) throw new Error(await responseError(response));
    return response.json();
  }

  async saveProvider(provider, signal) {
    const response = await fetch(`${this.baseUrl}/api/providers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
      signal
    });
    if (!response.ok) throw new Error(await responseError(response));
    return response.json();
  }

  async setDefaultProvider(providerId, signal) {
    const response = await fetch(`${this.baseUrl}/api/providers/default`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId }),
      signal
    });
    if (!response.ok) throw new Error(await responseError(response));
    return response.json();
  }

  async deleteProvider(providerId, signal) {
    const response = await fetch(`${this.baseUrl}/api/providers/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId }),
      signal
    });
    if (!response.ok) throw new Error(await responseError(response));
    return response.json();
  }

  async testProvider(provider, signal) {
    const payload = typeof provider === "string" ? { providerId: provider } : { provider };
    const response = await fetch(`${this.baseUrl}/api/providers/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal
    });
    if (!response.ok) throw new Error(await responseError(response));
    return response.json();
  }

  async chat(payload, { signal, onDelta }) {
    let response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal
      });
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      throw new Error("Cannot reach SideAsk Local Gateway. Start it with `npm start` in the SideAsk repository.");
    }
    if (!response.ok) throw new Error(await responseError(response));
    if (!response.body) throw new Error("Streaming response body is unavailable.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (!chunk) continue;
      received += chunk;
      onDelta(chunk);
    }
    const tail = decoder.decode();
    if (tail) {
      received += tail;
      onDelta(tail);
    }
    if (!received.trim()) throw new Error("The Provider returned an empty response.");
    return received;
  }
}

module.exports = { GatewayClient, normalizeGatewayUrl };
