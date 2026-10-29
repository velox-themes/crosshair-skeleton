/*! crosshair-skeleton v1.0.0 · MIT License · no dependencies */
// A loading skeleton that locks onto an element, measures it, maps a grid over it,
// traces the shape of what is inside, waits cheaply, then hands over to the real content.
//
//   const s = crosshair(el);   // when loading starts
//   s.done();                  // when the data has arrived and is rendered (returns a promise)
//
// or declaratively: <div data-crosshair="loading"> … </div> + watch()

const NS_READY = typeof window !== "undefined" && typeof document !== "undefined";

const DEFAULTS = {
  reveal: "fade", // "fade" | "blink" | "scan"
  grace: 150, // ms before anything is drawn; loads faster than this never show a skeleton
  minVisible: 600, // once drawn, keep it at least this long so it never flashes
  trace: "auto", // "auto" (shape of what is inside) | "box" (outer box only) | "none"
  depth: 3, // structural boxes: 1 outer box, 2 sections, 3 their children
  cell: 56, // target grid cell in px (grown automatically on large elements)
  readout: "auto", // phase + size label: true | false | "auto" (only on elements ≥ 240×120)
  pulse: true, // slow breathing while waiting (compositor-only)
  speed: 1, // 2 = twice as fast, 0.5 = half speed
};

// Tuned together as one rhythm. Change `speed`, not these one by one.
const BUILD = { lock: 90, blink: 105, expand: 570, draw: 390, stagger: 345, wireStart: 600, wireDraw: 173, wireStagger: 248 };
const HAND = { handoff: 1100, uiAt: 250, fade: 500, blink: 70, spread: 450, scan: 900 };
const BLINKS = 2;
const REVEAL_BLINKS = 3;
const PULSE = 1000;
const MAX_SHAPES = 90;
const MAX_VISITS = 600;
const MAX_WRAPPERS = 32;
const MAX_TEXT = 1500; // characters measured per text block: plenty for the 8 lines drawn

const EASE = {
  lock: "cubic-bezier(0.16, 1, 0.3, 1)",
  expand: "cubic-bezier(0.85, 0, 0.15, 1)",
  draw: "cubic-bezier(0.65, 0, 0.35, 1)",
  out: "cubic-bezier(0.25, 1, 0.5, 1)",
};

const mix = (pct) => `color-mix(in srgb, currentColor ${pct}%, transparent)`;
// Hiding and overlay geometry are !important so ordinary host rules (`.card > div { position: relative }`,
// an inline `opacity: 1`) can't break them. Reveal animations run only after the hiding marker is removed.
const CSS = `
[data-crosshair="loading"]:not([data-cs-show])>:not(.cs-ov),[data-cs-hide]>:not(.cs-ov){opacity:0!important;visibility:hidden!important}
[data-cs-hide]{-webkit-text-fill-color:transparent}
.cs-ov,.cs-ov *{box-sizing:content-box!important;padding:0!important;border:0!important;margin:0!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;float:none!important;transform:none}
.cs-ov{position:absolute!important;inset:0!important;display:block!important;width:auto!important;height:auto!important;background:transparent!important;z-index:10;pointer-events:none!important;-webkit-text-fill-color:currentColor;visibility:visible!important;contain:layout style}
.cs-ov .cs-clip,.cs-ov .cs-scanbox{position:absolute!important;inset:0!important;display:block!important;overflow:hidden!important;border-radius:inherit}
.cs-ov .cs-fill{position:absolute!important;inset:0!important;display:block!important;background:var(--cs-fill,${mix(7)})!important}
.cs-ov svg{position:absolute!important;left:0!important;top:0!important;display:block!important;overflow:visible!important}
.cs-ov .cs-grid,.cs-ov .cs-wire{will-change:opacity}
.cs-ov .cs-grid path{fill:none;stroke:var(--cs-line,${mix(5)});stroke-width:1}
.cs-ov .cs-grid circle{fill:var(--cs-dot,${mix(16)})}
.cs-ov .cs-wire path{fill:none;stroke:var(--cs-wire,${mix(24)});stroke-width:1}
.cs-ov .cs-ch{position:absolute!important;display:block!important;left:0;top:0;width:56px!important;height:56px!important;margin:-28px 0 0 -28px!important;opacity:0}
.cs-ov .cs-ch[data-c=tr]{left:100%}.cs-ov .cs-ch[data-c=bl]{top:100%}.cs-ov .cs-ch[data-c=br]{left:100%;top:100%}
.cs-ov .cs-ch>i{position:absolute!important;inset:0!important;display:block!important;--m:var(--cs-mark,${mix(24)});--a:var(--cs-arm,${mix(12)});background:
linear-gradient(var(--m),var(--m)) 23px 27px/10px 2px no-repeat,
linear-gradient(var(--m),var(--m)) 27px 23px/2px 10px no-repeat,
linear-gradient(90deg,transparent,var(--a)) 0 27.5px/23px 1px no-repeat,
linear-gradient(270deg,transparent,var(--a)) 33px 27.5px/23px 1px no-repeat,
linear-gradient(180deg,transparent,var(--a)) 27.5px 0/1px 23px no-repeat,
linear-gradient(0deg,transparent,var(--a)) 27.5px 33px/1px 23px no-repeat!important}
.cs-ov .cs-ro{position:absolute!important;display:block!important;left:18px;top:-22px;font:500 10px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;white-space:nowrap;font-variant-numeric:tabular-nums;opacity:0}
.cs-ov .cs-ro b{font-weight:500;margin-right:10px!important}.cs-ov .cs-ro span{opacity:.55}
.cs-ov .cs-scan{position:absolute!important;display:block!important;left:0;right:0;top:0;height:48px!important;background:var(--cs-scan,${mix(30)})!important;opacity:0;will-change:transform,opacity;-webkit-mask-repeat:repeat-x;mask-repeat:repeat-x}
`;

// Styles go to the element's own document (iframes too) or to its shadow root (Lit, web components),
// once per root. A constructable sheet per document: no <style> tag, works under most CSPs.
const sheets = new WeakMap();
const styledRoots = new WeakSet();
function injectStyles(el) {
  const doc = el.ownerDocument;
  const root = el.getRootNode();
  const target = root.nodeType === 11 && root.host ? root : doc; // nodeType check works across realms
  if (styledRoots.has(target)) return;
  styledRoots.add(target);
  try {
    let sheet = sheets.get(doc);
    if (!sheet) {
      sheet = new doc.defaultView.CSSStyleSheet();
      sheet.replaceSync(CSS);
      sheets.set(doc, sheet);
    }
    target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
  } catch {
    const tag = doc.createElement("style");
    tag.setAttribute("data-crosshair-skeleton", "");
    tag.textContent = CSS;
    (target === doc ? doc.head : target).appendChild(tag);
  }
}

// Only for the readout counter: same curve as the expand, solved by bisection
function bezier(x1, y1, x2, y2) {
  const at = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 22; i++) {
      if (at(t, x1, x2) < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return at(t, y1, y2);
  };
}
const expandCurve = bezier(0.85, 0, 0.15, 1);

// Ordered 4×4 Bayer dither for the scan line, denser toward the direction of travel
let ditherUrl = "";
function dither(doc, height) {
  if (ditherUrl) return ditherUrl;
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const px = 2, cols = 4, rows = height / px;
  const cv = doc.createElement("canvas");
  cv.width = cols * px;
  cv.height = rows * px;
  const g = cv.getContext("2d");
  if (!g) return "";
  for (let y = 0; y < rows; y++) {
    const v = y === rows - 1 ? 1 : (y / (rows - 1)) ** 1.6;
    for (let x = 0; x < cols; x++) if (v > (BAYER[y % 4][x % 4] + 0.5) / 16) g.fillRect(x * px, y * px, px, px);
  }
  return (ditherUrl = cv.toDataURL());
}

// ---------- Shared observers ----------
let io = null;
const ioCallbacks = new Map();
function observe(el, cb) {
  io ||= new IntersectionObserver((entries) => entries.forEach((e) => ioCallbacks.get(e.target)?.(e.isIntersecting)), { rootMargin: "100px" });
  ioCallbacks.set(el, cb);
  io.observe(el);
}
function unobserve(el) {
  if (!io) return;
  io.unobserve(el);
  ioCallbacks.delete(el);
}

// ---------- DOM building (no HTML strings, so strict Trusted Types policies are fine) ----------
const SVG_NS = "http://www.w3.org/2000/svg";
function node(doc, tag, attrs, parent, svg = false) {
  const n = svg ? doc.createElementNS(SVG_NS, tag) : doc.createElement(tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

// ---------- Reading the shape ----------
const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "BR", "WBR", "LINK", "META"]);
const MEDIA = new Set(["IMG", "VIDEO", "IFRAME", "PICTURE", "OBJECT", "EMBED"]);
const CONTROL = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "PROGRESS", "METER"]);
const NO_CHILDREN = /^(IMG|VIDEO|AUDIO|CANVAS|SVG|INPUT|TEXTAREA|SELECT|IFRAME|PICTURE|EMBED|OBJECT|BR|HR)$/;
const kids = (n) => [...n.children].filter((c) => !c.classList.contains("cs-ov") && !SKIP.has(c.tagName.toUpperCase()));
const ownText = (n) => [...n.childNodes].some((c) => c.nodeType === 3 && c.data.trim());

function leafKind(n, w, h) {
  const t = n.tagName.toUpperCase();
  if (MEDIA.has(t) || n.getAttribute("role") === "img") return "media";
  if (t === "CANVAS" || t === "SVG") return w >= 80 && h >= 48 ? "chart" : "box";
  if (CONTROL.has(t) || n.getAttribute("role") === "button") return "box";
  if (ownText(n)) return "text";
  return null;
}

function hasSurface(n) {
  const cs = getComputedStyle(n);
  const bg = cs.backgroundColor;
  return cs.backgroundImage !== "none" || parseFloat(cs.borderTopWidth) > 0 ||
    !(bg === "transparent" || /^rgba?\(.*,\s*0\)$/.test(bg) || /\/\s*0\)$/.test(bg));
}

// Converts viewport rects into the element's own padding-box coordinates, undoing any scale
// transform on the element or its ancestors (rotation is not supported)
function frameOf(el) {
  const r0 = el.getBoundingClientRect();
  const sx = el.offsetWidth ? r0.width / el.offsetWidth : 1;
  const sy = el.offsetHeight ? r0.height / el.offsetHeight : 1;
  return (r) => ({
    x: (r.left - r0.left) / sx - el.clientLeft,
    y: (r.top - r0.top) / sy - el.clientTop,
    w: r.width / sx,
    h: r.height / sy,
  });
}

// The element's outer (border-box) layout size, as DevTools shows it: unaffected by transforms
function outerSize(el) {
  if (el.offsetWidth || el.offsetHeight) return [el.offsetWidth, el.offsetHeight];
  const r = el.getBoundingClientRect();
  return [Math.round(r.width), Math.round(r.height)];
}

// The element the sections live in: skip single-child wrappers (a card inside a slot, etc.)
function contentRoot(el) {
  let root = el;
  for (let i = 0, k = kids(root); i < MAX_WRAPPERS && k.length === 1; i++, k = kids(root)) {
    const r = k[0].getBoundingClientRect();
    // Stop at a leaf, or at a lone box with nothing inside: it is a section to trace, not a wrapper
    if (k[0].hasAttribute("data-crosshair-part") || leafKind(k[0], r.width, r.height) || !kids(k[0]).length) break;
    root = k[0];
  }
  return root;
}

function measure(el, W, H, o) {
  const shapes = [];
  const doc = el.ownerDocument;
  const local = frameOf(el);
  const cs = getComputedStyle(el);
  const pad = (side) => parseFloat(cs["padding" + side]) || 0;
  const add = (s) => { if (shapes.length < MAX_SHAPES && s.w >= 2 && s.h >= 2) shapes.push(s); };
  add({ kind: "box", x: pad("Left"), y: pad("Top"), w: W - pad("Left") - pad("Right"), h: H - pad("Top") - pad("Bottom"), g: -1 });
  const root = contentRoot(el);
  const groups = kids(root);
  if (o.trace !== "auto") return { shapes, root, groups };

  const textLines = (n, g) => {
    // Text node by node, bounded by characters, nodes and rectangles: a long article costs the same as a short one
    const range = doc.createRange();
    const walker = doc.createTreeWalker(n, 4 /* NodeFilter.SHOW_TEXT */);
    const rects = [];
    let chars = 0, nodes = 0, t;
    while ((t = walker.nextNode()) && chars < MAX_TEXT && nodes++ < 200 && rects.length < 400) {
      if (!t.data.trim()) continue;
      range.setStart(t, 0);
      range.setEnd(t, Math.min(t.data.length, MAX_TEXT - chars));
      chars += t.data.length;
      for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) rects.push(r);
    }
    rects.sort((a, b) => a.top - b.top || a.left - b.left);
    const lines = [];
    for (const r of rects) {
      const L = lines[lines.length - 1];
      if (L && Math.min(L.b, r.bottom) - Math.max(L.t, r.top) > 0.5 * Math.min(L.b - L.t, r.height)) {
        L.l = Math.min(L.l, r.left); L.r = Math.max(L.r, r.right); L.t = Math.min(L.t, r.top); L.b = Math.max(L.b, r.bottom);
      } else if (lines.length < 8) lines.push({ l: r.left, r: r.right, t: r.top, b: r.bottom });
    }
    const bars = lines.map((L) => {
      const b = local({ left: L.l, top: L.t, width: L.r - L.l, height: L.b - L.t });
      const bh = Math.max(3, Math.round(b.h * 0.5));
      return { x: b.x, y: b.y + (b.h - bh) / 2, w: b.w, h: bh };
    }).filter((b) => b.w >= 2 && b.y < H && b.y + b.h > 0);
    if (bars.length) add({ kind: "text", x: bars[0].x, y: bars[0].y, w: bars[0].w, h: bars[0].h, g, lines: bars });
  };

  // The element itself is a headline, a paragraph, a button…: trace its own lines
  if (ownText(el)) textLines(el, -1);

  let budget = MAX_VISITS;
  const walk = (n, level, g, parent) => {
    if (--budget < 0 || shapes.length >= MAX_SHAPES) return;
    const part = n.getAttribute("data-crosshair-part");
    if (part === "skip") return;
    // display:none and content-visibility only: while loading, everything is visibility:hidden on purpose
    if (n.checkVisibility && !n.checkVisibility()) return;
    const r = n.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) {
      if (getComputedStyle(n).display === "contents") kids(n).forEach((c) => walk(c, level, g, parent));
      return;
    }
    const { x, y, w, h } = local(r);
    if (x >= W || y >= H || x + w <= 0 || y + h <= 0) return;
    const kind = part || leafKind(n, w, h);
    if (kind === "text") {
      // Text with its own surface (a pill, a chip, a chat bubble) keeps its outline at any depth:
      // it is a visible shape, not structure
      if (hasSurface(n)) add({ kind: "box", x, y, w, h, g });
      return textLines(n, g);
    }
    if (kind) return add({ kind, x, y, w, h, g });
    const children = kids(n);
    // A dense grid (heatmap, calendar, long list) reads better as one block than 90 tiny boxes
    if (children.length > 40) return add({ kind: "chart", x, y, w, h, g });
    const same = parent && Math.abs(parent.x - x) < 2 && Math.abs(parent.y - y) < 2 && Math.abs(parent.w - w) < 2 && Math.abs(parent.h - h) < 2;
    let box = parent;
    if (level <= o.depth && !same) {
      box = { x, y, w, h };
      add({ kind: "box", x, y, w, h, g });
    }
    children.forEach((c) => walk(c, level + 1, g, box));
  };
  groups.forEach((n, g) => walk(n, 2, g, null));
  return { shapes, root, groups };
}

const rect = (x, y, w, h) => {
  x = Math.round(x) + 0.5;
  y = Math.round(y) + 0.5;
  w = Math.max(1, Math.round(w) - 1);
  h = Math.max(1, Math.round(h) - 1);
  return `M${x} ${y}h${w}v${h}h${-w}Z`;
};
function pathOf(s) {
  if (s.kind === "text") return s.lines.map((l) => rect(l.x, l.y, l.w, l.h)).join("");
  let d = rect(s.x, s.y, s.w, s.h);
  const L = Math.round(s.x) + 0.5, T = Math.round(s.y) + 0.5;
  const R = L + Math.max(1, Math.round(s.w) - 1), B = T + Math.max(1, Math.round(s.h) - 1);
  if (s.kind === "media") d += `M${L} ${T}L${R} ${B}M${R} ${T}L${L} ${B}`;
  if (s.kind === "chart") for (const f of [1 / 3, 2 / 3]) d += `M${L} ${Math.round(T + (B - T) * f) + 0.5}H${R}`;
  return d;
}

// Grid lines land exactly on both edges; never more than ~48 lines however large the element
function buildGrid(doc, svg, W, H, cell) {
  cell = Math.max(cell, (W + H) / 48);
  const axis = (len) => {
    const n = Math.max(1, Math.round(len / cell)), out = [];
    for (let i = 1; i < n; i++) out.push(Math.round((i * len) / n) + 0.5);
    return out;
  };
  const xs = axis(W), ys = axis(H);
  const lines = [];
  const line = (d, delay) => lines.push({ n: node(doc, "path", { d, pathLength: "1", "stroke-dasharray": "1 1" }, svg, true), delay });
  xs.forEach((x) => line(`M${x} 0V${H}`, x / W));
  ys.forEach((y) => line(`M0 ${y}H${W}`, y / H));
  // Dots fade in as 12 diagonal bands: 12 animations, not one per dot
  const BANDS = 12, bands = [];
  if (xs.length * ys.length <= 900) {
    const groups = Array.from({ length: BANDS }, () => null);
    xs.forEach((x) => ys.forEach((y) => {
      const i = Math.min(BANDS - 1, Math.floor(((x + y) / (W + H)) * BANDS));
      groups[i] ||= node(doc, "g", {}, null, true);
      node(doc, "circle", { cx: x, cy: y, r: "1.15" }, groups[i], true);
    }));
    groups.forEach((g, i) => { if (g) { svg.appendChild(g); bands.push({ n: g, delay: i / (BANDS - 1) }); } });
  }
  return { lines, bands };
}

// Hard-cut flicker, no tweening between states: from → to → from → … → to
function flicker(from, to, prop = "opacity", n = REVEAL_BLINKS) {
  const frames = [];
  for (let k = 0; k < n * 2; k++) frames.push({ [prop]: k % 2 ? to : from, offset: k / (n * 2), easing: "steps(1, end)" });
  frames.push({ [prop]: to, offset: 1 });
  return frames;
}

// Skeletons that start together are spaced out a little, so a page of them cascades in
// instead of every build drawing its first frames at the same moment (at most half a second)
const SLOT = 60, MAX_QUEUE = 480;
let nextSlot = 0;
function buildSlot() {
  const now = performance.now();
  const at = Math.max(now, Math.min(nextSlot, now + MAX_QUEUE));
  nextSlot = at + SLOT;
  return at - now;
}

// Readouts sit above their element, on the parent's background, so they take the parent's colour.
// One watcher per document keeps them in step when the page switches theme (a class or data attribute
// on <html>/<body>, or the system colour scheme). It exists only while a readout is showing.
const themeWatchers = new Map(); // document → { readouts: Map(readout → host), stop() }
function paintReadout(ro, el) {
  ro.style.color = (el.ownerDocument.defaultView || window).getComputedStyle(el.parentElement || el).color;
}
function trackReadout(ro, el) {
  const doc = el.ownerDocument;
  let w = themeWatchers.get(doc);
  if (!w) {
    const win = doc.defaultView || window;
    const readouts = new Map();
    let frame = 0;
    const refresh = () => {
      if (frame) return;
      frame = win.requestAnimationFrame(() => { frame = 0; readouts.forEach((host, r) => paintReadout(r, host)); });
    };
    const mo = new win.MutationObserver(refresh);
    [doc.documentElement, doc.body].forEach((n) => n && mo.observe(n, { attributes: true }));
    const mq = win.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener?.("change", refresh);
    w = {
      readouts,
      stop() {
        mo.disconnect();
        mq?.removeEventListener?.("change", refresh);
        if (frame) win.cancelAnimationFrame(frame);
      },
    };
    themeWatchers.set(doc, w);
  }
  w.readouts.set(ro, el);
  paintReadout(ro, el);
}
function untrackReadout(ro, el) {
  const w = themeWatchers.get(el.ownerDocument);
  if (!w) return;
  w.readouts.delete(ro);
  if (!w.readouts.size) {
    w.stop();
    themeWatchers.delete(el.ownerDocument);
  }
}

const pad4 = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");
const live = new WeakMap();
const active = new Set();

function noop() {
  const p = Promise.resolve();
  return { done: () => p, cancel() {}, finished: p, ending: true };
}

/**
 * Start a crosshair skeleton on an element.
 * @param {HTMLElement} el  The element that is loading. Give it its final size.
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {{ done(): Promise<void>, cancel(): void, finished: Promise<void> }}
 */
export function crosshair(el, options = {}) {
  if (!NS_READY || !el) return noop();
  if (NO_CHILDREN.test(el.tagName.toUpperCase())) {
    // The overlay lives inside the element, so it needs one that can hold children
    console.warn("crosshair-skeleton: wrap <" + el.tagName.toLowerCase() + "> in a container and pass the container.");
    return noop();
  }
  live.get(el)?.cancel();
  injectStyles(el);

  const doc = el.ownerDocument;
  const win = doc.defaultView || window;
  const o = { ...DEFAULTS, ...options };
  const k = o.speed > 0 ? 1 / o.speed : 1;
  const t = Object.fromEntries(Object.entries(BUILD).map(([n, v]) => [n, v * k]));
  const reduced = win.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = "wait"; // wait → ready → queued → build → idle → reveal → done
  let visible = false, ov = null, ro = null, shownAt = 0, cleanAt = 0, raf = 0, revealQueued = false;
  let m = null, W = 0, H = 0, BW = 0, BH = 0, pulses = [], tracked = [];
  let roLabel = "", roW = 0, roH = 0, roText = "";
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  let resolve;
  const finished = new Promise((r) => (resolve = r));

  // Everything we change on the host, so cleanup can put it back exactly as it was
  const prevBusy = el.getAttribute("aria-busy");
  const prevHide = el.getAttribute("data-cs-hide");
  const hadInert = el.hasAttribute("inert");
  const hadStyle = el.hasAttribute("style");
  let prevPos = null, attrsRestored = false;
  const put = (name, value) => (value === null ? el.removeAttribute(name) : el.setAttribute(name, value));
  // At the reveal (or on cancel): content becomes visible and interactive again. Runs once, so a
  // value the app sets during the handover is never overwritten by the final cleanup.
  const restoreAttrs = () => {
    if (attrsRestored) return;
    attrsRestored = true;
    put("data-cs-hide", prevHide);
    put("aria-busy", prevBusy);
    if (!hadInert) el.removeAttribute("inert");
  };
  // At the end, once the overlay is gone (it is positioned against the host until then)
  const restoreHost = () => {
    restoreAttrs();
    if (prevPos) {
      if (prevPos.value) el.style.setProperty("position", prevPos.value, prevPos.priority);
      else el.style.removeProperty("position");
      if (!hadStyle && !el.getAttribute("style")) el.removeAttribute("style");
      prevPos = null;
    }
  };

  // Hidden, inert (no focus, clicks or screen reader access to the placeholder) and busy until the reveal
  el.removeAttribute("data-cs-show");
  el.setAttribute("data-cs-hide", "");
  el.setAttribute("aria-busy", "true");
  el.setAttribute("inert", "");
  later(() => { state = "ready"; maybeBuild(); }, o.grace);
  observe(el, (v) => {
    visible = v;
    if (state === "ready") maybeBuild();
    pulses.forEach((a) => (v ? a.play() : a.pause()));
  });

  function maybeBuild() {
    // Off-screen skeletons are not built until they scroll into view
    if (state !== "ready" || !visible) return;
    state = "queued";
    const wait = buildSlot();
    if (wait) later(build, wait); else build();
  }

  function setRo(label, w = roW, h = roH) {
    if (!ro) return;
    roLabel = label; roW = w; roH = h;
    const text = label + "|" + pad4(w) + " × " + pad4(h);
    if (text === roText) return;
    roText = text;
    ro.firstChild.textContent = label;
    ro.lastChild.textContent = pad4(w) + " × " + pad4(h);
  }

  function build() {
    if (revealQueued || state !== "queued") return; // the data won the race: never draw
    if (!visible) { state = "ready"; return; } // scrolled away while queued: wait for it to come back
    state = "build";
    try {
      draw();
    } catch (err) {
      // Never leave content hidden because of a drawing problem, even if the element still declares loading
      console.warn("crosshair-skeleton: could not draw, showing the content instead.", err);
      el.setAttribute("data-cs-show", "");
      finish();
    }
  }

  // Inline size: host rules like `.card svg { width: 140px }` must not resize the overlay
  const svgAttrs = (cls, w, h) => ({ class: cls, width: w, height: h, viewBox: `0 0 ${w} ${h}`, style: `width:${w}px!important;height:${h}px!important` });
  const wiresFor = (shapes, svg) => shapes.map((sh, i) => ({
    n: node(doc, "path", { d: pathOf(sh), pathLength: "1", "stroke-dasharray": "1 1" }, svg, true),
    g: sh.g,
    d: shapes.length > 1 ? i / (shapes.length - 1) : 0,
  }));

  // The overlay must not change the element's layout. As the last child it can switch off the element's
  // own :last-child rules (a list's last-row border, Tailwind's space-y), so if inserting it changes the
  // element's size, move it to the front, and keep whichever placement leaves the layout as it was.
  function place() {
    const before = el.getBoundingClientRect();
    const drift = () => { const r = el.getBoundingClientRect(); return Math.abs(r.width - before.width) + Math.abs(r.height - before.height); };
    el.appendChild(ov);
    const last = drift();
    if (last < 0.5) return;
    el.prepend(ov);
    if (drift() > last) el.appendChild(ov);
  }

  function draw() {
    W = el.clientWidth; // the overlay covers the padding box
    H = el.clientHeight;
    [BW, BH] = outerSize(el); // the readout reports the element's outer size, as DevTools does
    m = measure(el, W, H, o);
    if (W < 24 || H < 12) { state = "idle"; return; } // too small to draw; content just waits hidden
    if (win.getComputedStyle(el).position === "static") {
      prevPos = { value: el.style.getPropertyValue("position"), priority: el.style.getPropertyPriority("position") };
      el.style.setProperty("position", "relative", "important");
    }

    const s = Math.max(0.4, Math.min(1, Math.min(W, H) / 140));
    const shapes = o.trace === "none" ? [] : m.shapes;
    const showRo = o.readout === true || (o.readout === "auto" && W >= 240 && H >= 120);

    // No `hidden` attribute: Tailwind v4's base layer hides [hidden] with a layered !important that
    // would beat this stylesheet. place() handles sibling-sensitive layouts instead.
    ov = node(doc, "div", { class: "cs-ov", "aria-hidden": "true" });
    const clip = node(doc, "div", { class: "cs-clip" }, ov);
    node(doc, "div", { class: "cs-fill" }, clip);
    const gridSvg = node(doc, "svg", svgAttrs("cs-grid", W, H), clip, true);
    const grid = buildGrid(doc, gridSvg, W, H, o.cell);
    const wireSvg = node(doc, "svg", svgAttrs("cs-wire", W, H), clip, true);
    const wires = wiresFor(shapes, wireSvg);
    const chs = ["tl", "tr", "bl", "br"].map((c) => {
      const ch = node(doc, "div", { class: "cs-ch", "data-c": c, style: `scale:${s}` }, ov);
      node(doc, "i", {}, ch);
      return ch;
    });
    if (showRo) {
      // The readout sits above the element, on the parent's background, so it takes the parent's colour
      ro = node(doc, "div", { class: "cs-ro" }, ov);
      trackReadout(ro, el);
      node(doc, "b", {}, ro);
      node(doc, "span", {}, ro);
    }
    ov._wires = wires;
    place();
    shownAt = performance.now();

    if (reduced) {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      chs.forEach((ch) => (ch.style.opacity = 1));
      if (ro) { ro.style.opacity = 1; setRo("AWAIT", BW, BH); }
      state = "idle";
      return;
    }

    const tGo = t.lock + BLINKS * t.blink;
    const gridStart = tGo + t.expand * 0.5;
    const dotStart = gridStart + t.draw * 0.45;
    const dotFade = t.draw * 0.5;
    const wireStart = tGo + t.wireStart;
    const end = Math.max(tGo + t.expand, dotStart + t.stagger + dotFade, shapes.length ? wireStart + t.wireStagger + t.wireDraw : 0);
    cleanAt = tGo + t.expand; // never hand over while the corners are still travelling
    const back = (duration, delay, easing) => ({ duration, delay, easing, fill: "backwards" });

    // Lock-on: all four corners stacked at the origin, snapping in from blur, then two hard blinks
    chs.forEach((ch) => {
      const c = ch.dataset.c;
      ch.animate([{ opacity: 0, scale: 1.8 * s, filter: "blur(4px)" }, { opacity: 1, scale: s, filter: "blur(0px)" }], { duration: t.lock, easing: EASE.lock, fill: "both" });
      ch.firstChild.animate(
        [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0.08, offset: 0.5 }, { opacity: 0.08, offset: 0.999 }, { opacity: 1, offset: 1 }],
        { duration: t.blink, delay: t.lock, iterations: BLINKS }
      );
      // Measure: corners travel out on the same curve as the clip, so the edges stay glued
      ch.animate([{ translate: `${c[1] === "r" ? -W : 0}px ${c[0] === "b" ? -H : 0}px` }, { translate: "0px 0px" }], back(t.expand, tGo, EASE.expand));
    });
    clip.animate([{ clipPath: "inset(0 100% 100% 0)" }, { clipPath: "inset(0 0% 0% 0)" }], back(t.expand, tGo, EASE.expand));

    // Map: grid lines sweep in from the origin, then the intersection dots
    grid.lines.forEach((l) => l.n.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], back(t.draw, gridStart + l.delay * t.stagger, EASE.draw)));
    grid.bands.forEach((b) => b.n.animate([{ opacity: 0 }, { opacity: 1 }], back(dotFade, dotStart + b.delay * t.stagger, "ease-out")));

    // Trace: the shape of what is inside, outer box first, in document order
    wires.forEach((w) => {
      const at = wireStart + w.d * t.wireStagger;
      w.end = at + t.wireDraw;
      w.n.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], back(t.wireDraw, at, EASE.draw));
    });

    if (ro) {
      ro.animate([{ opacity: 0, translate: "0 3px" }, { opacity: 1, translate: "0 0" }], { duration: 240, delay: t.lock * 0.5, easing: "ease-out", fill: "both" });
      setRo("LOCK", 0, 0);
      later(() => setRo("MEASURE"), tGo);
      later(() => setRo("MAP"), gridStart);
      if (shapes.length) later(() => setRo("TRACE"), wireStart);
      later(() => setRo("AWAIT", BW, BH), end);
      // The counter follows the corners for the length of the expand, then the loop stops
      const count = () => {
        const p = (performance.now() - shownAt - tGo) / t.expand;
        const e = expandCurve(Math.min(1, Math.max(0, p)));
        setRo(roLabel, BW * e, BH * e);
        if (p < 1) raf = requestAnimationFrame(count);
      };
      later(() => (raf = requestAnimationFrame(count)), tGo);
    }

    // Wait: slow breathing on two layers, opacity only, so the compositor does it.
    // Phase-locked to the document clock so every skeleton on the page breathes together.
    later(() => {
      state = "idle";
      if (!o.pulse) return;
      pulses = [gridSvg, wireSvg].map((n) => {
        const a = n.animate([{ opacity: 1 }, { opacity: 0.4 }], { duration: PULSE, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
        a.startTime = Math.ceil(doc.timeline.currentTime / (2 * PULSE)) * 2 * PULSE;
        if (!visible) a.pause();
        return a;
      });
    }, end);
  }

  function reveal() {
    if (state === "reveal" || state === "done") return;
    state = "reveal";
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(raf);
    if (!ov) return finish();
    // A re-render replaced the host's children and took the overlay with it: put it back for the handover
    if (!ov.isConnected) place();

    const D = reduced ? 200 : HAND.handoff * k;
    const uiAt = reduced ? 0 : HAND.uiAt * k;
    const now = performance.now() - shownAt;
    const opt = (duration, delay = 0) => ({ duration, delay, easing: EASE.out, fill: "forwards" });
    const q = (s) => ov.querySelector(s);
    const gridEl = q(".cs-grid"), fillEl = q(".cs-fill");
    let wireEl = q(".cs-wire"), wires = ov._wires;

    // The skeleton followed the theme while waiting; freeze its colour now, before any text colour animates
    ov.style.color = win.getComputedStyle(el).color;
    // Freeze the breathing where it is, so nothing jumps; the trace snaps to full strength
    const freeze = (n) => { const v = +win.getComputedStyle(n).opacity; n.getAnimations().forEach((a) => a.cancel()); n.style.opacity = v; return v; };
    const og = freeze(gridEl);
    freeze(wireEl);
    wireEl.style.opacity = 1;
    pulses = [];

    // Lock onto the real content. It is rendered by now (still hidden), so measure it again: if it is
    // a different size, the overlay follows it, and the outlines are redrawn exactly where the real UI
    // will appear while the placeholder's trace fades out underneath.
    const NW = el.clientWidth, NH = el.clientHeight;
    if (!NW || !NH) return finish(); // hidden or collapsed just before the handover: nothing to reveal into
    if (NW !== W || NH !== H) {
      W = NW;
      H = NH;
      for (const svg of [gridEl, wireEl]) for (const [k2, v] of Object.entries(svgAttrs(svg.getAttribute("class"), W, H))) svg.setAttribute(k2, v);
      gridEl.replaceChildren();
      buildGrid(doc, gridEl, W, H, o.cell);
    }
    [BW, BH] = outerSize(el);
    if (o.trace !== "none" && !reduced) {
      m = measure(el, W, H, o);
      const fresh = node(doc, "svg", svgAttrs("cs-wire", W, H), null, true);
      wireEl.after(fresh);
      wireEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160 * k, easing: "ease-out", fill: "forwards" });
      wires = wiresFor(m.shapes, fresh);
      const retrace = 220 * k, spread = 120 * k;
      wires.forEach((w) => {
        const delay = w.d * spread;
        w.end = now + delay + retrace;
        w.n.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: retrace, delay, easing: EASE.draw, fill: "backwards" });
      });
      wireEl = fresh;
    }
    const drawLeft = (w) => Math.max(0, (w.end || 0) - now);
    const allDrawn = Math.max(0, ...wires.map(drawLeft));
    if (ro) setRo("READY", BW, BH);

    const hostKids = kids(el);
    const style = reduced ? "fade" : o.reveal;
    // Text sitting directly in the element can't take opacity, so it comes in through its colour
    // (the overlay's colour is frozen above; Chrome won't animate -webkit-text-fill-color)
    const ink = ownText(el) ? win.getComputedStyle(el).color : "";
    restoreAttrs();
    // Each child comes back to its own opacity, not to 1
    const opacityOf = new Map(hostKids.map((c) => [c, +win.getComputedStyle(c).opacity]));
    let end = 0;
    const content = (n, frames, timing) => {
      tracked.push(n.animate(frames, { fill: "both", ...timing }));
      end = Math.max(end, (timing.delay || 0) + timing.duration);
    };
    const fadeText = (duration, delay) => ink && content(el, [{ color: "transparent" }, { color: ink }], { duration, delay, easing: EASE.out });

    ov.querySelectorAll(".cs-ch").forEach((ch) => ch.animate([{ opacity: 1 }, { opacity: 0 }], opt(D * 0.6)));
    if (ro) ro.animate([{ opacity: 1 }, { opacity: 0 }], opt(D * 0.5));

    if (style === "scan") {
      // A dithered line wipes down; content and skeleton swap exactly at the line
      const S = HAND.scan * k;
      const local = frameOf(el);
      hostKids.forEach((c) => {
        const r = local(c.getBoundingClientRect());
        const y = Math.min(H, Math.max(0, r.y)), h = Math.max(1, Math.min(H - y, r.h));
        content(c, [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }], { duration: Math.max(1, (h / H) * S), delay: uiAt + (y / H) * S, easing: "linear" });
      });
      // Bare text can't be clipped apart from the overlay, so it lands once the line has passed it
      fadeText(S * 0.3, uiAt + S * 0.85);
      q(".cs-clip").animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)" }], { duration: S, delay: uiAt, easing: "linear", fill: "forwards" });
      const box = node(doc, "div", { class: "cs-scanbox" }, ov);
      const scan = node(doc, "div", { class: "cs-scan" }, box);
      const sh = 48, url = `url(${dither(doc, sh)})`;
      scan.style.webkitMaskImage = scan.style.maskImage = url;
      scan.style.webkitMaskSize = scan.style.maskSize = "8px 48px";
      scan.animate(
        [{ transform: `translateY(${-sh}px)`, opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { transform: `translateY(${H - sh}px)`, opacity: 0 }],
        { duration: S, delay: uiAt, easing: "linear", fill: "both" }
      );
      end = Math.max(end, uiAt + S);
    } else {
      // Grid and fill clear underneath while the content lands under the trace
      gridEl.animate([{ opacity: og }, { opacity: 0 }], opt(D * 0.45));
      fillEl.animate([{ opacity: 1 }, { opacity: 0 }], opt(D * 0.8));
      if (style === "blink") {
        // Shell first, then each section flickers on in order; its trace flickers off once it lands
        const B = REVEAL_BLINKS * HAND.blink * k;
        const groups = m.groups.filter((g) => g.isConnected);
        const order = groups.length ? groups : hostKids;
        const inGroups = new Set(order);
        const step = order.length > 1 ? (HAND.spread * k) / (order.length - 1) : 0;
        const target = (c) => opacityOf.get(c) ?? +win.getComputedStyle(c).opacity;
        if (ink) content(el, flicker("transparent", ink, "color"), { duration: B, delay: uiAt });
        hostKids.filter((c) => !inGroups.has(c)).forEach((c) => content(c, flicker(0, target(c)), { duration: B, delay: uiAt }));
        order.forEach((g, i) => content(g, flicker(0, target(g)), { duration: B, delay: uiAt + i * step }));
        const lastIn = (order.length - 1) * step + B;
        wires.forEach((w) => {
          const at = Math.max(uiAt + (w.g < 0 || w.g >= order.length ? lastIn : w.g * step + B), drawLeft(w));
          w.n.animate(flicker(1, 0), { duration: B, delay: at, fill: "both" });
          end = Math.max(end, at + B);
        });
      } else {
        const U = reduced ? 200 : HAND.fade * k;
        hostKids.forEach((c) => content(c, [{ opacity: 0 }, { opacity: opacityOf.get(c) }], { duration: U, delay: uiAt, easing: EASE.out }));
        fadeText(U, uiAt);
        const at = Math.max(uiAt + D * 0.3, allDrawn); // a trace box never leaves before it has finished drawing
        wireEl.animate([{ opacity: 1 }, { opacity: 0 }], opt(D * 0.7, at));
        end = Math.max(end, at + D * 0.7);
      }
    }
    // Once everything has landed: drop every animation and the overlay, leave the DOM as it was
    later(finish, Math.max(end, D) + 50);
  }

  function finish() {
    if (state === "done") return;
    state = "done";
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(raf);
    unobserve(el);
    if (live.get(el) === run) live.delete(el);
    active.delete(run);
    restoreHost();
    tracked.forEach((a) => a.cancel());
    tracked = [];
    pulses = [];
    if (ov) {
      ov.getAnimations({ subtree: true }).forEach((a) => a.cancel());
      ov.remove();
    }
    if (ro) untrackReadout(ro, el);
    ov = ro = null;
    resolve();
  }

  const run = {
    finished,
    /** The data is in and rendered: hand over (waits for a clean point if the skeleton is mid-build). */
    done() {
      if (state === "done" || revealQueued) return finished;
      revealQueued = true;
      // Always on a later tick: frameworks may call done() just before they write the new content
      if (!ov) later(finish, 0); // never drawn: a quick load, so no skeleton at all
      else later(reveal, Math.max(0, shownAt + Math.max(o.minVisible, cleanAt) - performance.now()));
      return finished;
    },
    /** Stop at once and show the content as it is, no animation. (An element that still has
     *  data-crosshair="loading" stays hidden: the declared state wins until it changes.) */
    cancel() { finish(); },
    /** @internal true once done() or cancel() has been called */
    get ending() { return revealQueued || state === "done"; },
  };
  run.el = el;
  live.set(el, run);
  active.add(run);
  return run;
}

/**
 * Declarative use: any element with data-crosshair="loading" gets a skeleton;
 * changing the attribute to anything else (or removing it) reveals the content.
 * Options: data-crosshair-reveal, data-crosshair-trace, data-crosshair-speed.
 * Pass a shadow root to watch inside a web component.
 * @returns {() => void} stop watching (and stop the skeletons this watcher started)
 */
export function watch(root = NS_READY ? document : null) {
  if (!root) return () => {};
  const mine = new Set();
  const handle = (el) => {
    const v = el.getAttribute("data-crosshair");
    const current = live.get(el);
    if (v === "loading") {
      // Loading again while the previous run is still handing over: start a fresh one
      if (current && !current.ending) return;
      const d = el.dataset;
      const run = crosshair(el, {
        ...(d.crosshairReveal && { reveal: d.crosshairReveal }),
        ...(d.crosshairTrace && { trace: d.crosshairTrace }),
        ...(d.crosshairSpeed && { speed: +d.crosshairSpeed }),
      });
      mine.add(run);
      run.finished.then(() => mine.delete(run)); // owned until it has really finished, handover included
    } else {
      current?.done();
    }
  };
  root.querySelectorAll("[data-crosshair]").forEach(handle);
  const mo = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "attributes") handle(r.target);
      else r.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.hasAttribute("data-crosshair")) handle(n);
        n.querySelectorAll("[data-crosshair]").forEach(handle);
      });
    }
    // An element removed while loading: stop its skeleton
    active.forEach((run) => { if (!run.el.isConnected) run.cancel(); });
  });
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-crosshair"] });
  return () => {
    mo.disconnect();
    mine.forEach((run) => run.cancel());
    mine.clear();
  };
}
