---
name: crosshair-skeleton
description: A loading skeleton for any element (cards, charts, graphs, text, headlines, images, lists, tables, forms) that locks on with crosshair corners, measures the element, maps a grid over it, then cursors drag a selection around every element inside (with size labels) and leave a skeleton block in its place (text lines, images, charts, buttons), breathes while it waits, then hands the real content back element by element (cascade, flow or fade reveal). One dependency-free ES module (about 17 KB gzipped, comments included) with tested adapters for React/Next.js/Preact, Vue/Nuxt and Svelte/SvelteKit, plus patterns for Solid, Angular, Lit, Astro, Alpine and htmx, follows light and dark themes automatically, and is built to be cheap on CPU. Use when the user asks for a "loading skeleton", "skeleton loader", "loading state", "placeholder while data loads", "crosshair loader", "blueprint/wireframe loading", "replace the shimmer", "make loading look technical", or wants a nicer loading state for a card, chart, list or page section. Not for button or inline spinners, progress bars, background refreshes of content already on screen, streaming text, or anything the server can render directly.
license: MIT (see LICENSE)
---

# Crosshair Skeleton

A loading state that looks like the interface is being measured and mapped while the data is on its way:

1. **Lock** – four crosshair corners snap in at the top-left and blink twice.
2. **Measure** – the element is selected like in a design tool: its selection box, handles and size label are dragged out to its real corners, and the readout counts the size up.
3. **Map** – a fine grid sweeps in from the origin, then its intersection dots.
4. **Draw** – up to three cursors take turns on the elements inside. Each one travels to an element, presses, drags a selection box around it (size label underneath), and a skeleton block settles in its place: one bar per line of text, and buttons, chips, images and charts in their own shape and corner radius.
5. **Wait** – the grid breathes slowly for as long as the data takes.
6. **Reveal** – when the data is in, the real elements replace their blocks one by one in reading order (`cascade`), strictly top to bottom (`flow`) or all at once (`fade`), and the skeleton removes itself completely.

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
| A hero or section waiting on CMS data | One skeleton on the section |

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

**Design fit.** The look is precise and technical (crosshairs, a grid, design-tool cursors and selections). It suits product, data, developer, design-tool and agency interfaces. On a soft or playful brand, check with the user before applying it everywhere; `cursors: false`, `labels: false`, `readout: false` and `pulse: false` tone it down.

**Many at once** is fine (a grid of 20 cards): skeletons that start together cascade in, every one breathes in sync, off-screen ones are not built until they scroll in, and the wait runs on the compositor.

## How it knows the shape

While loading, the real content usually isn't there yet. The runtime draws **whatever is inside the element at the moment loading starts**:

| What is inside | What gets drawn |
|---|---|
| The real component rendered with placeholder data (recommended) | Its exact structure: text lines, images, charts, buttons, chips. Same layout as the result, so nothing jumps. |
| Placeholder markup of your own (fixed-size blocks, empty rows) | Those blocks. |
| Nothing (an empty container with a reserved size) | The element's own selection, grid and corners only. |

**At the handover it measures again.** When `done()` runs, your real content is already rendered (still hidden), so the skeleton measures it once more. If it matches what was drawn, the draw carries on and every element swaps in once its own block has been shown. If it doesn't, the blocks are redrawn exactly on the real layout (a 120 ms cross-fade) and the cascade starts at once. The reveal therefore always lands on the real UI. While waiting it can only draw the placeholder, so the closer the placeholder is to the real data, the steadier it looks (see [AGENT-GUIDE.md](./AGENT-GUIDE.md#pitfalls-seen-in-real-integrations)).

The readout reports the element's outer size (border box), rounded the way DevTools shows it. The overlay never changes the element's layout: if being the last child would switch off a `:last-child` rule (a list's last border, Tailwind `space-y`), it moves itself to the front.

Rules it follows to find the elements to draw:

- **Text** (an element with its own text, or only inline children) becomes one rounded bar per rendered line, at the real width and 62% of the line height. Icons and chips inside the text keep their own small blocks.
- **Surfaced text** (a button, chip, badge or bubble: text on its own background or border) becomes one block in its shape and corner radius.
- `img`, `video`, `iframe`, `picture`, `svg`, `canvas`, `[role=img]`, form controls and `[role=button]` become one block in their own shape and radius.
- **Repeated rows are drawn in parallel**: three or more siblings of the same kind (table rows and cells, list items, cards with the same class) become one group with one selection, and all their blocks settle and swap in together. A table or list never draws row by row.
- A run of 6 to 60 simple sibling shapes (chart bars, legend dots, swatches) is one group: one selection around all of them, and every shape settles at once rather than one by one. More than 60 (a heatmap, a calendar), or more than 40 mixed children, becomes one block.
- Wrappers are looked through, never drawn; empty elements with a background (a coloured bar, an avatar circle) are drawn, empty spacers are not.
- Capped at 90 elements and 600 visited nodes, however large the element, and the whole draw is squeezed into 2 seconds however many elements there are. Past the cap the rest still gets the fill and grid. On a very large element (a whole page of cards), mark dense regions `data-crosshair-part="box"` so the budget covers the whole page.

**Making placeholder data.** Give it the same shape as the real data, with text of similar length. For images, use a 1×1 transparent data URI so the image's CSS box (`aspect-ratio`, width/height) keeps its size: `data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7`. Keep keys unique in placeholder lists (`${BLANK}#1`, `#2`…). The placeholder is hidden and `inert` while loading, so its text never shows or gets read out.

Hints, when the automatic reading is not what you want:

```html
<div data-crosshair-part="skip">…</div>   <!-- not drawn (decorations, sticky toolbars) -->
<div data-crosshair-part="box">…</div>    <!-- one block, don't look inside (a custom chart made of divs) -->
```

## Install

Prefer the package when the project uses npm: `npm install crosshair-skeleton`, then `import { crosshair, watch } from "crosshair-skeleton"` (TypeScript types included). Otherwise copy [`crosshair-skeleton.js`](./crosshair-skeleton.js) into the project (for example `src/lib/` or `public/vendor/`) and import it by path. Either way that is the whole install: no dependencies, no CSS file, no fonts, no images. Its styles are injected once as a constructable stylesheet (falls back to one `<style>` tag).

Do not rewrite the runtime or retune its timings one by one: the lock, expand, grid, draw and reveal timings are one rhythm. Use the `speed` option instead.

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
<section data-crosshair="loading" data-crosshair-reveal="flow">…</section>
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
  const ref = useCrosshair(!data, { reveal: "cascade" }); // better: useCrosshair(status === "loading"), see below
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
<div class="card" v-crosshair="{ loading: !data, reveal: 'flow' }">…</div>
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
  reveal: "cascade", // "cascade" (element by element) | "flow" (strictly top to bottom) | "fade" (all at once)
  grace: 150,       // ms before anything is drawn; faster loads show no skeleton
  minVisible: 600,  // once drawn, stay at least this long
  trace: "auto",    // "auto" (every element) | "box" (only the element's own selection) | "none" (grid and corners only)
  cell: 40,         // target grid cell (px); grown automatically so there are never more than ~48 lines
  cursors: true,    // true (1 to 3, by element count) | false (selections without cursors) | 1 to 4
  labels: true,     // "W × H" size label under each selection
  readout: "auto",  // phase + size label above the element: true | false | "auto" (≥ 240×120 only)
  pulse: true,      // breathing while waiting
  speed: 1,         // 2 = twice as fast
});
```

Attribute API equivalents: `data-crosshair-reveal`, `data-crosshair-trace`, `data-crosshair-speed`, `data-crosshair-cursors`.

Picking a reveal: `cascade` for most UI (each element swaps in for its block, a few at a time); `flow` for reading content (articles, docs, feeds) where top-to-bottom order matters; `fade` for small elements or when many skeletons reveal at once.

## Light and dark

Every surface colour is mixed from the element's own text colour (`currentColor`) and the background behind it, so the skeleton follows the project's theme, light or dark, with no configuration (it also follows a theme switch while loading). The selections use a neutral grey that reads on both. Override any of these custom properties on the element or a parent to tune it:

| Property | Default | Used for |
|---|---|---|
| `--cs-fill` | 6% of the text colour | Skeleton surface |
| `--cs-block` | 13% of the text colour, mixed into the background | Skeleton blocks (opaque) |
| `--cs-line` | 4% | Grid lines |
| `--cs-dot` | 12% | Grid dots |
| `--cs-select` | `#6b6b6b` | Selection boxes, handles, size labels |
| `--cs-select-ink` | `#fff` | Size label text |
| `--cs-cursor` | `--cs-select` | Cursors |
| `--cs-mark` | 16% | Crosshair centres |
| `--cs-arm` | 8% | Crosshair arms |

Brand the selection with the project's accent (`--cs-select: var(--accent)`) when it fits.

Use the project's existing colour tokens when overriding; don't introduce new hex values into a design system.

## Performance contract

What the runtime already does (keep it that way when integrating):

- No dependencies, fonts, images or network requests; one small module.
- The build animates SVG strokes and one clip on the compositor; the cursor draw (at most 2 s, however many elements) runs in one shared animation-frame loop that only writes attributes that changed and stops when the draw ends. Measured at under 4 ms of render work per frame (p95) in Chrome and WebKit and under 9 ms in Firefox, with 5 to 9 skeletons building at once.
- Big pages and lots of data: only elements on screen get a cursor and take part in the cascade; the rest of a long list fades its blocks in and appears at the swap without an animation of its own. A skeleton over a 3,000-row list animates only the few dozen rows in view (measured with 4× CPU throttling: the swap's longest task went from 3.7 s to 67 ms). Selections and size labels exist only while they are visible. The blur at the swap is dropped when more than 24 elements swap in at once.
- Builds and swaps go through one shared queue that runs in slices of about 8 ms and yields between them, so a page of skeletons starting or finishing together never blocks a frame (24 cards and a 300-row list at 4× throttling: a steady 60 fps, p95 16.8 ms, no long tasks; it was p95 33 ms with frames up to 150 ms). Skeletons scrolled off screen skip painting entirely and catch up when they come back.
- The wait animates only the grid's `opacity`, which runs on the compositor: no JavaScript runs while waiting. Every skeleton breathes in phase.
- Off-screen skeletons are not built until they come within 100 px of the viewport, and their breathing pauses when they scroll away.
- Skeletons that start together cascade in 60 ms apart, so a page of them doesn't build in the same frame. The cascade is capped at half a second: past about eight at once, the rest start together at that mark.
- Tested in Chrome 153, Firefox 159 and WebKit 26.6 (Safari's engine): light and dark, 375 to 1440 px, every reveal, no horizontal scroll, no leftovers.
- The DOM is read when the build starts and once more at the handover (elements and grid lines are capped), never per frame.
- After the reveal every animation is cancelled and the overlay is removed: zero leftovers.
- `prefers-reduced-motion`: no build, cursors or blinking, just the static blocks and a 200 ms fade.

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
