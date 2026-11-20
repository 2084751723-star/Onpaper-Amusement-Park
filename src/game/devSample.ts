import type { Cell, ClueView, Coord, MapView, SymbolId } from "./types";

export const DEV_SEEDS = ["D00001", "D00002"] as const;
export type DevSeed = (typeof DEV_SEEDS)[number];

const symbols: readonly (readonly (SymbolId | null)[])[] = [
  [null, "moon", "star", null, "mushroom"],
  ["star", "moon", "star", "mushroom", null],
  ["leaf", "leaf", null, "leaf", "moon"],
  ["mushroom", null, "star", "moon", "star"],
  ["leaf", "moon", "mushroom", "leaf", null],
];

const grid: readonly (readonly Cell[])[] = symbols.map((row) =>
  row.map((symbol): Cell => symbol === null ? { kind: "obstacle" } : { kind: "symbol", symbol }),
);

export const DEV_ANSWER: readonly Coord[] = [
  { row: 2, col: 0 },
  { row: 2, col: 1 },
  { row: 1, col: 1 },
  { row: 1, col: 2 },
  { row: 1, col: 3 },
  { row: 2, col: 3 },
  { row: 3, col: 3 },
];

export function getDevSample(seed: DevSeed): { mapView: MapView; clueView: ClueView } {
  const puzzleId = `DEV-1-${seed}`;
  return {
    mapView: { puzzleId, grid, start: { row: 2, col: 0 }, stepCount: 6 },
    clueView: {
      puzzleId,
      stepCount: 6,
      clues: [
        { symbol: "leaf", forbiddenDirection: "south" },
        { symbol: "moon" },
        { symbol: "star" },
        { symbol: "mushroom" },
        { symbol: "leaf" },
        { symbol: "moon", forbiddenDirection: "east" },
      ],
    },
  };
}
