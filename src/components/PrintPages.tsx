import type { PrintPagesProps } from "../game/types";
import { PuzzleMap } from "./PuzzleMap";
import { RolePanel } from "./RolePanel";
import "../print.css";

export function PrintPages({ mapView, clueView, answer }: PrintPagesProps) {
  return (
    <div className="print-pages">
      <article className="print-page" data-print-role="a" aria-label="A 探路员打印页">
        <h2 className="text-xl font-semibold">A 探路员 · 地图</h2>
        <p>失落森林 · 双人协作解谜，请只查看自己的角色页</p>
        <p>题号：{mapView.puzzleId} · 共 {mapView.stepCount} 步（不含起点）</p>
        <PuzzleMap view={mapView} path={[]} printMode />
      </article>
      <article className="print-page" data-print-role="b" aria-label="B 解读员打印页">
        <p>失落森林 · 双人协作解谜，请只查看自己的角色页</p>
        <RolePanel role="b" view={clueView} />
      </article>
      {answer !== undefined && (
        <article className="print-page" data-print-role="answer" aria-label="本题答案打印页">
          <h2 className="text-xl font-semibold">本题答案</h2>
          <p>请在完成挑战后核对；路径序号含起点。</p>
          <p>题号：{mapView.puzzleId}</p>
          <PuzzleMap view={mapView} path={answer} printMode />
          <h3 className="text-lg font-medium">路径坐标（含起点，行、列从 1 开始）</h3>
          <ol className="list-decimal space-y-1 pl-6">
            {answer.map((coord, index) => (
              <li key={index}>第 {coord.row + 1} 行，第 {coord.col + 1} 列</li>
            ))}
          </ol>
        </article>
      )}
    </div>
  );
}
