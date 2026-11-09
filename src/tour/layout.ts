export type Box = { x: number; y: number; width: number; height: number };

/** The bubble's distance from the screen edges and from the highlight. */
const edge = 16;
const gap = 14;
/** Content cut down to less than this can't be pointed at. */
const minVisible = 24;

/**
 * The highlight around a measured view: padded, and cut to the band it can be seen in (content
 * scrolls between the header and the tab bar). Null when too little of it shows.
 */
export function spotlight(
  view: Box,
  pad: number,
  band: { top: number; bottom: number; width: number },
): Box | null {
  const x = Math.max(view.x - pad, 0);
  const y = Math.max(view.y - pad, band.top);
  const right = Math.min(view.x + view.width + pad, band.width);
  const bottom = Math.min(view.y + view.height + pad, band.bottom);
  if (right - x < minVisible || bottom - y < minVisible) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Where the bubble sits: on the side of the highlight with more room, centered on it and kept on
 * screen. `arrow` is the pointer's center from the bubble's left edge. With nothing to point at,
 * it sits a third of the way down.
 */
export function bubblePlacement(
  hole: Box | null,
  screen: { width: number; height: number },
  maxWidth = 340,
): { left: number; width: number; top?: number; bottom?: number; arrow?: number } {
  const width = Math.min(screen.width - edge * 2, maxWidth);
  if (!hole) return { left: (screen.width - width) / 2, width, top: screen.height / 3 };
  const center = hole.x + hole.width / 2;
  const left = Math.min(Math.max(center - width / 2, edge), screen.width - edge - width);
  const arrow = Math.min(Math.max(center - left, 24), width - 24);
  const below = screen.height - (hole.y + hole.height);
  return below >= hole.y
    ? { left, width, top: hole.y + hole.height + gap, arrow }
    : { left, width, bottom: screen.height - hole.y + gap, arrow };
}
