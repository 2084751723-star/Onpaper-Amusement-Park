import type { SymbolId } from "../game/types";

const paths: Record<SymbolId, string> = {
  leaf: "M19 4C9 3 3 8 5 15c1 4 7 6 11 1 3-4 3-8 3-12ZM5 20 15 9M9 16l-1-5M12 13l5 1",
  moon: "M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z",
  star: "m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z",
  mushroom: "M3 13a9 9 0 0 1 18 0H3ZM9 13v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-6M8 9h.01M13 7h.01M16 10h.01",
};

export function GameSymbol({ symbol }: { symbol: SymbolId }) {
  return (
    <svg className={`game-symbol game-symbol-${symbol}`} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={paths[symbol]} />
    </svg>
  );
}
