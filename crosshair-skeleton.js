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

const EASE = {
  lock: "cubic-bezier(0.16, 1, 0.3, 1)",
  expand: "cubic-bezier(0.85, 0, 0.15, 1)",
  draw: "cubic-bezier(0.65, 0, 0.35, 1)",
  out: "cubic-bezier(0.25, 1, 0.5, 1)",
};

const mix = (pct) => `color-mix(in srgb, currentColor ${pct}%, transparent)`;
const CSS = `
[data-crosshair="loading"]>:not(.cs-ov),[data-cs-hide]>:not(.cs-ov){opacity:0}
[data-cs-hide]{-webkit-text-fill-color:transparent}
.cs-ov{position:absolute;inset:0;z-index:10;pointer-events:none;-webkit-text-fill-color:currentColor;contain:layout style}
.cs-ov .cs-clip,.cs-ov .cs-scanbox{position:absolute;inset:0;overflow:hidden;border-radius:inherit}
.cs-ov .cs-fill{position:absolute;inset:0;background:var(--cs-fill,${mix(7)})}
.cs-ov svg{position:absolute;left:0;top:0;overflow:visible}
.cs-ov .cs-grid,.cs-ov .cs-wire{will-change:opacity}
.cs-ov .cs-grid path{fill:none;stroke:var(--cs-line,${mix(5)});stroke-width:1}
.cs-ov .cs-grid circle{fill:var(--cs-dot,${mix(16)})}
.cs-ov .cs-wire path{fill:none;stroke:var(--cs-wire,${mix(24)});stroke-width:1}
.cs-ov .cs-ch{position:absolute;left:0;top:0;width:56px;height:56px;margin:-28px 0 0 -28px;opacity:0}
.cs-ov .cs-ch[data-c=tr]{left:100%}.cs-ov .cs-ch[data-c=bl]{top:100%}.cs-ov .cs-ch[data-c=br]{left:100%;top:100%}
.cs-ov .cs-ch>i{position:absolute;inset:0;margin:0;padding:0;border:0;--m:var(--cs-mark,${mix(24)});--a:var(--cs-arm,${mix(12)});background:
linear-gradient(var(--m),var(--m)) 23px 27px/10px 2px no-repeat,
linear-gradient(var(--m),var(--m)) 27px 23px/2px 10px no-repeat,
linear-gradient(90deg,transparent,var(--a)) 0 27.5px/23px 1px no-repeat,
linear-gradient(270deg,transparent,var(--a)) 33px 27.5px/23px 1px no-repeat,
linear-gradient(180deg,transparent,var(--a)) 27.5px 0/1px 23px no-repeat,
linear-gradient(0deg,transparent,var(--a)) 27.5px 33px/1px 23px no-repeat}
.cs-ov .cs-ro{position:absolute;left:18px;top:-22px;font:500 10px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em;white-space:nowrap;font-variant-numeric:tabular-nums;opacity:0}
.cs-ov .cs-ro b{font-weight:500;margin-right:10px}.cs-ov .cs-ro span{opacity:.55}
.cs-ov .cs-scan{position:absolute;left:0;right:0;top:0;height:48px;background:var(--cs-scan,${mix(30)});opacity:0;will-change:transform,opacity;-webkit-mask-repeat:repeat-x;mask-repeat:repeat-x}
`;

let styled = false;
function injectStyles() {
  if (styled) return;
  styled = true;
  try {
    // Constructable sheet: no <style> tag, works under most CSPs
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch {
    const tag = document.createElement("style");
    tag.setAttribute("data-crosshair-skeleton", "");
    tag.textContent = CSS;
    document.head.appendChild(tag);
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
function dither(height) {
  if (ditherUrl) return ditherUrl;
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const px = 2, cols = 4, rows = height / px;
  const cv = document.createElement("canvas");
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

// ---------- Reading the shape ----------
const SKIP = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "BR", "WBR", "LINK", "META"]);
const MEDIA = new Set(["IMG", "VIDEO", "IFRAME", "PICTURE", "OBJECT", "EMBED"]);
const CONTROL = new Set(["BUTTON", "INPUT", "SELECT", "TEXTAREA", "PROGRESS", "METER"]);
const NO_CHILDREN = /^(IMG|VIDEO|AUDIO|CANVAS|SVG|INPUT|TEXTAREA|SELECT|IFRAME|PICTURE|EMBED|OBJECT|BR|HR)$/;
const kids = (n) => [...n.children].filter((c) => !c.classList.contains("cs-ov") && !SKIP.has(c.tagName));
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

// The element the sections live in: skip single-child wrappers (a card inside a slot, etc.)
function contentRoot(el) {
  let root = el;
  for (let k = kids(root); k.length === 1; k = kids(root)) {
    const r = k[0].getBoundingClientRect();
    if (leafKind(k[0], r.width, r.height)) break;
    root = k[0];
  }
  return root;
}

function measure(el, W, H, o) {
  const shapes = [];
  const r0 = el.getBoundingClientRect();
  const ox = r0.left + el.clientLeft, oy = r0.top + el.clientTop;
  const cs = getComputedStyle(el);
  const pad = (side) => parseFloat(cs["padding" + side]) || 0;
  const add = (s) => { if (shapes.length < MAX_SHAPES && s.w >= 2 && s.h >= 2) shapes.push(s); };
  add({ kind: "box", x: pad("Left"), y: pad("Top"), w: W - pad("Left") - pad("Right"), h: H - pad("Top") - pad("Bottom"), g: -1 });
  const root = contentRoot(el);
  const groups = kids(root);
  if (o.trace !== "auto") return { shapes, root, groups };

  const textLines = (n, g) => {
    const range = document.createRange();
    range.selectNodeContents(n);
    const rects = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1).sort((a, b) => a.top - b.top || a.left - b.left);
    const lines = [];
    for (const r of rects) {
      const L = lines[lines.length - 1];
      if (L && Math.min(L.b, r.bottom) - Math.max(L.t, r.top) > 0.5 * Math.min(L.b - L.t, r.height)) {
        L.l = Math.min(L.l, r.left); L.r = Math.max(L.r, r.right); L.t = Math.min(L.t, r.top); L.b = Math.max(L.b, r.bottom);
      } else if (lines.length < 8) lines.push({ l: r.left, r: r.right, t: r.top, b: r.bottom });
    }
    const bars = lines.map((L) => {
      const h = L.b - L.t, bh = Math.max(3, Math.round(h * 0.5));
      return { x: L.l - ox, y: L.t - oy + (h - bh) / 2, w: L.r - L.l, h: bh };
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
    if (n.checkVisibility && !n.checkVisibility({ visibilityProperty: true })) return;
    const r = n.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) {
      if (getComputedStyle(n).display === "contents") kids(n).forEach((c) => walk(c, level, g, parent));
      return;
    }
    const x = r.left - ox, y = r.top - oy, w = r.width, h = r.height;
    if (x >= W || y >= H || x + w <= 0 || y + h <= 0) return;
    const kind = part || leafKind(n, w, h);
    if (kind === "text") {
      // Text with its own surface (a pill, a chat bubble, a tag) keeps its outline too
      if (level <= o.depth && hasSurface(n)) add({ kind: "box", x, y, w, h, g });
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
function gridMarkup(W, H, cell) {
  cell = Math.max(cell, (W + H) / 48);
  const axis = (len) => {
    const n = Math.max(1, Math.round(len / cell)), out = [];
    for (let i = 1; i < n; i++) out.push(Math.round((i * len) / n) + 0.5);
    return out;
  };
  const xs = axis(W), ys = axis(H);
  const lines = [], delays = [];
  xs.forEach((x) => { lines.push(`<path d="M${x} 0V${H}" pathLength="1" stroke-dasharray="1 1"/>`); delays.push(x / W); });
  ys.forEach((y) => { lines.push(`<path d="M0 ${y}H${W}" pathLength="1" stroke-dasharray="1 1"/>`); delays.push(y / H); });
  // Dots fade in as 12 diagonal bands: 12 animations, not one per dot
  const BANDS = 12, bands = Array.from({ length: BANDS }, () => []);
  if (xs.length * ys.length <= 900) {
    xs.forEach((x) => ys.forEach((y) => bands[Math.min(BANDS - 1, Math.floor(((x + y) / (W + H)) * BANDS))].push(`<circle cx="${x}" cy="${y}" r="1.15"/>`)));
  }
  const dots = bands.map((b, i) => (b.length ? `<g data-d="${i / (BANDS - 1)}">${b.join("")}</g>` : "")).join("");
  return { markup: lines.join("") + dots, delays };
}

// Hard-cut flicker, no tweening between states: from → to → from → … → to
function flicker(from, to, prop = "opacity", n = REVEAL_BLINKS) {
  const frames = [];
  for (let k = 0; k < n * 2; k++) frames.push({ [prop]: k % 2 ? to : from, offset: k / (n * 2), easing: "steps(1, end)" });
  frames.push({ [prop]: to, offset: 1 });
  return frames;
}

// Skeletons that start together are spaced out a little, so a page of them cascades in
// instead of every build drawing its first frames at the same moment
const SLOT = 60, MAX_QUEUE = 480;
let nextSlot = 0;
function buildSlot() {
  const now = performance.now();
  const at = Math.max(now, Math.min(nextSlot, now + MAX_QUEUE));
  nextSlot = at + SLOT;
  return at - now;
}

const pad4 = (n) => String(Math.max(0, Math.round(n))).padStart(4, "0");
const live = new WeakMap();
const active = new Set();

/**
 * Start a crosshair skeleton on an element.
 * @param {HTMLElement} el  The element that is loading. Give it its final size.
 * @param {Partial<typeof DEFAULTS>} [options]
 * @returns {{ done(): Promise<void>, cancel(): void, finished: Promise<void> }}
 */
export function crosshair(el, options = {}) {
  if (!NS_READY || !el) {
    const p = Promise.resolve();
    return { done: () => p, cancel() {}, finished: p };
  }
  if (NO_CHILDREN.test(el.tagName.toUpperCase())) {
    // The overlay lives inside the element, so it needs one that can hold children
    console.warn("crosshair-skeleton: wrap <" + el.tagName.toLowerCase() + "> in a container and pass the container.");
    const p = Promise.resolve();
    return { done: () => p, cancel() {}, finished: p };
  }
  live.get(el)?.cancel();
  injectStyles();

  const o = { ...DEFAULTS, ...options };
  const k = o.speed > 0 ? 1 / o.speed : 1;
  const t = Object.fromEntries(Object.entries(BUILD).map(([n, v]) => [n, v * k]));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = "wait"; // wait → ready → build → idle → reveal → done
  let visible = false, ov = null, shownAt = 0, cleanAt = 0, raf = 0, revealQueued = false;
  let m = null, W = 0, H = 0, pulses = [], tracked = [], restorePos = null;
  let roLabel = "", roW = 0, roH = 0, roText = "";
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  let resolve;
  const finished = new Promise((r) => (resolve = r));

  el.setAttribute("data-cs-hide", "");
  el.setAttribute("aria-busy", "true");
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
    const ro = ov?.querySelector(".cs-ro");
    if (!ro) return;
    roLabel = label; roW = w; roH = h;
    const text = `<b>${label}</b><span>${pad4(w)} × ${pad4(h)}</span>`;
    if (text !== roText) ro.innerHTML = roText = text;
  }

  function build() {
    state = "build";
    W = el.clientWidth;
    H = el.clientHeight;
    m = measure(el, W, H, o);
    if (W < 24 || H < 12) { state = "idle"; return; } // too small to draw; content just waits hidden
    if (getComputedStyle(el).position === "static") { restorePos = el.style.position; el.style.position = "relative"; }

    const s = Math.max(0.4, Math.min(1, Math.min(W, H) / 140));
    const grid = gridMarkup(W, H, o.cell);
    const shapes = o.trace === "none" ? [] : m.shapes;
    const showRo = o.readout === true || (o.readout === "auto" && W >= 240 && H >= 120);
    // Inline size: host rules like `.card svg { width: 140px }` must not resize the overlay
    const svg = (cls, inner) =>
      `<svg class="${cls}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="width:${W}px;height:${H}px;max-width:none;max-height:none">${inner}</svg>`;
    const wire = shapes.map((sh, i) => `<path d="${pathOf(sh)}" pathLength="1" stroke-dasharray="1 1" data-g="${sh.g}" data-d="${shapes.length > 1 ? i / (shapes.length - 1) : 0}"/>`).join("");

    ov = document.createElement("div");
    ov.className = "cs-ov";
    ov.setAttribute("aria-hidden", "true");
    ov.style.color = getComputedStyle(el).color;
    ov.innerHTML =
      `<div class="cs-clip"><div class="cs-fill"></div>${svg("cs-grid", grid.markup)}${svg("cs-wire", wire)}</div>` +
      ["tl", "tr", "bl", "br"].map((c) => `<div class="cs-ch" data-c="${c}" style="scale:${s}"><i></i></div>`).join("") +
      // The readout sits above the element, on the parent's background, so it takes the parent's colour
      (showRo ? `<div class="cs-ro" style="color:${getComputedStyle(el.parentElement || el).color}"></div>` : "");
    el.appendChild(ov);
    shownAt = performance.now();
    const chs = [...ov.querySelectorAll(".cs-ch")];

    if (reduced) {
      ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      chs.forEach((ch) => (ch.style.opacity = 1));
      if (showRo) { ov.querySelector(".cs-ro").style.opacity = 1; setRo("AWAIT", W, H); }
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
      ch.firstElementChild.animate(
        [{ opacity: 1 }, { opacity: 1, offset: 0.5 }, { opacity: 0.08, offset: 0.5 }, { opacity: 0.08, offset: 0.999 }, { opacity: 1, offset: 1 }],
        { duration: t.blink, delay: t.lock, iterations: BLINKS }
      );
      // Measure: corners travel out on the same curve as the clip, so the edges stay glued
      ch.animate([{ translate: `${c[1] === "r" ? -W : 0}px ${c[0] === "b" ? -H : 0}px` }, { translate: "0px 0px" }], back(t.expand, tGo, EASE.expand));
    });
    ov.querySelector(".cs-clip").animate([{ clipPath: "inset(0 100% 100% 0)" }, { clipPath: "inset(0 0% 0% 0)" }], back(t.expand, tGo, EASE.expand));

    // Map: grid lines sweep in from the origin, then the intersection dots
    ov.querySelectorAll(".cs-grid > path").forEach((p, i) => {
      p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], back(t.draw, gridStart + grid.delays[i] * t.stagger, EASE.draw));
    });
    ov.querySelectorAll(".cs-grid > g").forEach((g) => {
      g.animate([{ opacity: 0 }, { opacity: 1 }], back(dotFade, dotStart + +g.dataset.d * t.stagger, "ease-out"));
    });

    // Trace: the shape of what is inside, outer box first, in document order
    ov.querySelectorAll(".cs-wire > path").forEach((p) => {
      const at = wireStart + +p.dataset.d * t.wireStagger;
      p.dataset.end = at + t.wireDraw;
      p.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], back(t.wireDraw, at, EASE.draw));
    });

    if (showRo) {
      const ro = ov.querySelector(".cs-ro");
      ro.animate([{ opacity: 0, translate: "0 3px" }, { opacity: 1, translate: "0 0" }], { duration: 240, delay: t.lock * 0.5, easing: "ease-out", fill: "both" });
      setRo("LOCK", 0, 0);
      later(() => setRo("MEASURE"), tGo);
      later(() => setRo("MAP"), gridStart);
      if (shapes.length) later(() => setRo("TRACE"), wireStart);
      later(() => setRo("AWAIT", W, H), end);
      // The counter follows the corners for the length of the expand, then the loop stops
      const count = () => {
        const p = (performance.now() - shownAt - tGo) / t.expand;
        const e = expandCurve(Math.min(1, Math.max(0, p)));
        setRo(roLabel, W * e, H * e);
        if (p < 1) raf = requestAnimationFrame(count);
      };
      later(() => (raf = requestAnimationFrame(count)), tGo);
    }

    // Wait: slow breathing on two layers, opacity only, so the compositor does it.
    // Phase-locked to the document clock so every skeleton on the page breathes together.
    later(() => {
      state = "idle";
      if (!o.pulse) return;
      pulses = [ov.querySelector(".cs-grid"), ov.querySelector(".cs-wire")].map((n) => {
        const a = n.animate([{ opacity: 1 }, { opacity: 0.4 }], { duration: PULSE, iterations: Infinity, direction: "alternate", easing: "ease-in-out" });
        a.startTime = Math.ceil(document.timeline.currentTime / (2 * PULSE)) * 2 * PULSE;
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
    if (!ov) return finish(true);

    const D = reduced ? 200 : HAND.handoff * k;
    const uiAt = reduced ? 0 : HAND.uiAt * k;
    const now = performance.now() - shownAt;
    const opt = (duration, delay = 0) => ({ duration, delay, easing: EASE.out, fill: "forwards" });
    const q = (s) => ov.querySelector(s);
    const gridEl = q(".cs-grid"), wireEl = q(".cs-wire"), fillEl = q(".cs-fill"), ro = q(".cs-ro");
    const paths = [...ov.querySelectorAll(".cs-wire > path")];
    const drawLeft = (p) => Math.max(0, (+p.dataset.end || 0) - now);
    const allDrawn = Math.max(0, ...paths.map(drawLeft));
    if (ro) setRo("READY", W, H);

    // Freeze the breathing where it is, so nothing jumps; the trace snaps to full strength
    const freeze = (n) => { const v = +getComputedStyle(n).opacity; n.getAnimations().forEach((a) => a.cancel()); n.style.opacity = v; return v; };
    const og = freeze(gridEl);
    freeze(wireEl);
    wireEl.style.opacity = 1;
    pulses = [];

    const hostKids = kids(el);
    const style = reduced ? "fade" : o.reveal;
    // Text sitting directly in the element can't take opacity, so it comes in through its colour
    // (the overlay sets its own colour, so it is unaffected; Chrome won't animate -webkit-text-fill-color)
    const ink = ownText(el) ? getComputedStyle(el).color : "";
    el.removeAttribute("data-cs-hide");
    el.removeAttribute("aria-busy");
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
      const top = el.getBoundingClientRect().top + el.clientTop;
      hostKids.forEach((c) => {
        const r = c.getBoundingClientRect();
        const y = Math.min(H, Math.max(0, r.top - top)), h = Math.max(1, Math.min(H - y, r.height));
        content(c, [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }], { duration: Math.max(1, (h / H) * S), delay: uiAt + (y / H) * S, easing: "linear" });
      });
      // Bare text can't be clipped apart from the overlay, so it lands once the line has passed it
      fadeText(S * 0.3, uiAt + S * 0.85);
      q(".cs-clip").animate([{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)" }], { duration: S, delay: uiAt, easing: "linear", fill: "forwards" });
      const box = document.createElement("div");
      box.className = "cs-scanbox";
      box.innerHTML = `<div class="cs-scan"></div>`;
      ov.appendChild(box);
      const scan = box.firstElementChild, sh = 48, url = `url(${dither(sh)})`;
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
        const groups = m.groups.length ? m.groups : hostKids;
        const inGroups = new Set(groups);
        const step = groups.length > 1 ? (HAND.spread * k) / (groups.length - 1) : 0;
        if (ink) content(el, flicker("transparent", ink, "color"), { duration: B, delay: uiAt });
        hostKids.filter((c) => !inGroups.has(c)).forEach((c) => content(c, flicker(0, 1), { duration: B, delay: uiAt }));
        groups.forEach((g, i) => content(g, flicker(0, 1), { duration: B, delay: uiAt + i * step }));
        const lastIn = (groups.length - 1) * step + B;
        paths.forEach((p) => {
          const g = +p.dataset.g;
          const at = Math.max(uiAt + (g < 0 || g >= groups.length ? lastIn : g * step + B), drawLeft(p));
          p.animate(flicker(1, 0), { duration: B, delay: at, fill: "both" });
          end = Math.max(end, at + B);
        });
      } else {
        const U = reduced ? 200 : HAND.fade * k;
        hostKids.forEach((c) => content(c, [{ opacity: 0 }, { opacity: 1 }], { duration: U, delay: uiAt, easing: EASE.out }));
        fadeText(U, uiAt);
        const at = Math.max(uiAt + D * 0.3, allDrawn); // a trace box never leaves before it has finished drawing
        wireEl.animate([{ opacity: 1 }, { opacity: 0 }], opt(D * 0.7, at));
        end = Math.max(end, at + D * 0.7);
      }
    }
    // Once everything has landed: drop every animation and the overlay, leave the DOM as it was
    later(() => finish(false), Math.max(end, D) + 50);
  }

  function finish(quick) {
    if (state === "done") return;
    state = "done";
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(raf);
    unobserve(el);
    live.delete(el);
    active.delete(el);
    el.removeAttribute("data-cs-hide");
    el.removeAttribute("aria-busy");
    if (restorePos !== null) el.style.position = restorePos;
    tracked.forEach((a) => a.cancel());
    tracked = [];
    pulses = [];
    ov?.remove();
    ov = null;
    if (quick && !reduced) kids(el).forEach((c) => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" }));
    resolve();
  }

  const run = {
    finished,
    /** The data is in and rendered: hand over (waits for a clean point if the skeleton is mid-build). */
    done() {
      if (state === "done" || revealQueued) return finished;
      revealQueued = true;
      if (!ov) {
        finish(true); // never drawn: a quick load, so no skeleton at all
      } else {
        const wait = Math.max(0, shownAt + Math.max(o.minVisible, cleanAt) - performance.now());
        if (wait) later(reveal, wait); else reveal();
      }
      return finished;
    },
    /** Stop at once and show the content as it is, no animation. */
    cancel() { finish(false); },
  };
  live.set(el, run);
  active.add(el);
  return run;
}

/**
 * Declarative use: any element with data-crosshair="loading" gets a skeleton;
 * changing the attribute to anything else (or removing it) reveals the content.
 * Options: data-crosshair-reveal, data-crosshair-trace, data-crosshair-speed.
 * @returns {() => void} stop watching
 */
export function watch(root = NS_READY ? document : null) {
  if (!root) return () => {};
  const handle = (el) => {
    const v = el.getAttribute("data-crosshair");
    if (v === "loading") {
      if (live.has(el)) return;
      const d = el.dataset;
      crosshair(el, {
        ...(d.crosshairReveal && { reveal: d.crosshairReveal }),
        ...(d.crosshairTrace && { trace: d.crosshairTrace }),
        ...(d.crosshairSpeed && { speed: +d.crosshairSpeed }),
      });
    } else {
      live.get(el)?.done();
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
    active.forEach((el) => { if (!el.isConnected) live.get(el)?.cancel(); });
  });
  mo.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-crosshair"] });
  return () => mo.disconnect();
}
