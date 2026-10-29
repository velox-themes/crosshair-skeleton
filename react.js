"use client";
// React / Next.js / Preact (via preact/compat) adapter for crosshair-skeleton · MIT
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { crosshair } from "./crosshair-skeleton.js";

// Layout effect in the browser (starts before paint, so placeholder content never flashes);
// plain effect on the server, where neither runs, to keep server rendering quiet.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Skeleton for the element the returned ref is attached to.
 *   const ref = useCrosshair(isLoading);
 *   <div ref={ref}>{data ? <Real data={data} /> : <Real placeholder />}</div>
 * Follows the element itself: a target that mounts later or is replaced (a new key) is handled.
 */
export function useCrosshair(loading, options) {
  const s = useRef(null);
  s.current ||= { el: null, run: null, loading, options };
  const st = s.current;
  st.loading = loading;
  st.options = options;

  const sync = useCallback(() => {
    const { el, run } = st;
    if (!el) return;
    if (st.loading) {
      if (!run || run.ending || run.el !== el) st.run = crosshair(el, st.options);
    } else if (run && run.el === el) run.done();
  }, []);

  // Callback ref: React calls it when the element mounts, is replaced or unmounts
  const ref = useCallback((el) => {
    if (st.el === el) return;
    if (st.run && st.run.el !== el) {
      st.run.cancel();
      st.run = null;
    }
    st.el = el;
    sync();
  }, []);

  useIsoLayoutEffect(sync, [loading]);
  useIsoLayoutEffect(() => () => { st.run?.cancel(); st.run = null; }, []);
  return ref;
}
