# Report Issue via GitHub — Implementation Plan

Plan for implementing the **"Report Issue"** feature that creates GitHub issues directly via a GitHub Personal Access Token (PAT).

---

### Architecture Overview

* **Frontend:** Form UI collects user input (Title, Description, Issue Type, optional attachments) → calls the app's internal API.
* **Backend:** Internal REST API (Vercel Serverless Function) receives the payload → calls the official GitHub API (`POST /repos/{owner}/{repo}/issues`) using a **PAT** stored in environment variables (`.env`).

> **Security note:** Never expose the PAT on the frontend/client-side. All issue-creation requests must go through a backend/serverless function to keep the token safe.

---

### Detailed Implementation Steps

#### 1. Prepare GitHub Personal Access Token (PAT)

* Create a **Fine-grained Personal Access Token** on GitHub (recommended over Classic).
* **Required permissions:**
  * `Repository permissions` → **Issues**: Read & Write.

* Save the token in the backend env file: `GITHUB_PAT=github_pat_11AAAA...`
* Also set `GITHUB_OWNER` and `GITHUB_REPO_NAME` in `.env`.

---

#### 2. Build Backend API (Proxy Endpoint)

Create an internal API endpoint (e.g., `POST /api/report-issue`).

**Payload from Frontend:**

```json
{
  "title": "Submit button UI bug",
  "description": "Submit button does not respond when tapped on mobile",
  "type": "bug",
  "reporterInfo": "Thien Lam (User ID: 12345)"
}
```

Allowed `type` values: `"bug" | "feature" | "improvement" | "feedback"` — see `api/report-issue.js:10`.

**Backend handler (current implementation in `api/report-issue.js:12`):**

```javascript
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

export default async function handler(req, res) {
  const { title, description, type, reporterInfo } = req.body;

  try {
    // 1. Format issue body
    const issueBody = `
### Issue Description
${description}

---
**Reported By:** ${reporterInfo || 'Anonymous'}
**User Agent:** ${req.headers['user-agent']}
**Page:** ${req.headers.referer}
**Timestamp:** ${new Date().toISOString()}
    `.trim();

    // 2. Auto-assign labels based on type
    const labels = [type || 'bug', 'user-reported'];

    // 3. Call GitHub API
    const response = await octokit.rest.issues.create({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO_NAME,
      title: `[Report] ${title}`,
      body: issueBody,
      labels: labels,
    });

    return res.status(200).json({
      success: true,
      issueUrl: response.data.html_url,
      issueNumber: response.data.number
    });
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
    return res.status(500).json({ success: false, message: "Could not create issue" });
  }
}
```

Implemented with validation and test hooks (`getOctokit()` / `_setOctokitFactoryForTest()`) at `api/report-issue.js:5`.

---

#### 3. Build Frontend Component

UI consists of a **Trigger Button** and **Report Issue Modal**:

* **Modal UI:**
  * Input: **Title** (required).
  * Select/Radio: **Category** (`Bug`, `Feature Request`, `Feedback`).
  * Textarea: **Description** (required — steps to reproduce).
  * Auto-capture (optional): Browser, OS, current page URL (`window.location.href`).

* **States:**
  * `Idle` → `Submitting` (disable submit button) → `Success` (show message + link to issue) / `Error`.

Frontend implementation: `utils/renderReportIssue.js` (button + modal), wired in `index.js:58`.

---

### Checklist

| Area | Task | Status |
|------|------|--------|
| **Setup GitHub** | Create PAT with `Issues: Write` and add to `.env` | ⬜ |
| **Backend** | Install SDK `@octokit/rest` (or use `fetch` REST API) | ⬜ |
| **Backend** | Implement controller to format Markdown & send request to GitHub | ⬜ |
| **Backend** | Add rate limiting to prevent spam issue creation | ⬜ |
| **Frontend** | Add modal UI & integrate API call | ⬜ |
| **Testing** | Verify successful issue creation and label/body rendering on GitHub | ⬜ |

---

### Related

- Read issues (public, no PAT required): see `docs/fetch-github-issues.md:1` — `GET /api/issues` + `scripts/fetch-issues.mjs:1` + `utils/fetchIssues.js:1`.
