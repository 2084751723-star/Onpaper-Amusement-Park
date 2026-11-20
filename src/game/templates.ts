import type { Cell, Puzzle, SymbolId } from "./types";

const symbols: Record<string, SymbolId> = { L: "leaf", M: "moon", S: "star", U: "mushroom" };

export const BASE_TEMPLATES: readonly Omit<Puzzle, "version" | "seed">[] = [
  {
    grid: ["ULSML", "LMLSU", "SL#LS", "USMML", "L#LSU"].map((row) =>
      [...row].map((symbol): Cell => symbol === "#" ? { kind: "obstacle" } : { kind: "symbol", symbol: symbols[symbol] }),
    ),
    start: { row: 2, col: 0 },
    clues: [
      { symbol: "leaf" },
      { symbol: "mushroom" },
      { symbol: "leaf" },
      { symbol: "moon" },
      { symbol: "leaf", forbiddenDirection: "east" },
      { symbol: "star" },
    ],
  },
  {
    grid: ["LS#UM", "UMSL#", "M#LUS", "SLMUL", "UMLS#"].map((row) =>
      [...row].map((symbol): Cell => symbol === "#" ? { kind: "obstacle" } : { kind: "symbol", symbol: symbols[symbol] }),
    ),
    start: { row: 4, col: 0 },
    clues: [
      { symbol: "star" },
      { symbol: "moon" },
      { symbol: "mushroom" },
      { symbol: "moon" },
      { symbol: "star" },
      { symbol: "leaf", forbiddenDirection: "east" },
      { symbol: "mushroom" },
      { symbol: "star" },
    ],
  },
];
