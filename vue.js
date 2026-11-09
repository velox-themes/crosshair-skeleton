// Vue 3 / Nuxt adapter for crosshair-skeleton · MIT
import { crosshair } from "./crosshair-skeleton.js";

const runs = new WeakMap();
const read = (value) => (value && typeof value === "object" ? value : { loading: !!value });

function apply(el, binding) {
  const { loading = false, ...options } = read(binding.value);
  const prev = runs.get(el);
  if (loading && !prev?.loading) runs.set(el, { loading: true, run: crosshair(el, options) });
  else if (!loading && prev?.loading) {
    prev.run.done(); // runs after the component re-rendered, so the real content is in place
    runs.set(el, { loading: false, run: prev.run });
  }
}

/**
 * <div v-crosshair="loading">…</div>
 * <div v-crosshair="{ loading, reveal: 'flow' }">…</div>
 */
export const vCrosshair = {
  mounted: apply,
  updated: apply,
  beforeUnmount(el) {
    runs.get(el)?.run.cancel();
    runs.delete(el);
  },
  getSSRProps: () => ({}),
};

/** app.use(CrosshairSkeleton) registers v-crosshair globally. */
export default {
  install(app) {
    app.directive("crosshair", vCrosshair);
  },
};
