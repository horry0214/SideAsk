const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeGatewayUrl } = require("../src/gateway");
const { PROVIDER_CATALOG, getProviderProfile } = require("../src/provider-catalog");

test("Gateway URL accepts only HTTP loopback endpoints", () => {
  assert.equal(normalizeGatewayUrl("http://127.0.0.1:8787/"), "http://127.0.0.1:8787");
  assert.equal(normalizeGatewayUrl("http://localhost:8787"), "http://localhost:8787");
  assert.throws(() => normalizeGatewayUrl("https://example.com"), /loopback/);
  assert.throws(() => normalizeGatewayUrl("not-a-url"), /Invalid/);
});

test("VS Code companion carries the complete Provider catalog", () => {
  assert.equal(PROVIDER_CATALOG.length, 25);
  assert.equal(new Set(PROVIDER_CATALOG.map(profile => profile.id)).size, 25);
  assert.equal(getProviderProfile("anthropic").displayName, "Anthropic");
  assert.equal(getProviderProfile("ollama").apiKeyRequired, false);
});

test("Gateway client manages the Provider Vault without receiving API keys", async t => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options = {}) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith("/api/providers") && !options.method) {
      return new Response(JSON.stringify({
        providers: [{ id: "shared", type: "openai", displayName: "OpenAI", model: "gpt", apiKeyConfigured: true }],
        defaultProviderId: "shared"
      }));
    }
    return new Response(JSON.stringify({ ok: true, id: "shared" }));
  });

  const { GatewayClient } = require("../src/gateway");
  const client = new GatewayClient("http://127.0.0.1:8787");
  const state = await client.listProviders();
  await client.setDefaultProvider("shared");
  await client.deleteProvider("shared");
  await client.testProvider("shared");

  assert.equal(state.providers[0].apiKeyConfigured, true);
  assert.equal("apiKey" in state.providers[0], false);
  assert.deepEqual(requests.slice(1).map(request => JSON.parse(request.options.body)), [
    { providerId: "shared" },
    { providerId: "shared" },
    { providerId: "shared" }
  ]);
});
