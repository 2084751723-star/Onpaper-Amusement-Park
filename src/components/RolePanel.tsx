import { Button } from "@/components/ui/button";
import type { Direction, RolePanelProps, SymbolId } from "../game/types";
import { PuzzleMap } from "./PuzzleMap";

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
      <section aria-label="B 解读员" className="space-y-4 text-base text-foreground">
        <h2 className="text-xl font-semibold">B 解读员</h2>
        <p className="text-sm text-muted-foreground">题号：{props.view.puzzleId}</p>
        <p>共 {props.view.stepCount} 步，按顺序告诉搭档下一格的符号与禁止方向。</p>
        <ol className="list-decimal space-y-3 pl-6">
          {props.view.clues.map((clue, index) => (
            <li key={index} className="pl-1">
              <span className="font-medium">{symbolLabels[clue.symbol]}</span>
              {clue.forbiddenDirection && (
                <span> · 禁止向{directionLabels[clue.forbiddenDirection]}</span>
              )}
            </li>
          ))}
        </ol>
      </section>
    );
  }

  return (
    <section aria-label="A 探路员" className="space-y-4 text-base text-foreground">
      <h2 className="text-xl font-semibold">A 探路员</h2>
      <p className="text-sm text-muted-foreground">题号：{props.view.puzzleId}</p>
      <p>已走 {Math.max(0, props.path.length - 1)} 步 / 共 {props.view.stepCount} 步（不含起点）</p>
      <PuzzleMap view={props.view} path={props.path} onSelectCell={props.onSelectCell} />
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={props.onUndo} disabled={props.path.length <= 1}>撤销</Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={props.onClear} disabled={props.path.length <= 1}>清空</Button>
        <Button type="button" className="min-h-11" onClick={props.onSubmit}>提交路径</Button>
      </div>
      <p role="status" aria-live="polite" aria-atomic="true" className="min-h-6">{props.submission.message}</p>
    </section>
  );
}
