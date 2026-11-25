export type Aresta = { a: number; b: number; s: number };

export function parseVetor(v: string | null): number[] | null {
  if (!v) return null;
  try {
    return JSON.parse(v) as number[];
  } catch {
    return null;
  }
}

export function produto(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

export function calcularLayout(n: number, arestas: Aresta[], L: number, A: number) {
  const pos = Array.from({ length: n }, (_, i) => {
    const ang = (i / Math.max(n, 1)) * Math.PI * 2;
    return { x: L / 2 + Math.cos(ang) * L * 0.25, y: A / 2 + Math.sin(ang) * A * 0.28 };
  });
  const escala = L / 800;
  for (let it = 0; it < 250; it++) {
    const f = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = Math.max(dx * dx + dy * dy, 25);
        const r = (6000 * escala * escala) / d2;
        const d = Math.sqrt(d2);
        f[i].x += (dx / d) * r;
        f[i].y += (dy / d) * r;
        f[j].x -= (dx / d) * r;
        f[j].y -= (dy / d) * r;
      }
    }
    for (const e of arestas) {
      const dx = pos[e.b].x - pos[e.a].x;
      const dy = pos[e.b].y - pos[e.a].y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = (d - 90 * escala) * 0.02 * (0.5 + e.s);
      f[e.a].x += (dx / d) * k;
      f[e.a].y += (dy / d) * k;
      f[e.b].x -= (dx / d) * k;
      f[e.b].y -= (dy / d) * k;
    }
    for (let i = 0; i < n; i++) {
      f[i].x += (L / 2 - pos[i].x) * 0.01;
      f[i].y += (A / 2 - pos[i].y) * 0.01;
      const passo = 12 * escala;
      pos[i].x = Math.min(L - 24, Math.max(24, pos[i].x + Math.max(-passo, Math.min(passo, f[i].x))));
      pos[i].y = Math.min(A - 24, Math.max(24, pos[i].y + Math.max(-passo, Math.min(passo, f[i].y))));
    }
  }
  return pos;
}
