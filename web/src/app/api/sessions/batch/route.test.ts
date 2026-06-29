import { describe, it, expect } from 'vitest';
import { chunkByTargetGames } from '@/lib/chunk-by-target-games';

describe('chunkByTargetGames', () => {
  it('splits 50 questions into 4 games evenly [13,13,12,12]', () => {
    const qs = Array.from({ length: 50 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 4);
    expect(chunks.map(c => c.length)).toEqual([13, 13, 12, 12]);
  });

  it('splits 10 questions into 3 games [4,3,3]', () => {
    const qs = Array.from({ length: 10 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 3);
    expect(chunks.map(c => c.length)).toEqual([4, 3, 3]);
  });

  it('targetGames > total: returns one question per game, skips empties', () => {
    const qs = Array.from({ length: 3 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 10);
    expect(chunks.length).toBe(3);
    expect(chunks.every(c => c.length === 1)).toBe(true);
  });

  it('targetGames = 0 treated as 1', () => {
    const qs = Array.from({ length: 5 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 0);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(5);
  });

  it('targetGames = 1 returns single chunk with all questions', () => {
    const qs = Array.from({ length: 7 }, (_, i) => i);
    const chunks = chunkByTargetGames(qs, 1);
    expect(chunks.length).toBe(1);
    expect(chunks[0].length).toBe(7);
  });
});
