import type { CrosshairOptions } from "./crosshair-skeleton.js";

/**
 * Skeleton for the element the returned callback ref is attached to: starts while `loading` is true,
 * reveals the real content when it turns false, cancels on unmount. Follows the element itself,
 * so a target that mounts later or is replaced is handled.
 */
export function useCrosshair<T extends HTMLElement = HTMLDivElement>(loading: boolean, options?: CrosshairOptions): (el: T | null) => void;
