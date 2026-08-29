import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function reserveLoopbackPort() {
  return await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForHealth(port) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return await response.json();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("SideAsk test Gateway did not start in time");
}

test("Gateway advertises the Provider Vault capability and serves its endpoint", async t => {
  const port = await reserveLoopbackPort();
  const dataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "sideask-gateway-test-"));
  const entry = fileURLToPath(new URL("../server.mjs", import.meta.url));
  const child = spawn(process.execPath, [entry], {
    env: { ...process.env, PORT: String(port), SIDEASK_DATA_DIR: dataDirectory },
    stdio: "ignore",
    windowsHide: true,
  });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await Promise.race([
        new Promise(resolve => child.once("exit", resolve)),
        new Promise(resolve => setTimeout(resolve, 800)),
      ]);
    }
    fs.rmSync(dataDirectory, { recursive: true, force: true });
  });

  const health = await waitForHealth(port);
  assert.equal(health.service, "sideask-local-gateway");
  assert.equal(health.gatewayApiVersion >= 2, true);
  assert.equal(health.capabilities.includes("provider-vault"), true);

  const providers = await fetch(`http://127.0.0.1:${port}/api/providers`);
  assert.equal(providers.status, 200);
  const state = await providers.json();
  assert.deepEqual(state.providers, []);
});
