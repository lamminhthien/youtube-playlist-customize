/**
 * Frontend helper to fetch GitHub issues via the proxied /api/issues endpoint.
 * Using the serverless proxy avoids unauthenticated rate-limit issues (60/hr)
 * and keeps GITHUB_PAT server-side if present.
 *
 * @param {object} opts
 * @param {"open"|"closed"|"all"} opts.state
 * @param {string} opts.labels - comma-separated
 * @param {number} opts.perPage
 * @param {number} opts.page
 * @param {"created"|"updated"|"comments"} opts.sort
 * @param {"asc"|"desc"} opts.direction
 */

export const ISSUES_API_URL = "/api/issues";

export const fetchIssues = async (opts = {}) => {
  const params = new URLSearchParams();
  if (opts.state) params.set("state", opts.state);
  if (opts.labels) params.set("labels", opts.labels);
  if (opts.perPage) params.set("per_page", String(opts.perPage));
  if (opts.page) params.set("page", String(opts.page));
  if (opts.sort) params.set("sort", opts.sort);
  if (opts.direction) params.set("direction", opts.direction);

  const url = params.toString() ? `${ISSUES_API_URL}?${params.toString()}` : ISSUES_API_URL;
  const res = await fetch(url, { method: "GET" });
  const payload = await res.json();
  if (!res.ok || !payload.success) {
    throw new Error(payload?.message || `Failed to fetch issues (HTTP ${res.status})`);
  }
  return payload; // { success, owner, repo, count, issues, ... }
};

export const fetchIssueByNumber = async (number, { withComments = false } = {}) => {
  const params = new URLSearchParams({ number: String(number) });
  if (withComments) params.set("comments", "true");
  const res = await fetch(`${ISSUES_API_URL}?${params.toString()}`, { method: "GET" });
  const payload = await res.json();
  if (!res.ok || !payload.success) {
    throw new Error(payload?.message || `Failed to fetch issue #${number} (HTTP ${res.status})`);
  }
  return payload; // { success, issue, comments? }
};
