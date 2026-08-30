import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import handler, { _setOctokitFactoryForTest, _resetOctokitFactory } from "../api/report-issue.js";

const mockRes = () => {
  const res = {
    statusCode: 200, headers: {}, body: null,
    setHeader(k, v) { this.headers[k] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; return this; },
  };
  return res;
};

describe("api/report-issue handler", () => {
  let origEnv;
  beforeEach(() => {
    origEnv = { ...process.env };
    process.env.GITHUB_PAT = "pat_test";
    process.env.GITHUB_OWNER = "owner";
    process.env.GITHUB_REPO_NAME = "repo";
    _resetOctokitFactory();
  });
  const restore = () => {
    for (const k of Object.keys(process.env)) {
      if (!(k in origEnv)) delete process.env[k];
    }
    Object.assign(process.env, origEnv);
    _resetOctokitFactory();
  };

  test("returns 405 for non-POST", async () => {
    const req = { method: "GET", headers: {}, body: {} };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.body.success, false);
    assert.equal(res.headers["Allow"], "POST");
    restore();
  });

  test("returns 400 when title missing", async () => {
    const req = { method: "POST", headers: {}, body: { description: "desc" } };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Title/);
    restore();
  });

  test("returns 400 when description missing", async () => {
    const req = { method: "POST", headers: {}, body: { title: "t" } };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Description/);
    restore();
  });

  test("returns 500 when env missing", async () => {
    delete process.env.GITHUB_PAT;
    const req = { method: "POST", headers: {}, body: { title: "t", description: "d" } };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 500);
    assert.match(res.body.message, /Server configuration/);
    restore();
  });

  test("creates GitHub issue with correct payload", async () => {
    let captured = null;
    const fakeOctokit = {
      rest: {
        issues: {
          create: async (p) => {
            captured = p;
            return { data: { html_url: "http://github.com/owner/repo/issues/1", number: 1 } };
          },
        },
      },
    };
    _setOctokitFactoryForTest(() => fakeOctokit);
    const req = {
      method: "POST",
      headers: { "user-agent": "UA", referer: "http://page" },
      body: { title: " My Title ", description: " My Desc ", type: "feature", reporterInfo: "Tester" },
    };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.issueUrl, "http://github.com/owner/repo/issues/1");
    assert.equal(captured.title, "[Report] My Title");
    assert.ok(captured.body.includes("My Desc"));
    assert.ok(captured.labels.includes("feature"));
    restore();
  });

  test("defaults to bug when type invalid", async () => {
    let captured = null;
    const fakeOctokit = {
      rest: {
        issues: {
          create: async (p) => {
            captured = p;
            return { data: { html_url: "url", number: 2 } };
          },
        },
      },
    };
    _setOctokitFactoryForTest(() => fakeOctokit);
    const req = { method: "POST", headers: {}, body: { title: "t", description: "d", type: "unknown" } };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(captured.labels.includes("bug"));
    restore();
  });

  test("returns 500 when Octokit throws with response message", async () => {
    const fakeOctokit = {
      rest: {
        issues: {
          create: async () => {
            const e = new Error("fail");
            e.response = { data: { message: "rate limit" } };
            throw e;
          },
        },
      },
    };
    _setOctokitFactoryForTest(() => fakeOctokit);
    const origError = console.error; console.error = () => {};
    const req = { method: "POST", headers: {}, body: { title: "t", description: "d" } };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, "rate limit");
    console.error = origError;
    restore();
  });

  test("trims title/description and handles empty after trim", async () => {
    const req = { method: "POST", headers: {}, body: { title: "   ", description: "   " } };
    const res = mockRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    restore();
  });
});
