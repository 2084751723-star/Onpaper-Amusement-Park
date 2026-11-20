import { BASE_TEMPLATES } from "./templates";
import type { ClueView, Coord, Direction, MapView, PathValidation, Puzzle, PuzzleSession, Role } from "./types";

export function generatePuzzle(session: PuzzleSession): Puzzle {
  if (session.version !== "1") throw new Error("不支持此题目版本。");
  if (!/^[0-9a-fA-F]{6}$/.test(session.seed) || session.seed.length !== 6) {
    throw new Error("题目种子必须是六位十六进制。");
  }
  return { ...structuredClone(BASE_TEMPLATES[0]), version: "1", seed: session.seed.toUpperCase() };
}

export function getRoleView(puzzle: Puzzle, role: "a"): MapView;
export function getRoleView(puzzle: Puzzle, role: "b"): ClueView;
export function getRoleView(puzzle: Puzzle, role: Role): MapView | ClueView;
export function getRoleView(puzzle: Puzzle, role: Role): MapView | ClueView {
  const shared = { puzzleId: `${puzzle.version}-${puzzle.seed}`, stepCount: puzzle.clues.length };
  if (role === "a") return { ...shared, grid: structuredClone(puzzle.grid), start: { ...puzzle.start } };
  return { ...shared, clues: puzzle.clues.map((clue) => ({ ...clue })) };
}

export function validatePath(puzzle: Puzzle, path: readonly Coord[]): PathValidation {
  if (!Array.isArray(path) || path.length !== puzzle.clues.length + 1) {
    return { valid: false, code: "length", message: `路径需包含起点和 ${puzzle.clues.length} 步移动。` };
  }
  for (const coord of path) {
    if (!coord || !Number.isInteger(coord.row) || !Number.isInteger(coord.col)
      || coord.row < 0 || coord.row >= 5 || coord.col < 0 || coord.col >= 5) {
      return { valid: false, code: "bounds", message: "路径包含地图范围之外的格子。" };
    }
  }
  if (path[0].row !== puzzle.start.row || path[0].col !== puzzle.start.col) {
    return { valid: false, code: "start", message: "路径必须从地图起点开始。" };
  }
  const visited = new Set<number>();
  for (let index = 0; index < path.length; index++) {
    const coord = path[index];
    const key = coord.row * 5 + coord.col;
    const cell = puzzle.grid[coord.row][coord.col];
    if (cell.kind === "obstacle") return { valid: false, code: "obstacle", message: "路径不能穿过障碍。" };
    if (visited.has(key)) return { valid: false, code: "revisit", message: "路径不能重复经过同一格。" };
    visited.add(key);
    if (index === 0) continue;
    const previous = path[index - 1];
    const rowDelta = coord.row - previous.row;
    const colDelta = coord.col - previous.col;
    if (Math.abs(rowDelta) + Math.abs(colDelta) !== 1) {
      return { valid: false, code: "adjacency", message: "每步只能上下左右移动一格。" };
    }
    const clue = puzzle.clues[index - 1];
    if (cell.symbol !== clue.symbol) return { valid: false, code: "symbol", message: `第 ${index} 步的符号与线索不符。` };
    const direction: Direction = rowDelta === -1 ? "north" : rowDelta === 1 ? "south" : colDelta === 1 ? "east" : "west";
    if (direction === clue.forbiddenDirection) return { valid: false, code: "direction", message: `第 ${index} 步违反方向限制。` };
  }
  return { valid: true };
}
