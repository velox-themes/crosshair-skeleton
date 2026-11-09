import type { CrosshairOptions } from "./crosshair-skeleton.js";

export type CrosshairParam = boolean | (CrosshairOptions & { loading: boolean });

/** `use:skeleton={loading}` or `use:skeleton={{ loading, reveal: "flow" }}` */
export function skeleton(
  node: HTMLElement,
  param: CrosshairParam,
): { update(param: CrosshairParam): void; destroy(): void };
