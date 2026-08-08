// Minimal DOM stub sufficient for unit-testing this project's render* utilities.
// Implements ONLY the surfaces used by the source files:
//   - element creation via document.createElement
//   - tagName, className, classList (.toggle/.add/.remove/.contains), innerHTML
//   - querySelector / querySelectorAll (tag + attribute + class matchers)
//   - setAttribute / getAttribute
//   - appendChild / append / firstElementChild / children / textContent
//   - dispatchEvent / addEventListener / KeyboardEvent
//   - focus()
// Not a spec-compliant DOM — just enough to drive the tests.

const VOID_TAGS = new Set(["br", "img", "input", "meta", "link", "hr"]);

class Node {
  constructor(tagName) {
    this.tagName = String(tagName || "").toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = {};
    this._listeners = {};
    this._classes = new Set();
    this.classList = {
      add: (...xs) => xs.forEach((x) => this._classes.add(x)),
      remove: (...xs) => xs.forEach((x) => this._classes.delete(x)),
      contains: (x) => this._classes.has(x),
      toggle: (x, force) => {
        if (force === true) {
          this._classes.add(x);
          return true;
        }
        if (force === false) {
          this._classes.delete(x);
          return false;
        }
        if (this._classes.has(x)) {
          this._classes.delete(x);
          return false;
        }
        this._classes.add(x);
        return true;
      },
    };
    this.style = {};
  }
  get className() {
    return [...this._classes].join(" ");
  }
  set className(v) {
    this._classes = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  get firstElementChild() {
    return this.childNodes.find((n) => n.nodeType === 1) || null;
  }
  get children() {
    return this.childNodes.filter((n) => n.nodeType === 1);
  }
  get textContent() {
    return this.childNodes
      .map((c) => (c.nodeType === 3 ? c._text : c.textContent || ""))
      .join("");
  }
  set textContent(v) {
    this.childNodes = [{ nodeType: 3, _text: String(v ?? ""), parentNode: this }];
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") this.className = String(value);
  }
  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null;
  }
  appendChild(child) {
    if (child.nodeType === 1) child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }
  append(...nodes) {
    nodes.forEach((n) => this.appendChild(n));
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  dispatchEvent(event) {
    (this._listeners[event.type] || []).forEach((fn) =>
      fn.call(this, event)
    );
  }
  focus() {
    this._focused = true;
  }
  querySelector(selector) {
    return this._query(selector, false);
  }
  querySelectorAll(selector) {
    return this._query(selector, true);
  }
  _query(selector, all) {
    const results = [];
    const visit = (n) => {
      if (n._matches(selector)) {
        results.push(n);
        if (!all) return true;
      }
      for (const c of n.childNodes) {
        if (c.nodeType !== 1) continue;
        if (visit(c)) return true;
      }
      return false;
    };
    for (const c of this.childNodes) {
      if (c.nodeType !== 1) continue;
      if (visit(c)) {
        if (!all) return results[0] || null;
        break;
      }
    }
    return all ? results : null;
  }
  _matches(selector) {
    // Supported grammar: tag, .cls, [attr], [attr="v"], #id
    // Combinations like 'a[target="_blank"]' are parsed left-to-right.
    let s = selector.trim();
    // Tag
    const tagMatch = s.match(/^([a-zA-Z][\w-]*)/);
    let tag = null;
    if (tagMatch && !s.startsWith(".") && !s.startsWith("[")) {
      tag = tagMatch[1].toUpperCase();
      s = s.slice(tagMatch[0].length);
    }
    if (tag && this.tagName !== tag) return false;
    while (s) {
      if (s.startsWith(".")) {
        const m = s.match(/^\.([\w-]+)/);
        if (!m) return false;
        if (!this._classes.has(m[1])) return false;
        s = s.slice(m[0].length);
      } else if (s.startsWith("[")) {
        const end = s.indexOf("]");
        if (end === -1) return false;
        const expr = s.slice(1, end);
        s = s.slice(end + 1);
        const eq = expr.match(/^([\w-]+)(?:="([^"]*)")?$/);
        if (!eq) return false;
        const [, name, value] = eq;
        if (!(name in this.attributes)) return false;
        if (value !== undefined && this.attributes[name] !== value) return false;
      } else if (s.startsWith("#")) {
        const m = s.match(/^#([\w-]+)/);
        if (!m) return false;
        if (this.attributes.id !== m[1]) return false;
        s = s.slice(m[0].length);
      } else {
        return false;
      }
    }
    return true;
  }
  // Very small subset of HTML parsing for innerHTML. Supports the tags the
  // renderers emit: section, div, h2, h3, p, span, button, a, svg, path, line,
  // polyline, circle, rect, plus their attributes and text.
  // HTML serialization for the innerHTML getter.
  // In real DOMs, innerHTML re-escapes `<`, `>`, and `"`, but leaves existing
  // `&...;` entities as-is. We mirror that behaviour so round-trips are stable.
  get innerHTML() {
    const escapeText = (s) =>
      String(s)
        .replace(/&(?!#?\w+;)/g, "&amp;") // escape bare `&` only
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    const escapeAttr = (s) =>
      String(s)
        .replace(/&(?!#?\w+;)/g, "&amp;")
        .replace(/"/g, "&quot;");
    return this.childNodes
      .map((c) => {
        if (c.nodeType === 3) return escapeText(c._text);
        const attrs = Object.entries(c.attributes)
          .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
          .join("");
        if (VOID_TAGS.has(c.tagName.toLowerCase())) {
          return `<${c.tagName.toLowerCase()}${attrs}>`;
        }
        return `<${c.tagName.toLowerCase()}${attrs}>${c.innerHTML}</${c.tagName.toLowerCase()}>`;
      })
      .join("");
  }
  set innerHTML(html) {
    this.childNodes = parseHTML(String(html ?? ""), this);
  }
}

// --- Tiny HTML parser (good enough for the renderers' output) ---
function parseHTML(html, parent) {
  const nodes = [];
  let i = 0;
  const stack = [{ childNodes: nodes }];

  const top = () => stack[stack.length - 1];
  const pushText = (text) => {
    if (!text) return;
    // Decode the five HTML entities so textContent reflects the displayed value.
    const decoded = String(text)
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&"); // decode ampersand-entities LAST
    top().childNodes.push({
      nodeType: 3,
      _text: decoded,
      parentNode: stack.length > 1 ? stack[stack.length - 1] : parent,
    });
  };
  const pushElement = (tag, attrs) => {
    const el = new Node(tag);
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.parentNode = stack.length > 1 ? stack[stack.length - 1] : parent;
    if (VOID_TAGS.has(tag.toLowerCase())) {
      top().childNodes.push(el);
      return;
    }
    top().childNodes.push(el);
    stack.push(el);
  };
  const popTag = (tag) => {
    for (let j = stack.length - 1; j >= 1; j--) {
      if (stack[j].tagName.toLowerCase() === tag.toLowerCase()) {
        stack.length = j;
        break;
      }
    }
  };

  while (i < html.length) {
    if (html[i] === "<") {
      // comment
      if (html.startsWith("<!--", i)) {
        const end = html.indexOf("-->", i + 4);
        i = end === -1 ? html.length : end + 3;
        continue;
      }
      const end = html.indexOf(">", i);
      if (end === -1) break;
      const raw = html.slice(i + 1, end).trim();
      i = end + 1;
      const isClose = raw.startsWith("/");
      const body = isClose ? raw.slice(1).trim() : raw;
      if (isClose) {
        popTag(body);
        continue;
      }
      const selfClose = body.endsWith("/");
      const cleaned = selfClose ? body.slice(0, -1).trim() : body;
      const m = cleaned.match(/^([a-zA-Z][\w-]*)(.*)$/s);
      if (!m) continue;
      const tag = m[1];
      const attrStr = m[2];
      const attrs = {};
      const attrRe = /([\w:-]+)(?:\s*=\s*"([^"]*)")?/g;
      let am;
      while ((am = attrRe.exec(attrStr)) !== null) {
        attrs[am[1]] = am[2] === undefined ? "" : am[2];
      }
      pushElement(tag, attrs);
      if (selfClose || VOID_TAGS.has(tag.toLowerCase())) {
        if (stack.length > 1) stack.length -= 1;
      }
    } else {
      let next = html.indexOf("<", i);
      if (next === -1) next = html.length;
      const text = html.slice(i, next);
      i = next;
      pushText(text);
    }
  }
  return nodes;
}

class KeyboardEvent {
  constructor(type, init = {}) {
    this.type = type;
    Object.assign(this, init);
  }
  preventDefault() {
    this.defaultPrevented = true;
  }
}

// `document` shim
const document = {
  createElement(tag) {
    return new Node(tag);
  },
  body: new Node("body"),
};

export { document, Node, KeyboardEvent };
