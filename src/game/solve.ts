import type { Coord, Direction, Puzzle } from "./types";

const MOVES: readonly (readonly [Direction, number, number])[] = [
  ["north", -1, 0],
  ["east", 0, 1],
  ["south", 1, 0],
  ["west", 0, -1],
];

export function solvePuzzle(
  puzzle: Puzzle,
  limit = 2,
): readonly (readonly Coord[])[] {
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new RangeError("limit must be a positive safe integer");
  }

  const solutions: Coord[][] = [];
  const path: Coord[] = [{ ...puzzle.start }];
  const visited = puzzle.grid.map((row) => row.map(() => false));
  visited[puzzle.start.row][puzzle.start.col] = true;

  function search(step: number): void {
    if (solutions.length >= limit) return;
    if (step === puzzle.clues.length) {
      solutions.push(path.map((coord) => ({ ...coord })));
      return;
    }

    const current = path[path.length - 1];
    const clue = puzzle.clues[step];
    for (const [direction, deltaRow, deltaCol] of MOVES) {
      if (direction === clue.forbiddenDirection) continue;
      const row = current.row + deltaRow;
      const col = current.col + deltaCol;
      if (row < 0 || row >= puzzle.grid.length) continue;
      if (col < 0 || col >= puzzle.grid[row].length) continue;
      const cell = puzzle.grid[row][col];
      if (cell.kind !== "symbol" || cell.symbol !== clue.symbol || visited[row][col]) continue;

      visited[row][col] = true;
      path.push({ row, col });
      search(step + 1);
      path.pop();
      visited[row][col] = false;
      if (solutions.length >= limit) return;
    }
  }

  search(0);
  return solutions;
}
