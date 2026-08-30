#!/usr/bin/env node
/**
 * Fetch GitHub issues for a public (or private) repo via GitHub REST API.
 * No auth required for public repos; uses GITHUB_PAT if available for higher rate limits.
 *
 * Usage:
 *   node scripts/fetch-issues.mjs                          # list open issues (default 30)
 *   node scripts/fetch-issues.mjs --state all --limit 10   # all issues, max 10
 *   node scripts/fetch-issues.mjs --number 6                # single issue #6
 *   node scripts/fetch-issues.mjs --number 6 --comments     # single issue + comments
 *   node scripts/fetch-issues.mjs --json                    # raw JSON output
 *   node scripts/fetch-issues.mjs --labels bug,feature     # filter by labels
 *   node scripts/fetch-issues.mjs --owner lamminhthien --repo youtube-playlist-customize
 *
 * Env:
 *   GITHUB_OWNER, GITHUB_REPO_NAME, GITHUB_PAT (all optional, fallback to defaults)
 */

import { Octokit } from "@octokit/rest";

const DEFAULT_OWNER = process.env.GITHUB_OWNER || "lamminhthien";
const DEFAULT_REPO = process.env.GITHUB_REPO_NAME || "youtube-playlist-customize";

const args = process.argv.slice(2);

const getArg = (name, fallback = undefined) => {
  const idx = args.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return fallback;
  const raw = args[idx];
  if (raw.includes("=")) return raw.split("=").slice(1).join("=");
  return args[idx + 1];
};

const hasFlag = (name) => args.includes(`--${name}`);

if (hasFlag("help") || hasFlag("h")) {
  console.log(`
Usage: node scripts/fetch-issues.mjs [options]

Options:
  --owner <name>        GitHub owner (default: $GITHUB_OWNER or lamminhthien)
  --repo <name>         GitHub repo  (default: $GITHUB_REPO_NAME or youtube-playlist-customize)
  --state <state>       open | closed | all (default: open)
  --labels <a,b>        Comma-separated label filter
  --limit <n>           Max issues to fetch (default: 30, max: 1000)
  --per-page <n>        Items per page (default: 30, max: 100)
  --page <n>            Page number (default: 1)
  --number <n>          Fetch single issue by number (ignores state/limit)
  --comments            With --number, also fetch comments
  --json                Output raw JSON instead of pretty table
  --verbose             Show request details
  --help, -h            Show this help

Env vars:
  GITHUB_OWNER, GITHUB_REPO_NAME, GITHUB_PAT (optional, for private repos / higher rate limit)

Examples:
  node scripts/fetch-issues.mjs --state all --limit 10
  node scripts/fetch-issues.mjs --number 6 --comments --json
  GITHUB_PAT=ghp_xxx node scripts/fetch-issues.mjs --state open
`.trim());
  process.exit(0);
}

const owner = getArg("owner", DEFAULT_OWNER);
const repo = getArg("repo", DEFAULT_REPO);
const state = getArg("state", "open");
const labels = getArg("labels", "");
const limit = parseInt(getArg("limit", getArg("per-page", "30")), 10);
const perPage = Math.min(parseInt(getArg("per-page", "30"), 10) || 30, 100);
const page = parseInt(getArg("page", "1"), 10) || 1;
const issueNumber = getArg("number", null);
const wantComments = hasFlag("comments");
const asJson = hasFlag("json");
const verbose = hasFlag("verbose");

if (!["open", "closed", "all"].includes(state)) {
  console.error(`[fetch-issues] Invalid --state "${state}". Use open|closed|all`);
  process.exit(1);
}

const octokit = new Octokit({
  ...(process.env.GITHUB_PAT ? { auth: process.env.GITHUB_PAT } : {}),
  userAgent: "youtube-playlist-customize fetch-issues",
});

const formatIssue = (issue) => ({
  number: issue.number,
  title: issue.title,
  state: issue.state,
  labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
  user: issue.user?.login,
  assignees: (issue.assignees || []).map((a) => a.login),
  comments: issue.comments,
  created_at: issue.created_at,
  updated_at: issue.updated_at,
  closed_at: issue.closed_at,
  html_url: issue.html_url,
  body: issue.body ? issue.body.slice(0, 500) + (issue.body.length > 500 ? "..." : "") : "",
});

const fetchSingle = async (num) => {
  if (verbose) console.log(`[fetch-issues] GET /repos/${owner}/${repo}/issues/${num}`);
  const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: Number(num) });
  let comments = [];
  if (wantComments && issue.comments > 0) {
    if (verbose) console.log(`[fetch-issues] GET /repos/${owner}/${repo}/issues/${num}/comments`);
    const { data } = await octokit.rest.issues.listComments({ owner, repo, issue_number: Number(num), per_page: 100 });
    comments = data;
  }
  return { issue, comments };
};

const fetchList = async () => {
  const max = Number.isFinite(limit) ? Math.min(limit, 1000) : 30;
  const pagesNeeded = Math.ceil(max / perPage);
  const all = [];

  for (let p = 0; p < pagesNeeded; p++) {
    const currentPage = page + p;
    const remaining = max - all.length;
    const fetchPerPage = Math.min(perPage, remaining);
    if (fetchPerPage <= 0) break;

    if (verbose) console.log(`[fetch-issues] GET /repos/${owner}/${repo}/issues state=${state} labels=${labels || "-"} per_page=${fetchPerPage} page=${currentPage}`);

    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state,
      labels: labels || undefined,
      per_page: fetchPerPage,
      page: currentPage,
    });

    // GitHub returns PRs as issues too; filter if you want only issues (optional)
    // For this repo we keep all; uncomment to exclude PRs:
    // const issuesOnly = data.filter((i) => !i.pull_request);
    all.push(...data);

    if (data.length < fetchPerPage) break; // last page
    if (all.length >= max) break;
  }

  return all.slice(0, max);
};

const run = async () => {
  try {
    if (issueNumber) {
      const { issue, comments } = await fetchSingle(issueNumber);
      if (asJson) {
        console.log(JSON.stringify(wantComments ? { issue, comments } : issue, null, 2));
      } else {
        console.log(`\n#${issue.number} ${issue.title} [${issue.state}]`);
        console.log(`  URL:      ${issue.html_url}`);
        console.log(`  Author:   ${issue.user?.login}  Assignees: ${(issue.assignees || []).map((a) => a.login).join(", ") || "-"}`);
        console.log(`  Labels:   ${issue.labels.map((l) => (typeof l === "string" ? l : l.name)).join(", ") || "-"}`);
        console.log(`  Comments: ${issue.comments}  Created: ${issue.created_at}  Updated: ${issue.updated_at}`);
        if (issue.body) {
          console.log(`\n--- Body ---\n${issue.body.slice(0, 2000)}\n`);
        }
        if (wantComments && comments.length) {
          console.log(`\n--- Comments (${comments.length}) ---`);
          for (const c of comments) {
            console.log(`\n[${c.user.login} @ ${c.created_at}]:\n${c.body.slice(0, 1000)}`);
          }
        }
      }
      return;
    }

    const issues = await fetchList();

    if (asJson) {
      console.log(JSON.stringify(issues, null, 2));
      return;
    }

    console.log(`\n[fetch-issues] ${owner}/${repo} — state=${state}${labels ? ` labels=${labels}` : ""} — found ${issues.length} issue(s)\n`);

    if (!issues.length) {
      console.log("No issues found.");
      return;
    }

    const rows = issues.map(formatIssue);
    // Pretty table
    for (const r of rows) {
      console.log(`#${String(r.number).padEnd(4)} [${r.state.padEnd(6)}] ${r.title}`);
      console.log(`     labels: ${r.labels.join(", ") || "-"}  author: ${r.user}  comments: ${r.comments}  updated: ${r.updated_at}`);
      console.log(`     ${r.html_url}`);
    }

    // Also show rate limit hint when unauthenticated
    if (!process.env.GITHUB_PAT && verbose) {
      const { data: rate } = await octokit.rest.rateLimit.get();
      console.log(`\n[rate-limit] remaining: ${rate.rate.remaining}/${rate.rate.limit} resets @ ${new Date(rate.rate.reset * 1000).toISOString()}`);
    }
  } catch (err) {
    const msg = err?.response?.data?.message || err.message || String(err);
    const status = err?.status || err?.response?.status;
    console.error(`\n[fetch-issues] Failed to fetch issues for ${owner}/${repo}: ${msg}${status ? ` (HTTP ${status})` : ""}`);
    if (err?.response?.data?.documentation_url) {
      console.error(`Docs: ${err.response.data.documentation_url}`);
    }
    if (verbose) console.error(err);
    process.exit(1);
  }
};

run();
