// Vercel serverless function: READ GitHub issues (public repo, no auth required)
// Proxies GitHub REST API via Octokit. Uses GITHUB_PAT if set for higher rate limits.
// Query params:
//   state= open|closed|all (default: open)
//   labels= comma-separated (e.g. bug,feature)
//   per_page= 1..100 (default 30)
//   page= number (default 1)
//   number= issue number -> fetch single issue (ignores state/labels). Add &comments=true to include comments
//   sort= created|updated|comments (default created)
//   direction= asc|desc (default desc)
import { Octokit } from "@octokit/rest";

let octokitFactory = () =>
  new Octokit({
    ...(process.env.GITHUB_PAT ? { auth: process.env.GITHUB_PAT } : {}),
    userAgent: "youtube-playlist-customize api/issues",
  });

export const getOctokit = () => octokitFactory();
export const _setOctokitFactoryForTest = (fn) => {
  octokitFactory = fn;
};
export const _resetOctokitFactory = () => {
  octokitFactory = () =>
    new Octokit({
      ...(process.env.GITHUB_PAT ? { auth: process.env.GITHUB_PAT } : {}),
      userAgent: "youtube-playlist-customize api/issues",
    });
};

const pickIssueFields = (issue) => ({
  number: issue.number,
  title: issue.title,
  state: issue.state,
  html_url: issue.html_url,
  user: issue.user ? { login: issue.user.login, avatar_url: issue.user.avatar_url } : null,
  labels: (issue.labels || []).map((l) => (typeof l === "string" ? l : { name: l.name, color: l.color })),
  assignees: (issue.assignees || []).map((a) => ({ login: a.login, avatar_url: a.avatar_url })),
  assignee: issue.assignee ? { login: issue.assignee.login, avatar_url: issue.assignee.avatar_url } : null,
  comments: issue.comments,
  created_at: issue.created_at,
  updated_at: issue.updated_at,
  closed_at: issue.closed_at,
  body: issue.body,
  pull_request: !!issue.pull_request,
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const owner = process.env.GITHUB_OWNER || "lamminhthien";
  const repo = process.env.GITHUB_REPO_NAME || "youtube-playlist-customize";

  if (!owner || !repo) {
    return res.status(500).json({ success: false, message: "Server configuration error: missing GITHUB_OWNER / GITHUB_REPO_NAME" });
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const getParam = (key) => req.query?.[key] ?? url.searchParams.get(key);

  const number = getParam("number");
  const wantComments = getParam("comments") === "true" || getParam("comments") === "1";

  // Single issue mode
  if (number) {
    const issueNumber = Number(number);
    if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
      return res.status(400).json({ success: false, message: "Invalid 'number' parameter" });
    }
    try {
      const octokit = getOctokit();
      const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });

      let comments = undefined;
      if (wantComments && issue.comments > 0) {
        const { data } = await octokit.rest.issues.listComments({ owner, repo, issue_number: issueNumber, per_page: 100 });
        comments = data.map((c) => ({
          id: c.id,
          user: { login: c.user.login, avatar_url: c.user.avatar_url },
          body: c.body,
          created_at: c.created_at,
          updated_at: c.updated_at,
          html_url: c.html_url,
        }));
      }

      res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
      return res.status(200).json({
        success: true,
        issue: pickIssueFields(issue),
        ...(comments ? { comments } : {}),
      });
    } catch (error) {
      const status = error?.status || 500;
      const message = error?.response?.data?.message || error.message || "Failed to fetch issue";
      console.error(`[api/issues] Failed to fetch issue #${number}:`, message);
      return res.status(status === 404 ? 404 : 500).json({ success: false, message });
    }
  }

  // List mode
  const state = getParam("state") || "open";
  const labels = getParam("labels") || undefined;
  const sort = getParam("sort") || "created";
  const direction = getParam("direction") || "desc";
  const perPage = Math.min(Math.max(parseInt(getParam("per_page") || "30", 10) || 30, 1), 100);
  const page = Math.max(parseInt(getParam("page") || "1", 10) || 1, 1);

  if (!["open", "closed", "all"].includes(state)) {
    return res.status(400).json({ success: false, message: "Invalid 'state' (use open|closed|all)" });
  }
  if (!["created", "updated", "comments"].includes(sort)) {
    return res.status(400).json({ success: false, message: "Invalid 'sort' (use created|updated|comments)" });
  }
  if (!["asc", "desc"].includes(direction)) {
    return res.status(400).json({ success: false, message: "Invalid 'direction' (use asc|desc)" });
  }

  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      state,
      labels: labels || undefined,
      sort,
      direction,
      per_page: perPage,
      page,
    });

    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({
      success: true,
      owner,
      repo,
      count: data.length,
      page,
      per_page: perPage,
      state,
      issues: data.map(pickIssueFields),
    });
  } catch (error) {
    const status = error?.status || 500;
    const message = error?.response?.data?.message || error.message || "Failed to fetch issues";
    console.error("[api/issues] Failed to list issues:", message);
    return res.status(status === 404 ? 404 : 500).json({ success: false, message });
  }
}
