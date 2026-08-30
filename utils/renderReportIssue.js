export function renderReportIssueButton(onOpen) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "yt-btn yt-btn-ghost";
  btn.setAttribute("aria-label", "Report an issue");
  btn.innerHTML = `
    <svg class="yt-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
    Feedback
  `;
  btn.addEventListener("click", onOpen);
  return btn;
}

export function createReportIssueModal(onClose) {
  const overlay = document.createElement("div");
  overlay.className = "yt-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "report-issue-title");

  const modal = document.createElement("div");
  modal.className = "yt-modal";

  modal.innerHTML = `
    <div class="yt-modal-header">
      <h2 id="report-issue-title" class="yt-modal-title">Report an Issue</h2>
      <button type="button" class="yt-modal-close" aria-label="Close modal">&times;</button>
    </div>
    <form class="yt-modal-form" novalidate>
      <div class="yt-modal-body">
        <div class="yt-form-group">
          <label for="issue-title" class="yt-form-label">Title <span class="yt-required" aria-hidden="true">*</span></label>
          <input
            type="text"
            id="issue-title"
            name="title"
            class="yt-form-input"
            placeholder="Brief summary of the issue"
            required
            maxlength="100"
            autocomplete="off"
          />
        </div>
        <div class="yt-form-group">
          <label for="issue-type" class="yt-form-label">Category <span class="yt-required" aria-hidden="true">*</span></label>
          <select id="issue-type" name="type" class="yt-form-select" required>
            <option value="bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="improvement">Improvement</option>
            <option value="feedback">Feedback</option>
          </select>
        </div>
        <div class="yt-form-group">
          <label for="issue-description" class="yt-form-label">Description <span class="yt-required" aria-hidden="true">*</span></label>
          <textarea
            id="issue-description"
            name="description"
            class="yt-form-textarea"
            placeholder="Describe the issue in detail. Include steps to reproduce, expected behavior, and actual behavior."
            required
            rows="6"
            maxlength="5000"
          ></textarea>
          <p class="yt-form-hint">Tip: Include browser/OS, steps to reproduce, and screenshots if helpful.</p>
        </div>
      </div>
      <div class="yt-modal-footer">
        <button type="button" class="yt-btn yt-btn-secondary" data-action="cancel">Cancel</button>
        <button type="submit" class="yt-btn yt-btn-primary" data-action="submit">
          <span class="yt-btn-text">Submit</span>
          <span class="yt-btn-loading hidden" aria-hidden="true">
            <svg class="yt-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" class="yt-spinner-path" />
            </svg>
          </span>
        </button>
      </div>
      <div class="yt-modal-message hidden" aria-live="polite"></div>
    </form>
  `;

  const closeBtn = modal.querySelector(".yt-modal-close");
  const cancelBtn = modal.querySelector('[data-action="cancel"]');
  const form = modal.querySelector(".yt-modal-form");
  const submitBtn = modal.querySelector('[data-action="submit"]');
  const btnText = submitBtn.querySelector(".yt-btn-text");
  const btnLoading = submitBtn.querySelector(".yt-btn-loading");
  const messageEl = modal.querySelector(".yt-modal-message");

  const closeModal = () => {
    overlay.classList.add("yt-hidden");
    setTimeout(() => overlay.remove(), 150);
    onClose?.();
  };

  const setSubmitting = (isSubmitting) => {
    submitBtn.disabled = isSubmitting;
    btnText.classList.toggle("hidden", isSubmitting);
    btnLoading.classList.toggle("hidden", !isSubmitting);
    cancelBtn.disabled = isSubmitting;
    form.querySelectorAll("input, select, textarea").forEach((el) => (el.disabled = isSubmitting));
  };

  const showMessage = (text, isError = false, renderHtml = false) => {
    messageEl[renderHtml ? "innerHTML" : "textContent"] = text;
    messageEl.className = `yt-modal-message ${isError ? "yt-error" : "yt-success"}`;
    messageEl.classList.remove("hidden");
  };

  const hideMessage = () => {
    messageEl.classList.add("hidden");
  };

  closeBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideMessage();

    const formData = new FormData(form);
    const payload = {
      title: formData.get("title").trim(),
      description: formData.get("description").trim(),
      type: formData.get("type"),
      reporterInfo: `User on ${window.location.href}`,
    };

    setSubmitting(true);

    try {
      const response = await fetch("/api/report-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        showMessage(`Issue submitted successfully! <a href="${data.issueUrl}" target="_blank" rel="noopener">View on GitHub #${data.issueNumber}</a>`, false, true);
        form.reset();
        setTimeout(closeModal, 3000);
      } else {
        showMessage(data.message || "Failed to submit issue. Please try again.", true);
      }
    } catch (err) {
      console.error("Report issue error:", err);
      showMessage("Network error. Please check your connection and try again.", true);
    } finally {
      setSubmitting(false);
    }
  });

  overlay.appendChild(modal);
  return overlay;
}

export function openReportIssueModal() {
  const existingModal = document.querySelector(".yt-modal-overlay");
  if (existingModal) return;

  const modal = createReportIssueModal();
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.remove("yt-hidden"));
  modal.querySelector("#issue-title").focus();

  const handleKeydown = (e) => {
    if (e.key === "Escape") {
      modal.querySelector(".yt-modal-close")?.click();
      document.removeEventListener("keydown", handleKeydown);
    }
  };
  document.addEventListener("keydown", handleKeydown);
}
