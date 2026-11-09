import type { ObjectDirective, Plugin } from "vue";
import type { CrosshairOptions } from "./crosshair-skeleton.js";

export type CrosshairBinding = boolean | (CrosshairOptions & { loading: boolean });

/** `v-crosshair="loading"` or `v-crosshair="{ loading, reveal: 'flow' }"` */
export const vCrosshair: ObjectDirective<HTMLElement, CrosshairBinding>;

/** `app.use(CrosshairSkeleton)` registers `v-crosshair` globally. */
declare const CrosshairSkeleton: Plugin;
export default CrosshairSkeleton;
