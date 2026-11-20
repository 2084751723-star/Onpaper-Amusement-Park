import { Button } from "@/components/ui/button";
import type { Direction, RolePanelProps, SymbolId } from "../game/types";
import { PuzzleMap } from "./PuzzleMap";
import { GameSymbol } from "./GameSymbol";

const symbolLabels: Record<SymbolId, string> = {
  leaf: "树叶",
  moon: "月亮",
  star: "星星",
  mushroom: "蘑菇",
};
const directionLabels: Record<Direction, string> = {
  north: "北（上）",
  east: "东（右）",
  south: "南（下）",
  west: "西（左）",
};

export function RolePanel(props: RolePanelProps) {
  if (props.role === "b") {
    return (
      <section aria-label="B 解读员" className="forest-panel forest-clues space-y-4 text-base text-foreground">
        <p className="forest-eyebrow">你的任务 · 读懂线索</p>
        <h2 className="text-xl font-semibold">B 解读员</h2>
        <p className="text-sm text-muted-foreground">题号：{props.view.puzzleId}</p>
        <p>共 {props.view.stepCount} 步，按顺序告诉搭档下一格的符号与禁止方向。</p>
        <p className="text-sm text-muted-foreground">先核对题号。你看不到地图，请和搭档通过通话交流；每条线索对应从当前格走出的一步，方向以上北下南为准。</p>
        <ol aria-label="有序线索" className="forest-clue-list list-decimal space-y-3 pl-6">
          {props.view.clues.map((clue, index) => (
            <li key={index} className="pl-1">
              <div className="forest-clue-content">
                <GameSymbol symbol={clue.symbol} />
                <span className="font-medium">{symbolLabels[clue.symbol]}</span>
                {clue.forbiddenDirection && (
                  <span className="forest-direction">禁止向{directionLabels[clue.forbiddenDirection]}</span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section aria-label="A 探路员" className="forest-panel space-y-4 text-base text-foreground">
      <p className="forest-eyebrow">你的任务 · 探索地图</p>
      <h2 className="text-xl font-semibold">A 探路员</h2>
      <p className="text-sm text-muted-foreground">题号：{props.view.puzzleId}</p>
      <p className="text-sm text-muted-foreground">你只看地图。听搭档逐条读线索，从起点正交移动，不穿障碍、不重复格子；点错可撤销。</p>
      <p className="forest-progress" aria-live="polite" aria-atomic="true">已走 {Math.max(0, props.path.length - 1)} 步 / 共 {props.view.stepCount} 步（不含起点）</p>
      <PuzzleMap view={props.view} path={props.path} onSelectCell={props.onSelectCell} />
      <div className="forest-actions flex flex-wrap gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={props.onUndo} disabled={props.path.length <= 1}>撤销</Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={props.onClear} disabled={props.path.length <= 1}>清空</Button>
        <Button type="button" className="min-h-11" onClick={props.onSubmit}>提交路径</Button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className={`min-h-6 ${props.submission.status === "error" ? "font-medium text-destructive" : ""}`}>{props.submission.message}</p>
    </section>
  );
}
