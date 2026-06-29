import { describe, it, expect, vi } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/server-auth', () => ({ getAuthUserId: vi.fn() }));
vi.mock('@/db/client', () => ({ db: {} }));
vi.mock('@/db/schema', () => ({}));

import {
  parsePageRange,
  normalizeQuestion,
  extractJSON,
  isScanned,
} from './route';

// ---------------------------------------------------------------------------
// parsePageRange
// ---------------------------------------------------------------------------
describe('parsePageRange', () => {
  it('parses a single page number', () => {
    expect(parsePageRange('5')).toEqual([{ from: 5, to: 5 }]);
  });

  it('parses a range like "3-7"', () => {
    expect(parsePageRange('3-7')).toEqual([{ from: 3, to: 7 }]);
  });

  it('parses multiple comma-separated entries', () => {
    expect(parsePageRange('1-3, 8, 10-12')).toEqual([
      { from: 1, to: 3 },
      { from: 8, to: 8 },
      { from: 10, to: 12 },
    ]);
  });

  it('ignores reversed ranges where from > to', () => {
    expect(parsePageRange('7-3')).toEqual([]);
  });

  it('ignores malformed parts that are not digits', () => {
    expect(parsePageRange('abc, 5, foo-bar')).toEqual([{ from: 5, to: 5 }]);
  });

  it('returns empty array for empty string', () => {
    expect(parsePageRange('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parsePageRange('   ')).toEqual([]);
  });

  it('handles leading/trailing whitespace around entries', () => {
    expect(parsePageRange('  2 , 4-6  ')).toEqual([
      { from: 2, to: 2 },
      { from: 4, to: 6 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// isScanned
// ---------------------------------------------------------------------------
describe('isScanned', () => {
  it('returns true when average chars per page < 100 (scanned PDF)', () => {
    // 50 chars / 2 pages = 25 chars/page → scanned
    expect(isScanned('a'.repeat(50), 2)).toBe(true);
  });

  it('returns false when average chars per page >= 100 (text PDF)', () => {
    // 1000 chars / 5 pages = 200 chars/page → text
    expect(isScanned('a'.repeat(1000), 5)).toBe(false);
  });

  it('treats 0 pages as 1 page to avoid division by zero', () => {
    // 50 chars / max(0,1) = 50 → scanned
    expect(isScanned('a'.repeat(50), 0)).toBe(true);
  });

  it('returns true (scanned) for 0 chars with 0 pages (0/1 = 0 < 100)', () => {
    // 0 chars / 1 page = 0 → scanned
    expect(isScanned('', 0)).toBe(true);
  });

  it('exactly 100 chars per page returns false (boundary: not scanned)', () => {
    // 100/1 = 100, not < 100
    expect(isScanned('a'.repeat(100), 1)).toBe(false);
  });

  it('99 chars per page returns true (boundary: scanned)', () => {
    expect(isScanned('a'.repeat(99), 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// normalizeQuestion
// ---------------------------------------------------------------------------
describe('normalizeQuestion', () => {
  it('returns the question unchanged when options have no prefixes', () => {
    const q = {
      options: ['made', 'put', 'given', 'got'],
      answer: 'put',
    };
    expect(normalizeQuestion(q)).toEqual(q);
  });

  it('strips "A. " / "B. " / "C. " / "D. " prefixes from options', () => {
    const q = {
      options: ['A. made', 'B. put', 'C. given', 'D. got'],
      answer: 'put',
    };
    const result = normalizeQuestion(q);
    expect(result.options).toEqual(['made', 'put', 'given', 'got']);
  });

  it('strips "A) " / "B) " prefixes from options', () => {
    const q = {
      options: ['A) first', 'B) second', 'C) third'],
      answer: 'second',
    };
    const result = normalizeQuestion(q);
    expect(result.options).toEqual(['first', 'second', 'third']);
  });

  it('also strips prefix from the answer string', () => {
    const q = {
      options: ['A. made', 'B. put', 'C. given', 'D. got'],
      answer: 'B. put',
    };
    const result = normalizeQuestion(q);
    expect(result.answer).toBe('put');
  });

  it('maps a letter-only answer "A" to the first option after stripping', () => {
    const q = {
      options: ['A. alpha', 'B. beta', 'C. gamma'],
      answer: 'A',
    };
    const result = normalizeQuestion(q);
    expect(result.answer).toBe('alpha');
  });

  it('maps letter-only answer "C" to the third option', () => {
    const q = {
      options: ['A. alpha', 'B. beta', 'C. gamma'],
      answer: 'C',
    };
    const result = normalizeQuestion(q);
    expect(result.answer).toBe('gamma');
  });

  it('maps lowercase letter answer "a" to the first option', () => {
    const q = {
      options: ['A. alpha', 'B. beta', 'C. gamma'],
      answer: 'a',
    };
    const result = normalizeQuestion(q);
    expect(result.answer).toBe('alpha');
  });

  it('returns unchanged if options array has fewer than 2 items', () => {
    const q = { options: ['only'], answer: 'only' };
    expect(normalizeQuestion(q)).toEqual(q);
  });

  it('returns unchanged if options is not an array', () => {
    const q = { options: 'not an array', answer: 'x' };
    expect(normalizeQuestion(q)).toEqual(q);
  });

  it('preserves other fields on the question object', () => {
    const q = {
      id: 'q-1',
      type: 'multiple-choice',
      text: 'Choose:',
      options: ['A. yes', 'B. no'],
      answer: 'A',
      explanation: 'Because yes',
    };
    const result = normalizeQuestion(q);
    expect(result.id).toBe('q-1');
    expect(result.type).toBe('multiple-choice');
    expect(result.text).toBe('Choose:');
    expect(result.explanation).toBe('Because yes');
  });
});

// ---------------------------------------------------------------------------
// extractJSON
// ---------------------------------------------------------------------------
describe('extractJSON', () => {
  it('parses a plain valid JSON string directly', () => {
    const json = JSON.stringify({ title: 'Test', questions: [] });
    expect(extractJSON(json)).toEqual({ title: 'Test', questions: [] });
  });

  it('parses JSON wrapped in ```json markdown fences', () => {
    const text = '```json\n{"title":"Quiz","questions":[]}\n```';
    expect(extractJSON(text)).toEqual({ title: 'Quiz', questions: [] });
  });

  it('parses JSON wrapped in plain ``` fences', () => {
    const text = '```\n{"title":"Q","questions":[]}\n```';
    expect(extractJSON(text)).toEqual({ title: 'Q', questions: [] });
  });

  it('extracts first {...} block from surrounding text', () => {
    const text = 'Some preamble {"title":"X","questions":[]} trailing text';
    expect(extractJSON(text)).toEqual({ title: 'X', questions: [] });
  });

  it('returns {} for completely unparseable input', () => {
    expect(extractJSON('this is not json at all')).toEqual({});
  });

  it('returns {} for empty string', () => {
    expect(extractJSON('')).toEqual({});
  });

  it('returns {} when braces are present but content is invalid', () => {
    expect(extractJSON('{ not : valid : json }')).toEqual({});
  });

  it('parses JSON with actual questions array', () => {
    const data = {
      title: 'FCE Reading',
      questions: [
        {
          id: 'q-1',
          type: 'multiple-choice',
          text: 'Which word fits?',
          options: ['made', 'put', 'given', 'got'],
          answer: 'put',
          explanation: 'Put is correct.',
        },
      ],
    };
    expect(extractJSON(JSON.stringify(data))).toEqual(data);
  });
});
