export interface CrosshairOptions {
  /** How the real content arrives. Default "fade". */
  reveal?: "fade" | "blink" | "scan";
  /** Ms before anything is drawn; faster loads never show a skeleton. Default 150. */
  grace?: number;
  /** Once drawn, stay at least this long. Default 600. */
  minVisible?: number;
  /** "auto" traces what is inside, "box" the outer box only, "none" grid and corners only. Default "auto". */
  trace?: "auto" | "box" | "none";
  /** Structural box depth: 1 outer box, 2 sections, 3 their children. Default 3. */
  depth?: number;
  /** Target grid cell in px. Default 56. */
  cell?: number;
  /** Phase and size label above the element. "auto" shows it on elements of 240×120 or more. Default "auto". */
  readout?: boolean | "auto";
  /** Slow breathing while waiting. Default true. */
  pulse?: boolean;
  /** 2 = twice as fast, 0.5 = half speed. Default 1. */
  speed?: number;
}

export interface CrosshairRun {
  /** The data is in and rendered: reveal (waits for a clean point if mid-build) and clean up. */
  done(): Promise<void>;
  /** Stop at once and show the content as it is. */
  cancel(): void;
  /** Resolves once the skeleton is gone, by done() or cancel(). */
  readonly finished: Promise<void>;
}

/** Start a skeleton on an element that is loading. Give the element its final size first. */
export function crosshair(el: HTMLElement, options?: CrosshairOptions): CrosshairRun;

/**
 * Declarative use: elements with data-crosshair="loading" get a skeleton; any other value reveals.
 * Returns a function that stops watching.
 */
export function watch(root?: ParentNode & Node): () => void;
