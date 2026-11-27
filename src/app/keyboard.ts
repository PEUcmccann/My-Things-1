/** The part of the page that is on screen, as `window.visualViewport` reports it. */
export interface VisibleArea {
  /** Height of the layout viewport, which fixed and bottom-anchored views are placed in. */
  layoutHeight: number;
  height: number;
  /** How far the visible area's top is below the layout viewport's top. */
  offsetTop: number;
  /** Pinch-zoom factor; 1 when not zoomed. */
  scale: number;
}

/**
 * How much of the bottom of the layout viewport the on-screen keyboard hides.
 *
 * Safari on iPhone, and Chrome since version 108, don't shrink the layout viewport when the
 * keyboard opens; only the visual viewport shrinks. Views anchored to the bottom then sit
 * behind the keyboard unless they are lifted by this much.
 */
export function keyboardInset({ layoutHeight, height, offsetTop, scale }: VisibleArea): number {
  // While zoomed in, the visible area is smaller for another reason: leave the layout alone.
  if (scale > 1.01) return 0;
  return Math.max(0, Math.round(layoutHeight - (offsetTop + height)));
}
