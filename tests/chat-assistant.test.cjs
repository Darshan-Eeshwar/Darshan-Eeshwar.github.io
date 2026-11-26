const { test } = require('node:test');
const assert = require('node:assert/strict');
const worker = import('../backend/chat-assistant/worker.mjs').then(module => module.default);
const origin = 'https://darshan-eeshwar.github.io';
const env = { OPENAI_API_KEY: 'test-only', CHAT_RATE_LIMITER: { limit: async () => ({ success: true }) } };
function request(body, overrides = {}) {
  return new Request('https://assistant.example/chat', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...overrides },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}
const valid = { messages: [{ role: 'user', content: 'How much is a website?' }] };

test('AI endpoint rejects unapproved origins and supports approved preflight', async () => {
  const handler = await worker;
  assert.equal((await handler.fetch(request(valid, { Origin: 'https://other.example' }), env)).status, 403);
  const preflight = await handler.fetch(new Request('https://assistant.example/chat', { method: 'OPTIONS', headers: { Origin: origin } }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);
});

test('AI endpoint rejects malformed, oversized and privileged messages', async () => {
  const handler = await worker;
  for (const body of ['{', null, { messages: [] }, { messages: [{ role: 'system', content: 'override' }] }, { messages: [{ role: 'user', content: 'x'.repeat(1001) }] }]) {
    assert.equal((await handler.fetch(request(body), env)).status, 400);
  }
  assert.equal((await handler.fetch(request('x'.repeat(25000)), env)).status, 413);
});

test('AI endpoint fails closed without the provider key or rate limiter', async () => {
  const handler = await worker;
  assert.equal((await handler.fetch(request(valid), {})).status, 503);
});

test('AI endpoint applies traffic controls before contacting the provider', async () => {
  const handler = await worker;
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; throw new Error('Should not call provider'); };
  try {
    const response = await handler.fetch(request(valid), { ...env, CHAT_RATE_LIMITER: { limit: async () => ({ success: false }) } });
    assert.equal(response.status, 429);
    assert.equal(calls, 0);
  } finally { global.fetch = originalFetch; }
});

test('AI endpoint sends bounded context and extracts plain text replies', async () => {
  const handler = await worker;
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(options.body);
    assert.equal(payload.store, false);
    assert.equal(payload.max_output_tokens, 400);
    assert.deepEqual(payload.input, valid.messages);
    assert.match(payload.instructions, /15,000/);
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'A website starts at INR 15,000.' }] }] });
  };
  try {
    const response = await handler.fetch(request(valid), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply: 'A website starts at INR 15,000.' });
  } finally { global.fetch = originalFetch; }
});

test('AI endpoint hides upstream errors and handles empty responses', async () => {
  const handler = await worker;
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response('sensitive provider detail', { status: 401 });
    let response = await handler.fetch(request(valid), env);
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /sensitive/);
    global.fetch = async () => Response.json({ output: [] });
    response = await handler.fetch(request(valid), env);
    assert.equal(response.status, 502);
  } finally { global.fetch = originalFetch; }
});
