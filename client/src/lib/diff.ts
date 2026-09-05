// Word-level diff. Small inputs only (answer paragraphs), so a plain LCS table is fine.
export type Seg = { type: 'same' | 'add' | 'del'; text: string };

function tokens(s: string): string[] {
  return s.match(/\S+\s*|\s+/g) ?? [];
}

export function wordDiff(before: string, after: string): Seg[] {
  const a = tokens(before);
  const b = tokens(after);
  const n = a.length;
  const m = b.length;
  if (n * m > 250_000) return [{ type: 'same', text: after }];
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i].trim() === b[j].trim() ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: Seg[] = [];
  let i = 0;
  let j = 0;
  const push = (type: Seg['type'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  while (i < n && j < m) {
    if (a[i].trim() === b[j].trim()) {
      push('same', b[j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('del', a[i]);
      i++;
    } else {
      push('add', b[j]);
      j++;
    }
  }
  while (i < n) push('del', a[i++]);
  while (j < m) push('add', b[j++]);
  return out;
}

export function changedShare(segs: Seg[]): number {
  let changed = 0;
  let total = 0;
  for (const s of segs) {
    const w = s.text.trim() ? s.text.trim().split(/\s+/).length : 0;
    total += w;
    if (s.type !== 'same') changed += w;
  }
  return total ? changed / total : 0;
}
