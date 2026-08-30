// Vercel serverless function: creates a GitHub issue via the GitHub REST API
// using a Personal Access Token (PAT) stored in environment variables.
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

const ALLOWED_TYPES = ["bug", "feature", "improvement", "feedback"];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  const { title, description, type, reporterInfo } = req.body || {};

  if (!title || typeof title !== "string" || title.trim().length === 0) {
    return res.status(400).json({ success: false, message: "Title is required" });
  }
  if (!description || typeof description !== "string" || description.trim().length === 0) {
    return res.status(400).json({ success: false, message: "Description is required" });
  }

  const issueType = ALLOWED_TYPES.includes(type) ? type : "bug";
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;

  if (!process.env.GITHUB_PAT || !owner || !repo) {
    console.error("Missing GitHub configuration: GITHUB_PAT, GITHUB_OWNER, or GITHUB_REPO_NAME");
    return res.status(500).json({ success: false, message: "Server configuration error" });
  }

  try {
    const issueBody = `
### Issue Description
${description.trim()}

---
**Reported By:** ${reporterInfo?.trim() || "Anonymous"}
**User Agent:** ${req.headers["user-agent"] || "Unknown"}
**Page:** ${req.headers.referer || "Unknown"}
**Timestamp:** ${new Date().toISOString()}
    `.trim();

    const labels = [issueType, "user-reported"];

    const response = await octokit.rest.issues.create({
      owner,
      repo,
      title: `[Report] ${title.trim()}`,
      body: issueBody,
      labels,
    });

    return res.status(200).json({
      success: true,
      issueUrl: response.data.html_url,
      issueNumber: response.data.number,
    });
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
    const message = error?.response?.data?.message || "Could not create issue";
    return res.status(500).json({ success: false, message });
  }
}