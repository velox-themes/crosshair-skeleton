# Crosshair Skeleton

**A loading skeleton that measures your UI before it arrives.** Crosshair corners lock onto the element, a grid maps it, then cursors drag a selection around every element inside, size labels and all, and leave a skeleton block in its place. When the data lands, the real elements swap in one by one: no shimmer, no layout jump.

<a href="media/crosshair-skeleton.mp4">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/demo-dark.gif">
    <img alt="Crosshair Skeleton: corners lock onto a headline, a stats card, a line chart and an article, a grid maps them, cursors select each element and leave skeleton blocks, then the real content cascades in" src="media/demo-light.gif" width="800">
  </picture>
</a>

▶ **[Watch the full demo](media/crosshair-skeleton.mp4)**: cascade, flow and fade reveals, in light and dark.

- **Any element:** cards, charts, tables, forms, text, images, lists, video, code. It reads what is inside and draws it, text line by text line.
- **Any framework:** plain JavaScript, React, Next.js, Vue, Svelte, Astro, Angular. One ES module, no dependencies, no CSS file, no fonts, no images.
- **Light and dark:** every colour comes from the element's own text colour, so it matches your theme with no setup.
- **Cheap to run:** the long wait runs on the compositor, off-screen skeletons wait to build, and everything is removed after the reveal.
- **Agent skill included:** drop it into Claude Code or Codex and ask for "a crosshair loading skeleton on the revenue card".

## Install

```bash
npm install crosshair-skeleton
```

Or copy [`crosshair-skeleton.js`](./crosshair-skeleton.js) into your project. It is one file.

### As an agent skill

Copy this folder into your agent's skills directory:

| Agent | Folder |
|---|---|
| Claude Code | `~/.claude/skills/crosshair-skeleton/` (or `.claude/skills/` in a project) |
| Codex | `~/.codex/skills/crosshair-skeleton/` |
| Others that read `SKILL.md` | Their skills folder |

Agents applying the skill should follow [AGENT-GUIDE.md](./AGENT-GUIDE.md): the integration procedure, pitfalls seen on production UI, and a browser verification checklist.

## Usage

```js
import { crosshair } from "crosshair-skeleton";

const card = document.querySelector("#revenue");
const skeleton = crosshair(card);        // loading starts
renderRevenue(card, await getRevenue()); // real content in place, still hidden
await skeleton.done();                   // revealed, overlay removed
```

Declarative, for any framework or server-rendered HTML:

```html
<section data-crosshair="loading" data-crosshair-reveal="flow">…</section>
<script type="module">
  import { watch } from "./crosshair-skeleton.js"; // or "crosshair-skeleton" with a bundler
  watch(); // set data-crosshair to anything else to reveal
</script>
```

### Works with your stack

```jsx
// React, Next.js, Remix, Preact
import { useCrosshair } from "crosshair-skeleton/react";
const ref = useCrosshair(!data);           // <div ref={ref}>…</div>
```

```html
<!-- Vue, Nuxt: app.use(CrosshairSkeleton) from "crosshair-skeleton/vue" -->
<div v-crosshair="!data">…</div>

<!-- Svelte, SvelteKit: import { skeleton } from "crosshair-skeleton/svelte" -->
<div use:skeleton={!data}>…</div>
```

Each adapter is tested against the real framework: the skeleton appears, the real data is revealed, a reload restarts it and an unmount mid-load leaves nothing behind. Tested: React 19 (Strict Mode), Preact 10, Vue 3.5, Svelte 5, Solid 1.9, Lit 3 (shadow DOM), Alpine 3 and htmx 2. React and Vue also server-render cleanly (Next.js, Nuxt). Solid, Angular, Lit, Astro, Alpine and htmx patterns, every option, part hints and theming are in [SKILL.md](./SKILL.md).

## Options

| Option | Default | |
|---|---|---|
| `reveal` | `"cascade"` | `"cascade"` (element by element), `"flow"` (strictly top to bottom) or `"fade"` (all at once) |
| `grace` | `150` | Loads faster than this (ms) never show a skeleton |
| `minVisible` | `600` | Once shown, it stays at least this long (ms) |
| `trace` | `"auto"` | `"auto"` draws every element inside, `"box"` only the element's own selection, `"none"` grid and corners only |
| `cursors` | `true` | `true` (1 to 3, by element count), `false`, or a number from 1 to 4 |
| `labels` | `true` | `W × H` size labels under each selection |
| `speed` | `1` | `2` is twice as fast |

## How it knows the shape

It draws whatever is inside the element when loading starts. Render your real component with placeholder data at its final size and you get its exact structure: one bar per line of text at its real width, and buttons, chips, images, charts and inputs as blocks in their own shape and corner radius. Table rows, list items and chart bars are drawn as groups, all at once rather than one by one. When the data arrives it measures again, so the swap always lands on the real layout. An empty container falls back to its own selection, grid and corners. `data-crosshair-part="skip | box"` overrides any part.

## Performance

Measured with `bench.html` at 375, 768 and 1440 px, with every demo skeleton in the viewport (5 to 9) building at once:

| | Build and draw (about 3 s) | Waiting |
|---|---|---|
| Chrome 153 | 0 long frames, render work p95 under 3.5 ms | about 0.4 to 0.6 ms per frame |
| Firefox 159 | 0 long frames, render work p95 under 9 ms | under 0.1 ms per frame |
| WebKit 26.6 (Safari) | 1 long frame, render work p95 under 4 ms | about 0.6 to 0.8 ms per frame |

On data-heavy pages (Chrome, 4× CPU throttling): 24 dashboard cards plus a 300-row list build at a steady 60 fps (p95 16.8 ms) with no long tasks, and a skeleton over a 3,000-row list hands over with one 67 ms task, where the first version froze for 3.7 s.

Skeletons that start together cascade in 60 ms apart, `prefers-reduced-motion` gets a static skeleton and a short fade, and nothing is left in the DOM after the reveal.

## Try it locally

```bash
npx serve .
```

Then open `demo.html` (21 examples with slow, fast and held loads, all three reveals and both themes) or `bench.html`. Opening the files directly from disk does not work: browsers block ES modules on `file://`.

## Made by Velox Themes

Crosshair Skeleton is free and open source, made by **[Velox Themes](https://library.veloxthemes.com/?utm_source=github&utm_medium=readme&utm_campaign=crosshair-skeleton)**. If you build websites for clients, **[Velox Themes](https://library.veloxthemes.com/?utm_source=github&utm_medium=readme&utm_campaign=crosshair-skeleton)** has polished sections, components and templates you can copy straight into your project.

## License

[MIT](./LICENSE)
