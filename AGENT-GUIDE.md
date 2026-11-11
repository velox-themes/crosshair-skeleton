# Agent guide: applying Crosshair Skeleton to a real page

Read this before integrating the skeleton into a real project. [SKILL.md](./SKILL.md) is the reference (API, options, every framework); this guide is the procedure, plus what actually went wrong when it was applied to production UI.

**Where the lessons come from (29 October 2026):** a fresh agent with no prior context was given only the skill and a plain request ("replace the Loading… line with a proper loading skeleton, install it with npm"). The page was a copy of a production template-detail page (Next.js 15, React 19, Tailwind 4): gallery, info card with actions, long description, tag lists and three card grids, all filled by one slow API request. The result was then checked in a real browser at 1280 px and 375 px, light and dark, with slow, fast and repeated loads. Every pitfall below happened in that test or was caught by its verification.

## Landing-page highlight

When the request is to highlight or add an entrance effect on a marketing or landing page, there is no data: use `auto` ([recipe](./SKILL.md#landing-page-highlight)).

1. **List the sections** of the page and, for each, the one supporting element that backs up its message (the hero mockup, a feature image, the bento card to notice). The headline, copy, buttons and navigation are never candidates.
2. **Choose at most three for the whole page, at most one per section.** Prefer one. Skip a section that is busy (long lists, pricing tables, logo walls, FAQ), and skip one already animated or moving by itself (carousel, marquee, autoplay video).
3. **Keep the hero's largest element visible.** If the hero's main image or headline is the largest thing on screen, it is what Google measures as the page load; highlight a smaller supporting visual instead, or start below the fold.
4. **Give each chosen element its final size** before the effect (image `width`/`height` or `aspect-ratio`), so nothing shifts when it draws.
5. **Wire it declaratively** with `data-crosshair="loading" data-crosshair-auto`, the `cs-js` class and the one CSS line in `<head>`, and one `watch()` per page.
6. **Verify in a browser:** each highlighted element plays once when scrolled into view and its content shows after the draw and a short pause (about three seconds), at a pace you can follow by eye; scrolling back does not replay; with reduced motion the content shows at once; with JavaScript disabled the content shows; no layout shift and no horizontal scroll at phone width.

When you report back, name each element you highlighted and why, and list the ones you deliberately left out.

## Loading state: the procedure

0. **Check it fits.** Read [When to use it, and when not](./SKILL.md#when-to-use-it-and-when-not) first. For a loading state: async content, a wait often over 300 ms, a layout known before the data, a block big enough to read, and it is the one block on the section that matters. Never one per card or widget, never on content already on screen during a background refresh. For a landing page, follow [Landing-page highlight](#landing-page-highlight) instead.
1. **Find the loading state.** Search for `Loading`, `isLoading`, `status === "loading"`, `if (!data) return`, spinners and `Suspense` fallbacks. Note which request fills which part of the page.
2. **Decide the scope: one skeleton per request.** One fetch that fills the whole page gets one skeleton over that page's content, even when it is page-sized. Separate requests (a sidebar widget, a comments list) each get their own. Never wrap the app shell or the navigation.
3. **Make the real layout render while loading.** Replace the early `return <p>Loading…</p>` with the real component rendered from placeholder data of the same type (see the worked example). This is what the skeleton draws, and it removes layout shift.
4. **Pick the host element.** Use an element *inside* the page's padding, not the padded container itself: the size readout sits 22 px above the top edge and the corners reach 28 px past each corner, so a host flush with the top of the page loses them. Never a bare `<img>`, `<video>` or `<canvas>` (wrap it).
5. **Install and wire.** `npm install crosshair-skeleton`, then the adapter for the stack (`crosshair-skeleton/react`, `/vue`, `/svelte`) or `crosshair()` / `watch()` from the core. Drive it with a *loading* flag, not with `!data` (step 6).
6. **Handle errors and retries.** With `useCrosshair(!data)`, a failed request leaves the skeleton breathing forever. Use the request status (`useCrosshair(status === "loading")`) so an error reveals your error state. A refetch that sets the status back to loading restarts the skeleton on the same element.
7. **Verify in a real browser** with the checklist below. Type-checking and linting cannot show any of these failures.

## Worked example (React / Next.js App Router)

Before:

```tsx
const { data } = useProduct(id);
if (!data) return <p>Loading…</p>;
return <ProductPage data={data} />;
```

After:

```tsx
"use client";
import { useCrosshair } from "crosshair-skeleton/react";

// Same shape as the real data, text of similar length. Images: a 1×1 transparent data URI keeps
// each image's CSS box (aspect-ratio, width/height). Keys in lists must stay unique.
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PLACEHOLDER: Product = {
  name: "Product name",
  summary: "A short summary written across two or three lines, about as long as a real one.",
  cover: BLANK,
  gallery: [`${BLANK}#1`, `${BLANK}#2`, `${BLANK}#3`],
  tags: ["Tag", "Tag two"],
};

export function ProductDetail({ id }: { id: string }) {
  const { data, status } = useProduct(id);
  const skeleton = useCrosshair(status === "loading");
  if (status === "error") return <ErrorState />;
  return (
    <div className="px-4 py-6">              {/* the page padding stays outside */}
      <div ref={skeleton}>                    {/* the host: one request, one skeleton */}
        <ProductPage data={data ?? PLACEHOLDER} />
      </div>
    </div>
  );
}
```

The placeholder is hidden, `inert` and `aria-busy` while loading, so its text is never seen, focused or read out.

## Pitfalls seen in real integrations

| What happened | Why | Do this |
|---|---|---|
| Nothing to draw | The component returned a "Loading…" line instead of its layout | Render the layout from placeholder data (step 3) |
| While waiting, the skeleton blocks didn't line up with the real UI (a status chip was missing, lines had different widths) | The placeholder left out an optional part that the real data usually has (`owned: false` hid the "Purchased" chip) and used text of different lengths | Mirror the real data: turn on the optional parts that are usually present (badges, chips, buttons), use text of similar length. The handover measures the real content again regardless, so the reveal always lands exactly |
| The element grew by 1 px while loading | The overlay, as the last child, switched off a `:last-child` rule | Fixed in the runtime (it moves itself to the front when that happens). A plain wrapper `<div>` as the host avoids it entirely |
| Readout and top corners missing | The host started at the very top of the page / inside `overflow: hidden` | Put the ref on an inner element inside the padding (step 4) |
| Image boxes collapsed in the placeholder | `src` was empty or missing | 1×1 transparent data URI; keep the image's CSS size |
| Duplicate-key warning in the placeholder list | Every placeholder image had the same URL used as the key | Suffix them (`#1`, `#2`…) or key by index for placeholders |
| Skeleton breathing forever after a failed request | Driven by `!data` | Drive it by request status (step 6) |
| Updated the package but the page still ran the old code | `next dev` caches `node_modules` | Restart the dev server (clear `.next` if it persists); confirm by searching the served page chunk |
| Worry about horizontal scroll on phones | Corners reach 28 px past the element | Not an issue: the overlay uses layout containment, so it is clipped, never scrolled to (verified at 375 px) |
| Lower sections of a long page not drawn | 90-element budget | On bigger pages mark dense grids and repeated cards `data-crosshair-part="box"` so each counts once |
| Worry about a list or table with thousands of rows under one skeleton | Every row is real DOM | Nothing to do: only the rows on screen are drawn and animated, the rest appear without animations. Reserve the list's height, and mark repeated row parts `data-crosshair-part="box"` if the 90-element budget runs out before the fold |
| Too many cursors and labels on a busy page | Every small element gets its own selection | `labels: false`, `cursors: 1` or `cursors: false` tone it down; mark decorative parts `data-crosshair-part="skip"` |
| Placeholder content flashed before the skeleton on a server-rendered page (SSR/SSG, adapters included) | The HTML paints before JavaScript hydrates | Render `data-crosshair={isLoading ? "loading" : "done"}` on the host and add `[data-crosshair="loading"] > :not(.cs-ov) { opacity: 0 }` to the global CSS. Client-only pages don't need it |
| The skeleton was invisible in a Tailwind v4 app (fixed in the runtime) | Tailwind v4 hides `[hidden]` with `!important` inside a cascade layer, which beats unlayered `!important` | Don't add `hidden` (or other display-changing attributes) to the overlay or the host while loading |
| The skeleton disappeared during loading | The app replaced the host's own `innerHTML` | Render into the host's children, or put the skeleton on a wrapper and swap an inner element |

## Verification checklist

Add a way to slow the request (a `?delay=` parameter on a dev API, or the browser's network throttling), then check:

- [ ] **Slow load (3 s or more):** the skeleton appears within about 200 ms, the cursors select the real elements and leave blocks in their shape; the readout equals the element's size in DevTools, and the element's height does not change when the skeleton appears.
- [ ] **At the handover:** each real element swaps in exactly where its block was (or, if the placeholder differed, the blocks redraw onto the real layout first).
- [ ] **Fast load (under 150 ms):** no skeleton at all, just the content.
- [ ] **While loading:** the host has `aria-busy="true"` and `inert`; the placeholder text is invisible and can't be focused.
- [ ] **After the reveal:** the real content shows; no `.cs-ov`, `data-cs-hide`, `inert` or `aria-busy` is left (unless the app set them itself); no animations remain.
- [ ] **Phone width (375 px):** no horizontal scroll.
- [ ] **Theme:** switch light/dark while the skeleton waits; it follows.
- [ ] **Refetch:** reloading the data runs the skeleton again.
- [ ] **Console:** no errors or warnings.

Paste this into the browser console while the page is loading, then again after the reveal:

```js
(() => {
  const host = document.querySelector("[aria-busy='true']") || document.querySelector(".cs-ov")?.parentElement;
  return {
    skeleton: !!document.querySelector(".cs-ov"),
    busy: host?.getAttribute("aria-busy") ?? null,
    inert: host?.hasAttribute("inert") ?? false,
    leftovers: document.querySelectorAll("[data-cs-hide]").length,
    animations: document.getAnimations().length,
    horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
})();
```

## When you report back

State what you changed, the commands you ran, and what you verified in the browser (viewport, theme, slow and fast loads). If anything in the skill made you guess, say so and quote the line: that is how this guide grows.
