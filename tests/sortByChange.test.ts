import { describe, expect, it } from 'vitest';
import { compareByChange, isSortDirection, sortByChange, toggleDirection } from '../src/lib/sortByChange';

const items = [
  { symbol: 'A', changeRate: 0.5 },
  { symbol: 'B', changeRate: -2.1 },
  { symbol: 'C', changeRate: 3.4 },
  { symbol: 'D', changeRate: 0 },
];

describe('compareByChange', () => {
  it('기본은 내림차순이다', () => {
    expect(compareByChange(items[2], items[0])).toBeLessThan(0);
    expect(compareByChange(items[1], items[3])).toBeGreaterThan(0);
  });

  it('오름차순을 지정할 수 있다', () => {
    expect(compareByChange(items[2], items[0], 'asc')).toBeGreaterThan(0);
  });

  it('같은 값은 0 을 돌려준다', () => {
    expect(compareByChange({ changeRate: 1 }, { changeRate: 1 })).toBe(0);
  });
});

describe('sortByChange', () => {
  it('등락률 큰 순으로 정렬한다', () => {
    expect(sortByChange(items).map((i) => i.symbol)).toEqual(['C', 'A', 'D', 'B']);
  });

  it('오름차순으로도 정렬한다', () => {
    expect(sortByChange(items, 'asc').map((i) => i.symbol)).toEqual(['B', 'D', 'A', 'C']);
  });

  it('원본 배열을 건드리지 않는다', () => {
    const copy = [...items];
    sortByChange(items);
    expect(items).toEqual(copy);
  });

  it('같은 등락률은 원래 순서를 유지한다', () => {
    const ties = [
      { id: 1, changeRate: 1 },
      { id: 2, changeRate: 1 },
      { id: 3, changeRate: 2 },
    ];
    expect(sortByChange(ties).map((t) => t.id)).toEqual([3, 1, 2]);
  });
});

describe('toggleDirection', () => {
  it('정렬 전(null)에서 첫 클릭은 내림차순이다', () => {
    expect(toggleDirection(null)).toBe('desc');
  });

  it('내림차순 ↔ 오름차순을 오간다', () => {
    expect(toggleDirection('desc')).toBe('asc');
    expect(toggleDirection('asc')).toBe('desc');
  });
});

describe('isSortDirection', () => {
  it("'asc' 와 'desc' 만 정렬 방향이다", () => {
    expect(isSortDirection('asc')).toBe(true);
    expect(isSortDirection('desc')).toBe(true);
  });

  it('그 밖의 값은 정렬 방향이 아니다', () => {
    expect(isSortDirection(null)).toBe(false);
    expect(isSortDirection(undefined)).toBe(false);
    expect(isSortDirection('')).toBe(false);
    expect(isSortDirection('DESC')).toBe(false);
    expect(isSortDirection(1)).toBe(false);
  });
});
