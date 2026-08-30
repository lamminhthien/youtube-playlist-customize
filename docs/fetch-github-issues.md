# Fetch GitHub Issues — Public Repo Guide

> Fetch issues from `lamminhthien/youtube-playlist-customize` (public repo) without auth. PAT is optional — only for higher rate limits or private repos.

This document describes the three ways to read GitHub Issues in this codebase: **CLI script**, **Serverless API**, and **Frontend helper**.

---

## 1. Architecture Overview

```
[ CLI: scripts/fetch-issues.mjs ] ─┐
                                   ├─► GitHub REST API (Octokit) ─► https://github.com/lamminhthien/youtube-playlist-customize/issues
[ Browser: utils/fetchIssues.js ] ─► [ Vercel: api/issues.js ] ────┘
```

| Layer | File | Auth | Notes |
|-------|------|------|-------|
| CLI | `scripts/fetch-issues.mjs:1` | Optional | Uses `GITHUB_PAT` if set, otherwise anonymous request (60 req/h) |
| API proxy | `api/issues.js:1` | Optional | `GET /api/issues` — cached `s-maxage=60`, keeps PAT server-side |
| Frontend | `utils/fetchIssues.js:1` | Via proxy | `fetchIssues()` / `fetchIssueByNumber()` |

Default `owner/repo` is resolved from env `GITHUB_OWNER` / `GITHUB_REPO_NAME`, falling back to `lamminhthien/youtube-playlist-customize` (`scripts/fetch-issues.mjs:21`, `api/issues.js:54`).

---

## 2. Environment Configuration

```bash
# .env — not required for public repo
GITHUB_OWNER=lamminhthien
GITHUB_REPO_NAME=youtube-playlist-customize
GITHUB_PAT=github_pat_xxx # optional: raises limit 60 → 5000 req/h, required for private repos
```

See `.env.example:1`.

> **Public repo = no PAT needed.** Only set `GITHUB_PAT` if you hit rate limits or the repo is private.

---

## 3. CLI Script — `scripts/fetch-issues.mjs`

### Installation

`@octokit/rest` is already in `package.json:28`. No extra install needed.

### Usage

```bash
# list open issues (default 30)
node scripts/fetch-issues.mjs
npm run fetch-issues

# all states, limit 10
node scripts/fetch-issues.mjs --state all --limit 10
npm run fetch-issues -- --state all --limit 10

# single issue
node scripts/fetch-issues.mjs --number 6
node scripts/fetch-issues.mjs --number 6 --comments   # include comments
node scripts/fetch-issues.mjs --number 6 --json       # raw JSON

# filter by label
node scripts/fetch-issues.mjs --labels bug,feature --state open

# custom repo / verbose / JSON
node scripts/fetch-issues.mjs --owner lamminhthien --repo youtube-playlist-customize --verbose --json

# help
node scripts/fetch-issues.mjs --help
```

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--owner <name>` | `$GITHUB_OWNER` or `lamminhthien` | GitHub owner |
| `--repo <name>` | `$GITHUB_REPO_NAME` or `youtube-playlist-customize` | Repo name |
| `--state <s>` | `open` | `open` \| `closed` \| `all` |
| `--labels <a,b>` | — | Filter by labels, e.g. `bug,feature` |
| `--limit <n>` | `30` | Max total issues (1–1000), auto-paginates |
| `--per-page <n>` | `30` | Items per page (1–100) |
| `--page <n>` | `1` | Start page |
| `--number <n>` | — | Fetch single issue by number (ignores state/limit) |
| `--comments` | `false` | With `--number`, also fetch comments |
| `--json` | `false` | Output raw JSON instead of pretty table |
| `--verbose` | `false` | Log request details + rate limit |

### Sample Output

```
[fetch-issues] lamminhthien/youtube-playlist-customize — state=all — found 2 issue(s)

#6    [open  ] [Report] Add feature download video
     labels: user-reported, feature  author: lamminhthien  comments: 0  updated: 2026-08-30T15:35:23Z
     https://github.com/lamminhthien/youtube-playlist-customize/issues/6
```

With `--json` the full GitHub API object is printed (useful for piping to `jq`).

### Internals

- `formatIssue()` trims fields for table view (`scripts/fetch-issues.mjs:87`).
- `fetchList()` loops `pagesNeeded = ceil(limit/perPage)` (`scripts/fetch-issues.mjs:115`).
- Unauthenticated rate limit is 60/h — add `--verbose` to check `octokit.rest.rateLimit.get()` (`scripts/fetch-issues.mjs:197`).

---

## 4. Serverless API — `GET /api/issues`

Safe proxy for the frontend — avoids CORS and keeps PAT server-side.

### List issues

```http
GET /api/issues?state=open&labels=bug,feature&per_page=30&page=1&sort=created&direction=desc
```

| Query | Default | Validation |
|-------|---------|------------|
| `state` | `open` | `open` \| `closed` \| `all` |
| `labels` | — | comma-separated |
| `per_page` | `30` | 1–100 |
| `page` | `1` | >=1 |
| `sort` | `created` | `created` \| `updated` \| `comments` |
| `direction` | `desc` | `asc` \| `desc` |

**Response 200:**

```json
{
  "success": true,
  "owner": "lamminhthien",
  "repo": "youtube-playlist-customize",
  "count": 2,
  "page": 1,
  "per_page": 30,
  "state": "open",
  "issues": [
    {
      "number": 6,
      "title": "[Report] Add feature download video",
      "state": "open",
      "html_url": "https://github.com/lamminhthien/youtube-playlist-customize/issues/6",
      "user": { "login": "lamminhthien", "avatar_url": "https://..." },
      "labels": [{ "name": "feature", "color": "ededed" }],
      "assignees": [],
      "comments": 0,
      "created_at": "2026-08-30T15:20:58Z",
      "updated_at": "2026-08-30T15:35:23Z",
      "body": "### Issue Description\n...",
      "pull_request": false
    }
  ]
}
```

Fields are picked in `api/issues.js:31`.

### Single issue

```http
GET /api/issues?number=6
GET /api/issues?number=6&comments=true
```

**Response 200:**

```json
{
  "success": true,
  "issue": { "number": 6, "title": "...", ... },
  "comments": [
    { "id": 123, "user": { "login": "..." }, "body": "...", "created_at": "...", "html_url": "..." }
  ]
}
```

See `api/issues.js:68`.

### Errors

| Status | When |
|--------|------|
| `400` | Invalid `state`/`sort`/`direction`/`number` |
| `404` | Issue not found |
| `405` | Method other than `GET` |
| `500` | GitHub error or missing `GITHUB_OWNER` config |

Cache header: `public, s-maxage=60, stale-while-revalidate=120` (`api/issues.js:90`).

### Local testing

```bash
vercel dev --listen 3010
curl "http://localhost:3010/api/issues?state=all&per_page=2" | jq
curl "http://localhost:3010/api/issues?number=6&comments=true" | jq
```

---

## 5. Frontend Helper — `utils/fetchIssues.js`

```javascript
import { fetchIssues, fetchIssueByNumber } from "./utils/fetchIssues.js";

// List
const { issues, count } = await fetchIssues({
  state: "all",          // open|closed|all
  labels: "feature",     // optional
  perPage: 20,
  page: 1,
  sort: "updated",       // created|updated|comments
  direction: "desc"
});

// Single
const { issue, comments } = await fetchIssueByNumber(6, { withComments: true });
```

- Thin wrapper around `fetch(ISSUES_API_URL)` (`utils/fetchIssues.js:15`).
- Throws `Error` if `!res.ok` or `!payload.success` — same pattern as `utils/apiFetch.js:12`.
- Re-exported in `utils/index.js:16`:

```javascript
import { fetchIssues, fetchIssueByNumber } from "./utils/index.js";
```

### Example: render a list

```javascript
import { fetchIssues } from "./utils/index.js";

async function renderIssues(container) {
  container.textContent = "Loading issues…";
  try {
    const { issues } = await fetchIssues({ state: "open", perPage: 10 });
    container.innerHTML = issues.map(i => `
      <a href="${i.html_url}" target="_blank" class="block p-3 border rounded">
        <div class="font-medium">#${i.number} ${i.title}</div>
        <div class="text-sm opacity-70">${i.labels.map(l=>l.name).join(", ") || "no labels"} · ${i.comments} comments</div>
      </a>
    `).join("");
  } catch (err) {
    container.textContent = err.message;
  }
}
```

---

## 6. Comparison with Report Issue

| Aspect | `POST /api/report-issue` | `GET /api/issues` |
|--------|--------------------------|-------------------|
| Purpose | **Create** issue (requires PAT) | **Read** issues (public, no PAT required) |
| Auth | Required `GITHUB_PAT` with `Issues: Read & Write` | Optional, only to raise rate limit |
| Docs | `docs/report-via-github-issue.md:1` | This document |

Both endpoints share env `GITHUB_OWNER` / `GITHUB_REPO_NAME` and the same `Octokit` factory pattern (`getOctokit()` / `_setOctokitFactoryForTest()`).

---

## 7. Rate Limiting & Best Practices

- **Unauthenticated:** 60 req/h per IP. Sufficient for development and low-traffic public sites.
- **Authenticated (PAT):** 5000 req/h. Set `GITHUB_PAT` in Vercel env if the site has higher traffic.
- Always call `/api/issues` from the browser instead of `api.github.com` directly to benefit from caching and keep PAT server-side.
- Use `per_page` + `page` for pagination instead of fetching 1000 issues at once.
- GitHub returns PRs as issues — check `issue.pull_request` to filter for pure issues only.

---

## 8. Links

- Repo: https://github.com/lamminhthien/youtube-playlist-customize/issues
- GitHub REST API — List issues: https://docs.github.com/en/rest/issues/issues#list-repository-issues
- Octokit: https://github.com/octokit/rest.js
- Report Issue flow: `docs/report-via-github-issue.md:1`
