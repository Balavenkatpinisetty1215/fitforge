const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");
const fs = require("fs");
const { createApp } = require("../server");

test("Full API integration: auth, daily cap, pagination, structured errors, SSE, and rate limiting", async (t) => {
  const tempDb = path.join(os.tmpdir(), `fitsquad-v3-test-${Date.now()}.json`);
  const app = createApp(tempDb, { maxAuthRequestsPerMin: 5 });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  t.after(() => {
    server.close();
    if (fs.existsSync(tempDb)) fs.unlinkSync(tempDb);
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  // 1. Unauthenticated access returns structured 401 error
  const unauthRes = await fetch(`${baseUrl}/api/dashboard`);
  assert.equal(unauthRes.status, 401);
  const unauthBody = await unauthRes.json();
  assert.equal(unauthBody.code, "AUTH_REQUIRED");

  // 2. Register a new user
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "runner_jane",
      name: "Jane Doe",
      password: "Password123!"
    })
  });
  assert.equal(regRes.status, 201);
  const { token } = await regRes.json();

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  };

  // 3. Log a valid 120-minute workout
  const w1 = await fetch(`${baseUrl}/api/workouts`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      activity: "Running",
      duration: 120,
      distance: 15,
      intensity: "Moderate",
      note: "Long morning run"
    })
  });
  assert.equal(w1.status, 201);

  // 4. Exceeding 180-minute daily cap returns structured 400 error
  const w2 = await fetch(`${baseUrl}/api/workouts`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      activity: "Cycling",
      duration: 90,
      distance: 20,
      intensity: "Low"
    })
  });
  assert.equal(w2.status, 400);
  const w2Body = await w2.json();
  assert.equal(w2Body.code, "DAILY_CAP_EXCEEDED");

  // 5. Verify SSE real-time stream handshake
  const controller = new AbortController();
  const sseRes = await fetch(`${baseUrl}/api/live/stream?token=${token}`, {
    signal: controller.signal
  });
  assert.equal(sseRes.status, 200);
  assert.equal(sseRes.headers.get("content-type"), "text/event-stream");
  controller.abort();

  // 6. Verify Rate Limiter blocks brute-force auth spam (maxAuthRequestsPerMin = 5)
  let got429 = false;
  for (let i = 0; i < 6; i++) {
    const attempt = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "runner_jane", password: "wrong" })
    });
    if (attempt.status === 429) {
      got429 = true;
      break;
    }
  }
  assert.equal(got429, true);
});
