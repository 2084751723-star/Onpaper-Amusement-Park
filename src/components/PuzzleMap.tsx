import { useRef, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { PuzzleMapProps, SymbolId } from "../game/types";

const symbolLabels: Record<SymbolId, string> = {
  leaf: "树叶",
  moon: "月亮",
  star: "星星",
  mushroom: "蘑菇",
};

export function PuzzleMap({ view, path, onSelectCell, printMode = false }: PuzzleMapProps) {
  const interactive = !printMode && onSelectCell !== undefined;
  const table = useRef<HTMLTableElement>(null);

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, row: number, col: number) {
    const offsets: Record<string, readonly [number, number]> = {
      ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowDown: [1, 0], ArrowLeft: [0, -1],
    };
    const offset = offsets[event.key];
    if (!offset || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    let nextRow = row + offset[0];
    let nextCol = col + offset[1];
    while (view.grid[nextRow]?.[nextCol]) {
      if (view.grid[nextRow][nextCol].kind !== "obstacle") {
        table.current?.querySelector<HTMLButtonElement>(`[data-row="${nextRow}"][data-col="${nextCol}"]`)?.focus();
        return;
      }
      nextRow += offset[0];
      nextCol += offset[1];
    }
  }

  return (
    <table ref={table} className="w-full table-fixed border-separate border-spacing-1 text-center text-foreground">
      <caption className="pb-3 text-sm text-muted-foreground">
        5×5 地图 · 上北下南，左西右东；行、列从 1 开始
        {interactive && <span className="mt-2 block">方向键移动焦点（跳过障碍），Enter 或空格选格；也可用 Tab 逐格浏览。</span>}
      </caption>
      <tbody>
        {view.grid.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, colIndex) => {
              const isStart = view.start.row === rowIndex && view.start.col === colIndex;
              const pathIndex = path.findIndex((coord) => coord.row === rowIndex && coord.col === colIndex);
              const selected = pathIndex !== -1;
              const current = selected && pathIndex === path.length - 1 && interactive;
              const symbol = cell.kind === "obstacle" ? "障碍" : symbolLabels[cell.symbol];
              const label = [
                `第 ${rowIndex + 1} 行，第 ${colIndex + 1} 列`,
                symbol,
                isStart ? "起点" : "",
                selected ? `路径序号 ${pathIndex + 1}` : "",
                current ? "当前落点" : "",
              ].filter(Boolean).join("，");
              const content = (
                <>
                  <span>{symbol}</span>
                  {isStart && <span className="text-xs">起点</span>}
                  {selected && <span className="text-xs">路径 {pathIndex + 1}{current ? " · 当前" : ""}</span>}
                </>
              );
              const cellClassName = `flex h-auto min-h-20 w-full flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-xs whitespace-normal sm:text-sm ${
                selected
                  ? "border-primary bg-secondary text-foreground"
                  : "border-border bg-background text-foreground"
              }`;

              return (
                <td key={colIndex} className="p-0 align-top" aria-label={interactive ? undefined : label}>
                  {interactive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className={cellClassName}
                      aria-label={label}
                      aria-pressed={selected}
                      aria-current={current ? "step" : undefined}
                      data-row={rowIndex}
                      data-col={colIndex}
                      onKeyDown={(event) => moveFocus(event, rowIndex, colIndex)}
                      disabled={cell.kind === "obstacle"}
                      onClick={() => onSelectCell?.({ row: rowIndex, col: colIndex })}
                    >
                      {content}
                    </Button>
                  ) : (
                    <div className={cellClassName}>{content}</div>
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
