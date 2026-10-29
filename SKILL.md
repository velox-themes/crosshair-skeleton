---
name: crosshair-skeleton
description: A loading skeleton for any element (cards, charts, graphs, text, headlines, images, lists, tables, forms) that locks on with crosshair corners, measures the element, maps a grid over it, traces the shape of what is inside (text lines, image boxes, chart areas, buttons), breathes while it waits, then hands over to the real content with a fade, blink or scan reveal. One dependency-free ES module (about 13 KB gzipped, comments included) with tested adapters for React/Next.js/Preact, Vue/Nuxt and Svelte/SvelteKit, plus patterns for Solid, Angular, Lit, Astro, Alpine and htmx, follows light and dark themes automatically, and is built to be cheap on CPU. Use when the user asks for a "loading skeleton", "skeleton loader", "loading state", "placeholder while data loads", "crosshair loader", "blueprint/wireframe loading", "replace the shimmer", "make loading look technical", or wants a nicer loading state for a card, chart, list or page section. Not for button or inline spinners, progress bars, background refreshes of content already on screen, streaming text, or anything the server can render directly.
license: MIT (see LICENSE)
---

# Crosshair Skeleton

A loading state that looks like the interface is being measured and mapped while the data is on its way:

1. **Lock** – four crosshair corners snap in at the top-left and blink twice.
2. **Measure** – the corners travel out to the element's real corners; a readout counts the size up.
3. **Map** – a fine grid sweeps in from the origin, then its intersection dots.
4. **Trace** – the shape of what is inside is outlined: section boxes, every line of text, images (box with a cross), charts (box with guides), buttons and inputs.
5. **Wait** – the grid and trace breathe slowly for as long as the data takes.
6. **Reveal** – when the data is in, the real content arrives under the trace (`fade`, `blink` per section, or a dithered `scan` line) and the skeleton removes itself completely.

Loads faster than 150 ms never show a skeleton. Once shown, it stays at least 600 ms and never hands over mid-move, so it never flashes.

**Integrating into a real project? Read [AGENT-GUIDE.md](./AGENT-GUIDE.md) first.** It has the step-by-step procedure, a worked example, the pitfalls seen when this was applied to production UI, and the browser verification checklist (with a console snippet).

## When to use it, and when not

Decide this first. A skeleton is the right tool only when all of these are true:

1. **The content arrives asynchronously** after the page is on screen (client fetch, lazy section, slow CMS or API call).
2. **The wait is noticeable**: often 300 ms or more. Under 150 ms nothing is drawn anyway; for waits that are always that fast, add nothing.
3. **The layout is known before the data**: you can render the real component with placeholder data at roughly its final size.
4. **The area is big enough to read**: about 80 × 40 px or more (a card, panel, chart, list, table, article, hero).

**Use it for:**

| Situation | How |
|---|---|
| A card, chart, table, list or panel filled by its own request | One skeleton on that block |
| A detail page (product, template, profile, article) filled by one request | One skeleton over the page content, inside the page padding |
| A dashboard whose widgets load separately | One skeleton per widget; they cascade in and breathe in sync |
| A grid of cards from one request | One skeleton on the grid; if each card loads separately, one per card is fine (20+ is fine) |
| Lazy sections below the fold | One per section; they don't build until scrolled into view |
| A hero or section waiting on CMS data | One skeleton, `reveal: "scan"` suits images and heroes |

**Don't use it for (use this instead):**

| Situation | Instead |
|---|---|
| Buttons while submitting, inline "Saving…", form validation, icons, anything under about 80 × 40 px | A spinner, a disabled state or inline text |
| Uploads, exports, installs: progress with a known percentage | A progress bar |
| Refreshing data that is already on screen (background refetch, stale-while-revalidate, polling) | Keep the content visible; a subtle "Updating" hint at most. Never hide content people are reading |
| Optimistic updates | Show the optimistic result |
| Streaming output (AI chat, logs) | Stream the text as it arrives |
| Results whose shape is unknown until they arrive (search results with an unknown count, an infinite feed's next page) | A skeleton on the container with a fixed `min-height` and `trace: "box"`, or a simple indicator for the next page |
| Each row of a table or each item of a list separately | One skeleton on the whole table or list |
| The app shell, navigation or a full-page route transition | Route-level loading of the content area only |
| Content the server can render directly (SSR, static generation) | Render it on the server: no skeleton beats a fast first paint |
| Error and empty states | A real error or empty state (drive the skeleton by request status, so errors reveal) |

**Design fit.** The look is precise and technical (crosshairs, grid, wireframe). It suits product, data, developer, design-tool and agency interfaces. On a soft or playful brand, check with the user before applying it everywhere; `pulse: false` and `readout: false` tone it down.

**Many at once** is fine (a grid of 20 cards): skeletons that start together cascade in, every one breathes in sync, off-screen ones are not built until they scroll in, and the wait runs on the compositor.

## How it knows the shape

While loading, the real content usually isn't there yet. The runtime traces **whatever is inside the element at the moment loading starts**:

| What is inside | What gets traced |
|---|---|
| The real component rendered with placeholder data (recommended) | Its exact structure: sections, text lines, images, charts, buttons. Same layout as the result, so nothing jumps. |
| Placeholder markup of your own (fixed-size blocks, empty rows) | Those blocks. |
| Nothing (an empty container with a reserved size) | The outer box, grid and corners only. |

**At the handover it traces again.** When `done()` runs, your real content is already rendered (still hidden), so the skeleton measures it once more, resizes the overlay if the size changed, and redraws the outlines exactly onto the real layout in about a quarter of a second while the placeholder's outlines fade out. The reveal therefore always lands on the real UI. While waiting it can only trace the placeholder, so the closer the placeholder is to the real data, the steadier it looks (see [AGENT-GUIDE.md](./AGENT-GUIDE.md#pitfalls-seen-in-real-integrations)).

The readout reports the element's outer size (border box), rounded the way DevTools shows it. The overlay never changes the element's layout: if being the last child would switch off a `:last-child` rule (a list's last border, Tailwind `space-y`), it moves itself to the front.

Rules the tracer follows:

- Elements with their own text become **text lines** (one bar per rendered line, at the real width).
- `img`, `video`, `iframe`, `picture`, `[role=img]` become a **box with a cross**.
- `svg` and `canvas` of 80×48 px or more become a **chart** (box with two guides); smaller ones (icons) a box.
- `button`, `input`, `select`, `textarea`, `[role=button]` become a **box**.
- Other elements become structural boxes down to `depth` levels (1 outer box, 2 sections, 3 their children), skipping wrappers that only repeat their parent's box.
- Capped at 90 shapes and 600 visited elements, however large the element. Shapes are traced in document order; past the cap the rest of the element still gets the fill and grid, just no outlines. On a very large element (a whole page of cards), set `depth: 2` or mark dense regions `data-crosshair-part="box"` so the outline budget covers the whole page.

**Making placeholder data.** Give it the same shape as the real data, with text of similar length. For images, use a 1×1 transparent data URI so the image's CSS box (`aspect-ratio`, width/height) keeps its size: `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`. Keep keys unique in placeholder lists (`${BLANK}#1`, `#2`…). The placeholder is hidden and `inert` while loading, so its text never shows or gets read out.

Hints, when the automatic reading is not what you want:

```html
<div data-crosshair-part="skip">…</div>   <!-- not traced (decorations, sticky toolbars) -->
<div data-crosshair-part="box">…</div>    <!-- one box, don't look inside -->
<div data-crosshair-part="chart">…</div>  <!-- box with guides (a custom chart made of divs) -->
<div data-crosshair-part="media">…</div>  <!-- box with a cross -->
```

## Install

Prefer the package when the project uses npm: `npm install crosshair-skeleton`, then `import { crosshair, watch } from "crosshair-skeleton"` (TypeScript types included). Otherwise copy [`crosshair-skeleton.js`](./crosshair-skeleton.js) into the project (for example `src/lib/` or `public/vendor/`) and import it by path. Either way that is the whole install: no dependencies, no CSS file, no fonts, no images. Its styles are injected once as a constructable stylesheet (falls back to one `<style>` tag).

Do not rewrite the runtime or retune its timings one by one: the lock, expand, grid, trace and reveal timings are one rhythm. Use the `speed` option instead.

## Wiring

Rules for every framework:

1. Start it **when loading starts**, on the element that will hold the content, while that element already has its final size (placeholder data, a fixed height, `min-height` or `aspect-ratio`). A collapsed element has nothing to draw.
2. Call `done()` **after the real content is rendered**. It waits for a clean point, reveals, removes itself and resolves its promise.
3. Call `cancel()` when the component unmounts mid-load.
4. Render the real content **into** the element's children, not by replacing the element's own `innerHTML`/`textContent` (the overlay lives inside it). For server fragments (htmx, Turbo, Livewire), put the skeleton on a wrapper and swap an inner element.
5. The element must be able to hold children: wrap a bare `<img>`, `<canvas>` or `<video>` in a container and pass the container.
6. Don't wait for `document.fonts.ready` before starting: the skeleton has no web fonts, and waiting delays the first frame.

**Vanilla**

```js
import { crosshair } from "crosshair-skeleton"; // with a bundler; plain HTML: "./crosshair-skeleton.js"

const card = document.querySelector("#revenue");
const skeleton = crosshair(card);          // loading starts
const data = await fetch("/api/revenue").then((r) => r.json());
renderRevenue(card, data);                 // real content in place (still hidden)
await skeleton.done();                     // revealed, overlay removed
```

**Attribute API** (simplest for any framework or server-rendered HTML)

```html
<section data-crosshair="loading" data-crosshair-reveal="blink">…</section>
<script type="module">
  import { watch } from "./crosshair-skeleton.js"; // the copied file (bare names need a bundler or an import map)
  watch(); // once per page: "loading" starts a skeleton, any other value (or removing it) reveals
</script>
```

For server-rendered placeholder content (SSR, including React/Next.js, Nuxt and SvelteKit with the adapters), the HTML can paint before JavaScript runs. To keep it from flashing, render the marker on the same element, `data-crosshair={isLoading ? "loading" : "done"}` (or the attribute API), and add one line to the global CSS. Pages rendered only in the browser don't need it: the adapters and `crosshair()` start before the first paint.

```css
[data-crosshair="loading"] > :not(.cs-ov) { opacity: 0; }
```

Pick the line for the project's stack. Every one of these is tested against the real framework (load, reveal with real data, reload, unmount mid-load, no console errors), and the React and Vue adapters also server-render cleanly.

| Stack | Use |
|---|---|
| React, Next.js, Remix, Preact (`preact/compat`) | `useCrosshair` from `crosshair-skeleton/react` |
| Vue 3, Nuxt | `v-crosshair` from `crosshair-skeleton/vue` |
| Svelte 5, SvelteKit | `use:skeleton` from `crosshair-skeleton/svelte` |
| Solid, Angular, Lit and other web components | the core `crosshair()` in the framework's effect or lifecycle hook |
| Astro, plain HTML, Alpine, htmx, Rails, Laravel, Django | the attribute API, or `crosshair()` in a script |

**React / Next.js / Preact**

```jsx
"use client";
import { useCrosshair } from "crosshair-skeleton/react";

export function RevenueCard({ data }) {
  const ref = useCrosshair(!data, { reveal: "fade" }); // better: useCrosshair(status === "loading"), see below
  return <div ref={ref} className="card">{data ? <Revenue data={data} /> : <Revenue placeholder />}</div>;
}
```

Pass a loading flag rather than `!data` when the request can fail: with `useCrosshair(status === "loading")` an error reveals your error state instead of breathing forever. Options are read when a run starts, so an inline options object is fine. For a host element other than a div, pass its type: `useCrosshair<HTMLElement>(…)`.

Server rendering is safe: the hook does nothing on the server. It returns a callback ref and follows the element itself, so Strict Mode, a target that mounts later and a replaced (re-keyed) element are all handled.

**Vue / Nuxt**

```js
// main.js (or a Nuxt plugin: nuxtApp.vueApp.use(CrosshairSkeleton))
import CrosshairSkeleton from "crosshair-skeleton/vue";
app.use(CrosshairSkeleton);
```

```html
<div class="card" v-crosshair="!data">…</div>
<div class="card" v-crosshair="{ loading: !data, reveal: 'blink' }">…</div>
```

Or import `{ vCrosshair }` locally in `<script setup>`.

**Svelte / SvelteKit**

```svelte
<script>
  import { skeleton } from "crosshair-skeleton/svelte";
  let { data } = $props();
</script>

<div class="card" use:skeleton={!data}>…</div>
```

**Solid**

```js
import { createEffect, on, onCleanup } from "solid-js";
import { crosshair } from "crosshair-skeleton";

function Card(props) {
  let el, run;
  createEffect(on(() => !props.data, (loading) => { if (loading) run = crosshair(el); else run?.done(); }));
  onCleanup(() => run?.cancel());
  return <div ref={el} class="card">…</div>;
}
```

**Angular** (standalone directive)

```ts
import { Directive, ElementRef, Input, OnChanges, OnDestroy } from "@angular/core";
import { crosshair, type CrosshairRun } from "crosshair-skeleton";

@Directive({ selector: "[crosshair]", standalone: true })
export class CrosshairDirective implements OnChanges, OnDestroy {
  @Input("crosshair") loading = false;
  private run?: CrosshairRun;
  constructor(private el: ElementRef<HTMLElement>) {}
  ngOnChanges() { if (this.loading) this.run = crosshair(this.el.nativeElement); else this.run?.done(); }
  ngOnDestroy() { this.run?.cancel(); }
}
// <div class="card" [crosshair]="!data">…</div>
```

**Lit and web components** (shadow DOM is supported: the styles are added to the element's own shadow root)

```js
updated(changed) {
  if (!changed.has("data")) return;
  const card = this.renderRoot.querySelector(".card");
  if (!this.data) this.run = crosshair(card); else this.run?.done();
}
disconnectedCallback() { super.disconnectedCallback(); this.run?.cancel(); }
```

For the attribute API inside a shadow root, call `watch(this.renderRoot)`.

**Alpine**

```html
<div class="card" :data-crosshair="data ? 'done' : 'loading'">…</div>
<script type="module">import { watch } from "./crosshair-skeleton.js"; watch();</script>
```

**htmx**: put the skeleton on a wrapper and swap into an inner element, so the swap doesn't remove the overlay.

```html
<div class="card" data-skeleton><div class="body" hx-get="/revenue" hx-trigger="load">…placeholder…</div></div>
<script type="module">
  import { crosshair } from "./crosshair-skeleton.js";
  const runs = new WeakMap(); // one skeleton per card, so concurrent requests never reveal each other
  const card = (e) => e.detail.elt.closest("[data-skeleton]");
  document.body.addEventListener("htmx:beforeRequest", (e) => { const c = card(e); if (c) runs.set(c, crosshair(c)); });
  document.body.addEventListener("htmx:afterSettle", (e) => { const c = card(e); if (c) runs.get(c)?.done(); });
  // Requests that end without a swap: errors and aborts show the content, a 204 finishes normally
  document.body.addEventListener("htmx:afterRequest", (e) => {
    const c = card(e); if (!c) return;
    if (!e.detail.successful) runs.get(c)?.cancel();
    else if (e.detail.xhr.status === 204) runs.get(c)?.done();
  });
  document.body.addEventListener("htmx:sendAbort", (e) => { const c = card(e); if (c) runs.get(c)?.cancel(); });
</script>
```

## Options

```js
crosshair(el, {
  reveal: "fade",   // "fade" | "blink" (sections flicker on in order) | "scan" (dithered line wipes down)
  grace: 150,       // ms before anything is drawn; faster loads show no skeleton
  minVisible: 600,  // once drawn, stay at least this long
  trace: "auto",    // "auto" | "box" (outer box only) | "none" (grid and corners only)
  depth: 3,         // structural box depth
  cell: 56,         // target grid cell (px); grown automatically so there are never more than ~48 lines
  readout: "auto",  // phase + size label above the element: true | false | "auto" (≥ 240×120 only)
  pulse: true,      // breathing while waiting
  speed: 1,         // 2 = twice as fast
});
```

Attribute API equivalents: `data-crosshair-reveal`, `data-crosshair-trace`, `data-crosshair-speed`.

Picking a reveal: `fade` for most UI; `blink` for dashboards and cards with clear sections (it reads as "systems coming online"); `scan` for images, charts and hero areas.

## Light and dark

Every colour is mixed from the element's own text colour (`currentColor`), so the skeleton follows the project's theme, light or dark, with no configuration. Override any of these custom properties on the element or a parent to tune it:

| Property | Default | Used for |
|---|---|---|
| `--cs-fill` | 7% of the text colour | Skeleton surface |
| `--cs-line` | 5% | Grid lines |
| `--cs-dot` | 16% | Grid dots |
| `--cs-wire` | 24% | Traced shapes |
| `--cs-mark` | 24% | Crosshair centres |
| `--cs-arm` | 12% | Crosshair arms |
| `--cs-scan` | 30% | Scan line |

Use the project's existing colour tokens when overriding; don't introduce new hex values into a design system.

## Performance contract

What the runtime already does (keep it that way when integrating):

- No dependencies, fonts, images or network requests; one small module.
- The build (about 1.5 s) animates SVG strokes and one clip, measured at under 5 ms of render work per frame (p95) in Chrome and WebKit and under 10 ms in Firefox, with 5 to 9 skeletons building at once.
- The wait animates only `opacity` on two layers per skeleton, which runs on the compositor: about 0.3 ms per frame of main-thread work. Every skeleton breathes in phase.
- Off-screen skeletons are not built until they come within 100 px of the viewport, and their breathing pauses when they scroll away.
- Skeletons that start together cascade in 60 ms apart, so a page of them doesn't build in the same frame. The cascade is capped at half a second: past about eight at once, the rest start together at that mark.
- Tested in Chrome 152, Firefox 158 and WebKit 26.6 (Safari's engine): light and dark, 375 to 1440 px, every reveal, no horizontal scroll, no leftovers.
- The DOM is read once, when the build starts (shapes and grid lines are capped), never per frame.
- After the reveal every animation is cancelled and the overlay is removed: zero leftovers.
- `prefers-reduced-motion`: no build or blinking, just a static skeleton and a 200 ms fade.

What the integration must do:

- Reserve the final size so neither the skeleton nor the reveal shifts layout.
- One skeleton per request: a single fetch that fills a whole page gets one skeleton over that page's content (not around the app shell or the navigation); blocks that load separately get one each.
- Leave a little room around the element. The crosshair corners reach up to 28 px past each corner and the size readout sits 22 px above the top edge. They never widen the page (the overlay uses layout containment, so anything past the viewport is clipped, never scrolled to), but an element flush with the top of the page or inside `overflow: hidden` loses them. Put the ref on an inner element inside the page's padding rather than on the padded container itself.

## Accessibility

While loading the element gets `aria-busy="true"` (its own earlier value is restored afterwards) and the overlay is `aria-hidden`. The placeholder content stays in the DOM, hidden and `inert` (its earlier `inert` state is restored), so it can't be focused, clicked or read out while it is a placeholder. Reduced motion is respected automatically.

## Checklist before calling it done

The full checklist, with how to slow the request and a console snippet, is in [AGENT-GUIDE.md](./AGENT-GUIDE.md#verification-checklist).

- [ ] The element has its final size before `crosshair()` runs (check: the readout shows a realistic size).
- [ ] `done()` runs after the real content is rendered; `cancel()` runs on unmount.
- [ ] A fast response (under 150 ms) shows no skeleton; a slow one never flashes.
- [ ] Checked in light and dark, at phone and desktop widths, with no horizontal scroll.
- [ ] No console warnings (a bare `<img>`/`<canvas>` host logs one: wrap it).

## Preview

Serve this folder over http (for example `npx serve .`) and open:

- [`demo.html`](./demo.html): 21 examples (headline, stats card, line chart, article, image card, list, catalogue grid, KPI tiles, pricing, form, table, profile, chat, video, donut chart, code block, heatmap, product card, empty box) with slow, fast and held loads, all three reveals, speed and theme.
- [`bench.html`](./bench.html): frame timing and render work at 375, 768 and 1440 px for the load and the wait, plus a leftover check.

---

Made by [Velox Themes](https://library.veloxthemes.com/?utm_source=github&utm_medium=skill&utm_campaign=crosshair-skeleton) · MIT licensed · [Source](https://github.com/velox-themes/crosshair-skeleton)
