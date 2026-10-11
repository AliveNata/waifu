export interface DragOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where a self-dragged window goes, always at its fixed size. On Windows with display scaling
 * other than 100%, `setPosition` rounds and grows the window a little on every call, so a drag
 * (dozens of calls) made 2B bigger each time. Setting the whole bounds keeps the size pinned.
 */
export function dragBounds(origin: DragOrigin, dx: number, dy: number): DragOrigin {
  return {
    x: Math.round(origin.x + dx),
    y: Math.round(origin.y + dy),
    width: origin.width,
    height: origin.height,
  };
}
