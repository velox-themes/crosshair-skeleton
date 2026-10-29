# Crosshair Skeleton

A loading skeleton that locks onto an element, measures it, maps a grid over it, traces the shape of what is inside, waits quietly, then hands over to the real content.

Works on any element (cards, charts, text, images, lists), in any framework, in light and dark themes, with no dependencies.

## Use it as an agent skill

Copy this folder into your agent's skills directory:

| Agent | Folder |
|---|---|
| Claude Code | `~/.claude/skills/crosshair-skeleton/` (or `.claude/skills/` in a project) |
| Codex | `~/.codex/skills/crosshair-skeleton/` |
| Others that read `SKILL.md` | Their skills folder |

Then ask for it: "add a crosshair loading skeleton to the revenue card".

## Use it directly

```bash
npm install crosshair-skeleton
```

Or copy `crosshair-skeleton.js` into your project (one file, no dependencies).

```js
import { crosshair } from "crosshair-skeleton"; // or "./crosshair-skeleton.js"

const skeleton = crosshair(document.querySelector("#card")); // loading starts
// …fetch and render the real content…
await skeleton.done(); // revealed, overlay removed
```

Or declaratively:

```html
<div data-crosshair="loading">…</div>
<script type="module">
  import { watch } from "crosshair-skeleton";
  watch(); // set data-crosshair to anything else to reveal
</script>
```

Options, framework examples, theming and the performance contract are in [SKILL.md](./SKILL.md).

## Preview

```bash
npx serve .
```

Open `demo.html` for every example and `bench.html` for frame timing.

## License

MIT. See [LICENSE](./LICENSE).
