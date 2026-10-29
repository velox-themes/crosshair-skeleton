// Svelte / SvelteKit action for crosshair-skeleton · MIT
import { crosshair } from "./crosshair-skeleton.js";

const read = (value) => (value && typeof value === "object" ? value : { loading: !!value });

/**
 * <div use:skeleton={loading}>…</div>
 * <div use:skeleton={{ loading, reveal: "scan" }}>…</div>
 */
export function skeleton(node, param) {
  let run = null;
  let on = false;
  const set = (value) => {
    const { loading = false, ...options } = read(value);
    if (loading && !on) {
      run = crosshair(node, options);
      on = true;
    } else if (!loading && on) {
      run.done();
      on = false;
    }
  };
  set(param);
  return { update: set, destroy: () => run?.cancel() };
}
