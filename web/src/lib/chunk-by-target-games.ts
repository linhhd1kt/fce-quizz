export function chunkByTargetGames<T>(questions: T[], targetGames: number): T[][] {
  const total = questions.length;
  const games = Math.max(1, targetGames);
  const base = Math.floor(total / games);
  const remainder = total % games;
  const chunks: T[][] = [];
  let offset = 0;
  for (let i = 0; i < games; i++) {
    const size = i < remainder ? base + 1 : base;
    if (size === 0) break;
    chunks.push(questions.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
}
