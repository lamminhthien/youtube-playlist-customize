Kế hoạch triển khai tính năng **"Report Issue"** gửi trực tiếp lên GitHub Repository qua GitHub Personal Access Token (PAT).

---

### Kiến trúc tổng quan

* **Frontend:** Form UI thu thập thông tin người dùng (Tiêu đề, Mô tả, Loại lỗi, Ảnh/File đính kèm) -> Gọi API nội bộ của ứng dụng.
* **Backend:** REST API (Node.js/NestJS/Next.js API Route) tiếp nhận payload -> Gọi API chính thức của GitHub (`POST /repos/{owner}/{repo}/issues`) bằng **PAT** được cấu hình trong kho môi trường (`.env`).

> **Lưu ý bảo mật quan trọng:** Tuyệt đối **không** để PAT ở phía Frontend/Client-side. Mọi yêu cầu tạo issue phải đi qua Backend/Serverless Function để giữ an toàn cho Access Token.

---

### Quy trình triển khai chi tiết

#### 1. Chuẩn bị GitHub Personal Access Token (PAT)

* Tạo **Fine-grained Personal Access Token** trên GitHub (khuyên dùng thay vì Fine-grained Classic).
* **Permissions cần thiết:**
* `Repository permissions` -> **Issues**: Read & Write.


* Lưu Token vào tệp môi trường của Backend: `GITHUB_PAT=github_pat_11AAAA...`
* Khai báo thêm `GITHUB_OWNER` và `GITHUB_REPO_NAME` vào `.env`.

---

#### 2. Xây dựng Backend API (Endpoint trung gian)

Tạo một endpoint API nội bộ (ví dụ: `POST /api/report-issue`).

**Payload nhận từ Frontend:**

```json
{
  "title": "Lỗi giao diện nút Submit",
  "description": "Nút Submit không phản hồi khi bấm vào trên Mobile",
  "type": "bug", // "bug" | "feature" | "improvement"
  "reporterInfo": "Thien Lam (User ID: 12345)" // Thông tin ngữ cảnh người báo lỗi
}

```

**Xử lý tại Backend (Pseudocode Node.js / Express):**

```javascript
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: process.env.GITHUB_PAT });

app.post('/api/report-issue', async (req, res) => {
  const { title, description, type, reporterInfo } = req.body;

  try {
    // 1. Format nội dung issue
    const issueBody = `
### Issue Description
${description}

---
**Reported By:** ${reporterInfo || 'Anonymous'}
**System Info:** ${req.headers['user-agent']}
    `;

    // 2. Gán Label tự động dựa trên type
    const labels = [type || 'bug', 'user-reported'];

    // 3. Gọi GitHub API
    const response = await octokit.rest.issues.create({
      owner: process.env.GITHUB_OWNER,
      repo: process.env.GITHUB_REPO,
      title: `[Report] ${title}`,
      body: issueBody,
      labels: labels,
    });

    return res.status(200).json({
      success: true,
      issueUrl: response.data.html_url
    });
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
    return res.status(500).json({ success: false, message: "Could not create issue" });
  }
});

```

---

#### 3. Xây dựng Frontend Component

Giao diện gồm **Nút Trigger** và **Modal Report Issue**:

* **Giao diện Modal:**
* Input: **Title** (Bắt buộc).
* Select/Radio: **Category** (`Bug`, `Feature Request`, `Feedback`).
* Textarea: **Description** (Bắt buộc - Mô tả các bước tái hiện lỗi).
* Auto-capture (Tùy chọn): Thu thập thông tin Trình duyệt, OS, Đường dẫn trang hiện tại (`window.location.href`).


* **Trạng thái (States):**
* `Idle` -> `Submitting` (disable nút submit) -> `Success` (hiển thị thông báo + Link xem Issue) / `Error`.



---

### Danh sách công việc (Checklist)

| Hạng mục | Công việc cụ thể | Trạng thái |
| --- | --- | --- |
| **Setup GitHub** | Tạo PAT cấp quyền `Issues: Write` và add vào `.env` | ⬜ |
| **Backend** | Cài đặt SDK `@octokit/rest` (hoặc xài `fetch` REST API) | ⬜ |
| **Backend** | Viết controller xử lý format Markdown & gửi request lên GitHub | ⬜ |
| **Backend** | Thêm Rate Limiting để tránh spam API tạo Issue | ⬜ |
| **Frontend** | Bổ sung Modal UI & tích hợp API call | ⬜ |
| **Testing** | Test tạo issue thành công và kiểm tra hiển thị Label/Body trên GitHub | ⬜ |