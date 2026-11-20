import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GameSetupProps, Role } from "../game/types";

export function GameSetup({
  puzzleId,
  roleLinks,
  onNewGame,
  onSelectRole,
  onPrint,
}: GameSetupProps) {
  const inputs = useRef<Partial<Record<Role, HTMLInputElement | null>>>({});
  const [copyState, setCopyState] = useState<{
    role: Role;
    link: string;
    status: "copying" | "copied" | "error";
  } | null>(null);
  const currentCopy = copyState && copyState.link === roleLinks[copyState.role] ? copyState : null;

  async function copyLink(role: Role) {
    const link = roleLinks[role];
    setCopyState({ role, link, status: "copying" });
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(link);
      setCopyState({ role, link, status: "copied" });
    } catch {
      setCopyState({ role, link, status: "error" });
      const input = inputs.current[role];
      if (input?.value === link) {
        input.focus();
        input.select();
      }
    }
  }

  return (
    <section aria-label="角色选择" className="screen-only space-y-4 rounded-lg border border-border bg-background p-4 text-base text-foreground sm:p-6">
      <h2 className="text-xl font-semibold">题号：{puzzleId}</h2>
      <p className="text-sm text-muted-foreground">选择自己的角色，将另一角色的链接复制给搭档。</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["a", "b"] as const).map((role) => (
          <div key={role} className="min-w-0 space-y-3 rounded-lg border border-border p-4">
            <h3 className="text-lg font-semibold">{role === "a" ? "A 探路员" : "B 解读员"}</h3>
            <p className="text-sm text-muted-foreground">
              {role === "a" ? "你看地图，听搭档的线索选路。" : "你看有序线索，告诉搭档下一步怎么走。"}
            </p>
            <label className="block space-y-2 text-sm">
              <span>{role === "a" ? "A 探路员 URL" : "B 解读员 URL"}</span>
              <input
                type="text"
                readOnly
                ref={(element) => { inputs.current[role] = element; }}
                value={roleLinks[role]}
                onFocus={(event) => event.currentTarget.select()}
                className="block min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 py-2 text-base text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11" onClick={() => onSelectRole(role)}>
                {role === "a" ? "我是 A 探路员" : "我是 B 解读员"}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" disabled={currentCopy?.status === "copying"} onClick={() => void copyLink(role)}>
                复制 {role.toUpperCase()} 链接
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">两人打开同一题号的不同角色链接，不必在同一设备上。网页不提供实时同步。</p>
      {currentCopy && (
        <p role="status" aria-live="polite" aria-atomic="true" className="text-sm">
          {currentCopy.status === "copying" ? "正在复制链接…" : currentCopy.status === "copied"
            ? `${currentCopy.role.toUpperCase()} 链接已复制，请发送给对应角色的玩家。`
            : "自动复制不可用，已选中链接，请手动复制（Ctrl+C / ⌘C，手机长按复制）。"}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={onNewGame}>切换开发样例</Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={onPrint}>打印预览</Button>
      </div>
    </section>
  );
}
