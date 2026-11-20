import type { Cell, Coord, Direction, Puzzle, SymbolId } from "./types";

export const GEOMETRIES = [
  "identity", "rotate90", "rotate180", "rotate270",
  "mirror", "mirrorRotate90", "mirrorRotate180", "mirrorRotate270",
] as const;
export type Geometry = (typeof GEOMETRIES)[number];

const SYMBOLS: readonly SymbolId[] = ["leaf", "moon", "star", "mushroom"];

function permutations(remaining: readonly SymbolId[]): SymbolId[][] {
  if (remaining.length === 0) return [[]];
  return remaining.flatMap((symbol, index) =>
    permutations(remaining.filter((_, other) => other !== index))
      .map((suffix) => [symbol, ...suffix]),
  );
}

export const SYMBOL_PERMUTATIONS: readonly (readonly SymbolId[])[] = permutations(SYMBOLS);

export function transformCoord(coord: Coord, geometry: Geometry): Coord {
  const index = GEOMETRIES.indexOf(geometry);
  let { row, col } = coord;
  // Reflection comes first; the index within each group is the turn count.
  if (index >= 4) col = 4 - col;
  for (let turn = 0; turn < index % 4; turn++) {
    [row, col] = [col, 4 - row];
  }
  return { row, col };
}

const DIRECTION_VECTORS: Record<Direction, readonly [number, number]> = {
  north: [-1, 0],
  east: [0, 1],
  south: [1, 0],
  west: [0, -1],
};

function transformDirection(direction: Direction, geometry: Geometry): Direction {
  const index = GEOMETRIES.indexOf(geometry);
  let [dr, dc] = DIRECTION_VECTORS[direction];
  if (index >= 4) dc = -dc;
  for (let turn = 0; turn < index % 4; turn++) {
    [dr, dc] = [dc, -dr];
  }
  if (dr === -1) return "north";
  if (dc === 1) return "east";
  if (dr === 1) return "south";
  return "west";
}

export function transformTemplate(
  template: Omit<Puzzle, "version" | "seed">,
  geometry: Geometry,
  permutation: readonly SymbolId[],
): Omit<Puzzle, "version" | "seed"> {
  const mapSymbol = (symbol: SymbolId): SymbolId => permutation[SYMBOLS.indexOf(symbol)];
  const grid: Cell[][] = Array.from({ length: 5 }, () => Array<Cell>(5));
  template.grid.forEach((row, r) => row.forEach((cell, c) => {
    const target = transformCoord({ row: r, col: c }, geometry);
    grid[target.row][target.col] = cell.kind === "obstacle"
      ? { kind: "obstacle" }
      : { kind: "symbol", symbol: mapSymbol(cell.symbol) };
  }));
  return {
    grid,
    start: transformCoord(template.start, geometry),
    clues: template.clues.map((clue) => ({
      symbol: mapSymbol(clue.symbol),
      ...(clue.forbiddenDirection === undefined ? {} : {
        forbiddenDirection: transformDirection(clue.forbiddenDirection, geometry),
      }),
    })),
  };
}
