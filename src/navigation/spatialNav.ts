export interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export type Direction = "up" | "down" | "left" | "right";

interface Candidate {
  id: string;
  rect: Rect;
}

/**
 * Picks the best next focus target in `direction` from `from`, TV-remote
 * style: candidates must lie (mostly) in that direction and are ranked by
 * primary-axis distance first, center-to-center offset second. This is the
 * same rough heuristic used by CSS spatial-navigation polyfills and
 * react-tv/norigin-style focus libraries — good enough for grid/row layouts
 * without needing an explicit adjacency graph per screen.
 */
export function findNextFocus(
  from: Rect,
  direction: Direction,
  candidates: Candidate[],
): string | undefined {
  const fromCenterX = (from.left + from.right) / 2;
  const fromCenterY = (from.top + from.bottom) / 2;

  let best: { id: string; primary: number; secondary: number } | undefined;

  for (const candidate of candidates) {
    const rect = candidate.rect;
    const centerX = (rect.left + rect.right) / 2;
    const centerY = (rect.top + rect.bottom) / 2;

    let primary: number;
    let secondary: number;

    switch (direction) {
      case "right":
        if (rect.left < from.right - 1) continue;
        primary = rect.left - from.right;
        secondary = Math.abs(centerY - fromCenterY);
        break;
      case "left":
        if (rect.right > from.left + 1) continue;
        primary = from.left - rect.right;
        secondary = Math.abs(centerY - fromCenterY);
        break;
      case "down":
        if (rect.top < from.bottom - 1) continue;
        primary = rect.top - from.bottom;
        secondary = Math.abs(centerX - fromCenterX);
        break;
      case "up":
        if (rect.bottom > from.top + 1) continue;
        primary = from.top - rect.bottom;
        secondary = Math.abs(centerX - fromCenterX);
        break;
    }

    if (
      !best ||
      primary < best.primary ||
      (primary === best.primary && secondary < best.secondary)
    ) {
      best = { id: candidate.id, primary, secondary };
    }
  }

  return best?.id;
}
