/**
 * The changed lines of `after` against `before`, as `- ` and `+ ` lines with no context, by the
 * longest common subsequence walk of spec/cli.md §5.19 (a tie removes first).
 */
export function lineDiff(before: string, after: string): string[] {
  const o = before.replace(/\r\n/g, "\n").split("\n");
  const n = after.replace(/\r\n/g, "\n").split("\n");
  const L = Array.from({ length: o.length + 1 }, () => new Array<number>(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i -= 1) {
    for (let j = n.length - 1; j >= 0; j -= 1) L[i]![j] = o[i] === n[j] ? L[i + 1]![j + 1]! + 1 : Math.max(L[i + 1]![j]!, L[i]![j + 1]!);
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < o.length && j < n.length) {
    if (o[i] === n[j]) { i += 1; j += 1; }
    else if (L[i + 1]![j]! >= L[i]![j + 1]!) out.push(`- ${o[i++]}`);
    else out.push(`+ ${n[j++]}`);
  }
  while (i < o.length) out.push(`- ${o[i++]}`);
  while (j < n.length) out.push(`+ ${n[j++]}`);
  return out;
}
