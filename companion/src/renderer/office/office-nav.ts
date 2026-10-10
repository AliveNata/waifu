import { distance, type Furniture, furniture, type Point, room, type StationId, stations } from "./office-plan.js";

/** Grid resolution. Fine enough to slip between a desk and a plant, coarse enough for instant A*. */
export const cellSize = 0.15;
/** Half a chibi's shoulder width plus clearance, so walkers never brush furniture or walls. */
export const bodyRadius = 0.18;

interface Cell {
  col: number;
  row: number;
}

/** Binary min-heap keyed by f-score; the open set of A*. */
class MinHeap {
  private readonly items: { index: number; score: number }[] = [];

  get size(): number {
    return this.items.length;
  }

  push(index: number, score: number): void {
    const items = this.items;
    items.push({ index, score });
    let child = items.length - 1;
    while (child > 0) {
      const parent = (child - 1) >> 1;
      if ((items[parent] as { score: number }).score <= score) {
        break;
      }
      [items[parent], items[child]] = [
        items[child] as { index: number; score: number },
        items[parent] as { index: number; score: number },
      ];
      child = parent;
    }
  }

  pop(): number {
    const items = this.items;
    const top = items[0] as { index: number; score: number };
    const last = items.pop() as { index: number; score: number };
    if (items.length > 0) {
      items[0] = last;
      let parent = 0;
      for (;;) {
        const left = parent * 2 + 1;
        const right = left + 1;
        let smallest = parent;
        if (
          left < items.length &&
          (items[left] as { score: number }).score < (items[smallest] as { score: number }).score
        ) {
          smallest = left;
        }
        if (
          right < items.length &&
          (items[right] as { score: number }).score < (items[smallest] as { score: number }).score
        ) {
          smallest = right;
        }
        if (smallest === parent) {
          break;
        }
        [items[parent], items[smallest]] = [
          items[smallest] as { index: number; score: number },
          items[parent] as { index: number; score: number },
        ];
        parent = smallest;
      }
    }
    return top.index;
  }
}

/** Walkable floor of the office: furniture footprints and walls, inflated by the body radius, are blocked. */
export class NavGrid {
  readonly columns: number;
  readonly rows: number;
  private readonly blocked: Uint8Array;

  constructor(pieces: readonly Furniture[]) {
    this.columns = Math.ceil((room.maxX - room.minX) / cellSize);
    this.rows = Math.ceil((room.maxZ - room.minZ) / cellSize);
    this.blocked = new Uint8Array(this.columns * this.rows);
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        const center = this.centerOf({ col, row });
        const nearWall =
          center.x - room.minX < bodyRadius ||
          room.maxX - center.x < bodyRadius ||
          center.z - room.minZ < bodyRadius ||
          room.maxZ - center.z < bodyRadius;
        const insideFurniture = pieces.some(
          (piece) =>
            piece.blocksWalking &&
            Math.abs(center.x - piece.x) < piece.width / 2 + bodyRadius &&
            Math.abs(center.z - piece.z) < piece.depth / 2 + bodyRadius,
        );
        if (nearWall || insideFurniture) {
          this.blocked[row * this.columns + col] = 1;
        }
      }
    }
  }

  private cellOf(point: Point): Cell {
    return {
      col: Math.min(this.columns - 1, Math.max(0, Math.floor((point.x - room.minX) / cellSize))),
      row: Math.min(this.rows - 1, Math.max(0, Math.floor((point.z - room.minZ) / cellSize))),
    };
  }

  private centerOf(cell: Cell): Point {
    return { x: room.minX + (cell.col + 0.5) * cellSize, z: room.minZ + (cell.row + 0.5) * cellSize };
  }

  private isFreeCell(col: number, row: number): boolean {
    return (
      col >= 0 && row >= 0 && col < this.columns && row < this.rows && this.blocked[row * this.columns + col] === 0
    );
  }

  isFree(point: Point): boolean {
    const { col, row } = this.cellOf(point);
    return this.isFreeCell(col, row);
  }

  /** Closest walkable cell center, searched in growing rings. Used to step out of a seat or snap a goal. */
  nearestFree(point: Point): Point {
    const origin = this.cellOf(point);
    const maxRing = Math.max(this.columns, this.rows);
    for (let ring = 0; ring <= maxRing; ring++) {
      let best: Point | null = null;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring || !this.isFreeCell(origin.col + dc, origin.row + dr)) {
            continue;
          }
          const center = this.centerOf({ col: origin.col + dc, row: origin.row + dr });
          if (best === null || distance(center, point) < distance(best, point)) {
            best = center;
          }
        }
      }
      if (best !== null) {
        return best;
      }
    }
    throw new Error("The office has no walkable floor at all.");
  }

  /** True when a walker can go straight from a to b without crossing a blocked cell. */
  hasLineOfSight(a: Point, b: Point): boolean {
    const steps = Math.ceil(distance(a, b) / (cellSize / 3));
    for (let step = 0; step <= steps; step++) {
      const t = steps === 0 ? 0 : step / steps;
      if (!this.isFree({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) {
        return false;
      }
    }
    return true;
  }

  /**
   * Shortest walkable route from `from` to `to` (both must be free), as waypoints
   * after `from`, ending exactly at `to`. Null when no route exists.
   */
  findPath(from: Point, to: Point): Point[] | null {
    if (this.hasLineOfSight(from, to)) {
      return [to];
    }
    const start = this.cellOf(from);
    const goal = this.cellOf(to);
    const startIndex = start.row * this.columns + start.col;
    const goalIndex = goal.row * this.columns + goal.col;
    const cameFrom = new Int32Array(this.columns * this.rows).fill(-1);
    const cost = new Float32Array(this.columns * this.rows).fill(Number.POSITIVE_INFINITY);
    const closed = new Uint8Array(this.columns * this.rows);
    const heuristic = (col: number, row: number): number => {
      const dc = Math.abs(col - goal.col);
      const dr = Math.abs(row - goal.row);
      return Math.max(dc, dr) + (Math.SQRT2 - 1) * Math.min(dc, dr);
    };
    const open = new MinHeap();
    cost[startIndex] = 0;
    open.push(startIndex, heuristic(start.col, start.row));

    while (open.size > 0) {
      const current = open.pop();
      if (current === goalIndex) {
        return this.smooth(from, this.unwind(cameFrom, current), to);
      }
      if (closed[current] === 1) {
        continue;
      }
      closed[current] = 1;
      const col = current % this.columns;
      const row = Math.floor(current / this.columns);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if ((dr === 0 && dc === 0) || !this.isFreeCell(col + dc, row + dr)) {
            continue;
          }
          // No corner cutting: a diagonal step needs both orthogonal neighbours free.
          if (dr !== 0 && dc !== 0 && (!this.isFreeCell(col + dc, row) || !this.isFreeCell(col, row + dr))) {
            continue;
          }
          const next = (row + dr) * this.columns + (col + dc);
          const tentative = (cost[current] as number) + (dr !== 0 && dc !== 0 ? Math.SQRT2 : 1);
          if (tentative < (cost[next] as number)) {
            cost[next] = tentative;
            cameFrom[next] = current;
            open.push(next, tentative + heuristic(col + dc, row + dr));
          }
        }
      }
    }
    return null;
  }

  private unwind(cameFrom: Int32Array, end: number): Point[] {
    const cells: Point[] = [];
    for (let index = end; index !== -1; index = cameFrom[index] as number) {
      cells.push(this.centerOf({ col: index % this.columns, row: Math.floor(index / this.columns) }));
    }
    return cells.reverse();
  }

  /** String pulling: keep only the waypoints a walker cannot see past, so routes look like straight strides. */
  private smooth(from: Point, cells: Point[], to: Point): Point[] {
    const route = [from, ...cells.slice(1, -1), to];
    const result: Point[] = [];
    let anchor = 0;
    while (anchor < route.length - 1) {
      let farthest = anchor + 1;
      for (let candidate = route.length - 1; candidate > anchor + 1; candidate--) {
        if (this.hasLineOfSight(route[anchor] as Point, route[candidate] as Point)) {
          farthest = candidate;
          break;
        }
      }
      result.push(route[farthest] as Point);
      anchor = farthest;
    }
    return result;
  }
}

export const navGrid = new NavGrid(furniture);

/**
 * Waypoints from `from` to a station: step out of any seat onto open floor,
 * walk the grid to the station's approach point, then step onto the spot.
 */
export function planPath(from: Point, stationId: StationId, grid: NavGrid = navGrid): Point[] {
  const station = stations[stationId];
  if (distance(from, station.spot) < 0.05) {
    return [];
  }
  const start = grid.isFree(from) ? from : grid.nearestFree(from);
  const goal = grid.isFree(station.approach) ? station.approach : grid.nearestFree(station.approach);
  // No route only happens if the plan walls someone in; walking straight beats freezing in place.
  const route = grid.findPath(start, goal) ?? [goal];
  const path: Point[] = [];
  let previous = from;
  for (const point of [start, ...route, station.approach, station.spot]) {
    if (distance(previous, point) > 0.05) {
      path.push(point);
      previous = point;
    }
  }
  return path;
}
