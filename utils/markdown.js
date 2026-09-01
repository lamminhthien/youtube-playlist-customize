// Simple safe markdown renderer for chatbot messages.
// Supports: headings, bold/italic, inline code, code blocks, links, autolinks, tables, lists, blockquotes, hr.
// All input is HTML-escaped first; only generated markdown HTML is allowed.

import { escapeHtml as esc } from "./escapeHtml.js";

const escapeHtml = esc;

const renderTables = (md) => {
  const lines = md.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.includes("|") && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (/^[\s|:\-]+$/.test(next) && next.includes("---")) {
        let headerParts = trimmed.split("|");
        if (headerParts.length && headerParts[0].trim() === "") headerParts.shift();
        if (headerParts.length && headerParts[headerParts.length - 1].trim() === "") headerParts.pop();
        const headers = headerParts.map((s) => s.trim());

        i += 2;
        const rows = [];
        while (i < lines.length) {
          const rowLine = lines[i].trim();
          if (!rowLine || !rowLine.includes("|")) break;
          if (/^[\s|:\-]+$/.test(rowLine) && rowLine.includes("---")) {
            i += 1;
            continue;
          }
          let parts = rowLine.split("|");
          if (parts.length && parts[0].trim() === "") parts.shift();
          if (parts.length && parts[parts.length - 1].trim() === "") parts.pop();
          parts = parts.map((s) => s.trim());
          rows.push(parts);
          i += 1;
        }

        let html = '<table class="yt-md-table"><thead><tr>';
        headers.forEach((h) => (html += `<th>${h}</th>`));
        html += "</tr></thead><tbody>";
        rows.forEach((r) => {
          html += "<tr>";
          r.forEach((c) => (html += `<td>${c}</td>`));
          if (r.length < headers.length) {
            for (let k = r.length; k < headers.length; k++) html += "<td></td>";
          }
          html += "</tr>";
        });
        html += "</tbody></table>";
        out.push(html);
        continue;
      }
    }
    out.push(line);
    i += 1;
  }
  return out.join("\n");
};

export const renderMarkdown = (src = "") => {
  if (!src) return "";
  let md = String(src);

  // Code blocks ```...``` – use placeholder without _ or * to avoid bold/italic collision
  const codeBlocks = [];
  md = md.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    const placeholder = `§CODEBLOCK${codeBlocks.length}§`;
    const escCode = escapeHtml(code);
    codeBlocks.push(`<pre class="yt-md-pre"><code>${escCode}</code></pre>`);
    return placeholder;
  });

  // Inline code `...`
  const inlineCodes = [];
  md = md.replace(/`([^`]+?)`/g, (_, code) => {
    const placeholder = `§INLINECODE${inlineCodes.length}§`;
    inlineCodes.push(`<code class="yt-md-code">${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Escape remaining HTML
  md = escapeHtml(md);

  // Bold / Italic (must be BEFORE link generation to avoid _blank in <a target="_blank"> being parsed as italic)
  md = md.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  md = md.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");
  md = md.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  md = md.replace(/__(.+?)__/g, "<strong>$1</strong>");
  md = md.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  md = md.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>");

  // Autolinks <https://...>
  md = md.replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g, (_, url) => {
    const href = url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${href}</a>`;
  });

  // Markdown links [text](url) — text may already contain <strong>/<em>
  md = md.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, text, url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // Bare URLs (avoid already-linked)
  md = md.replace(/(?<!href="|">)(https?:\/\/[^\s<)]+)(?![^<]*<\/a>)/g, (url) => {
    let cleanUrl = url;
    let trail = "";
    if (/[.,!?;:]$/.test(cleanUrl)) {
      trail = cleanUrl.slice(-1);
      cleanUrl = cleanUrl.slice(0, -1);
    }
    if (cleanUrl.endsWith(")") && !cleanUrl.includes("(")) {
      trail = ")" + trail;
      cleanUrl = cleanUrl.slice(0, -1);
    }
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>${trail}`;
  });

  // Tables (must be before heading/list processing, but after bold so cell bold is preserved)
  // Re-apply bold inside table cells that were generated after split? 
  // Table cells were captured after bold, so they already contain <strong> etc.
  md = renderTables(md);

  // Headings
  md = md.replace(/^###\s+(.+)$/gm, '<h3 class="yt-md-h3">$1</h3>');
  md = md.replace(/^##\s+(.+)$/gm, '<h2 class="yt-md-h2">$1</h2>');
  md = md.replace(/^#\s+(.+)$/gm, '<h1 class="yt-md-h1">$1</h1>');

  // Blockquotes (escaped &gt;)
  md = md.replace(/^&gt;\s?(.+)$/gm, '<blockquote class="yt-md-quote">$1</blockquote>');

  // Horizontal rules
  md = md.replace(/^\s*---\s*$/gm, '<hr class="yt-md-hr"/>');
  md = md.replace(/^\s*\*\*\*\s*$/gm, '<hr class="yt-md-hr"/>');
  md = md.replace(/^\s*___\s*$/gm, '<hr class="yt-md-hr"/>');

  // Lists
  md = md.replace(/^\s*[-*+]\s+(.+)$/gm, "<li>$1</li>");
  md = md.replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="yt-md-ol-item">$1</li>');

  // Group consecutive <li> into <ul>/<ol>
  md = md.replace(/(?:<li(?: class="[^"]*")?>.*?\/li>(?:\n)?)+/g, (match) => {
    const isOrdered = match.includes("yt-md-ol-item");
    const clean = match.replace(/\n/g, "");
    const liClean = clean.replace(/ class="yt-md-ol-item"/g, "");
    return isOrdered ? `<ol class="yt-md-ol">${liClean}</ol>` : `<ul class="yt-md-ul">${liClean}</ul>`;
  });

  // Newlines -> <br/>
  md = md.replace(/\n/g, "<br/>");

  // Cleanup <br/> around block elements
  md = md.replace(/<br\/>\s*(<(?:h[1-3]|blockquote|pre|table|ul|ol|li|hr)[^>]*>)/g, "$1");
  md = md.replace(/(<\/(?:h[1-3]|blockquote|pre|table|thead|tbody|tr|ul|ol|li)>)\s*<br\/>/g, "$1");
  md = md.replace(/(<hr[^>]*\/>)\s*<br\/>/g, "$1");
  md = md.replace(/<br\/>\s*<hr/g, "<hr");

  // Restore inline code and code blocks
  codeBlocks.forEach((html, idx) => {
    md = md.split(`§CODEBLOCK${idx}§`).join(html);
  });
  inlineCodes.forEach((html, idx) => {
    md = md.split(`§INLINECODE${idx}§`).join(html);
  });

  // Merge adjacent blockquotes that were split by <br/>
  md = md.replace(/<\/blockquote><br\/><blockquote class="yt-md-quote">/g, "<br/>");

  return md;
};

export default renderMarkdown;
