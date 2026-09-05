import { describe, expect, it } from 'vitest';
import { SORT_STATE_KEY, readSortState, writeSortState, type SortStorage } from '../src/lib/sortState';

/** 테스트용 메모리 저장소 */
function memoryStorage(initial: Record<string, string> = {}): SortStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

describe('sortState', () => {
  it('저장한 방향을 그대로 읽는다', () => {
    const storage = memoryStorage();
    writeSortState('asc', storage);
    expect(readSortState(storage)).toBe('asc');
    expect(storage.data.get(SORT_STATE_KEY)).toBe('asc');
  });

  it('저장값이 없으면 null 이다', () => {
    expect(readSortState(memoryStorage())).toBe(null);
  });

  it('저장값이 깨져 있으면 null 로 취급한다', () => {
    expect(readSortState(memoryStorage({ [SORT_STATE_KEY]: 'DESC' }))).toBe(null);
    expect(readSortState(memoryStorage({ [SORT_STATE_KEY]: '{"dir":"asc"}' }))).toBe(null);
  });

  it('null 을 쓰면 키를 지운다', () => {
    const storage = memoryStorage({ [SORT_STATE_KEY]: 'desc' });
    writeSortState(null, storage);
    expect(storage.data.has(SORT_STATE_KEY)).toBe(false);
    expect(readSortState(storage)).toBe(null);
  });

  it('저장소가 없으면 읽기는 null, 쓰기는 조용히 넘어간다', () => {
    expect(readSortState(null)).toBe(null);
    expect(() => writeSortState('desc', null)).not.toThrow();
  });

  it('저장소가 예외를 던져도 화면을 멈추지 않는다', () => {
    const broken: SortStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect(readSortState(broken)).toBe(null);
    expect(() => writeSortState('asc', broken)).not.toThrow();
    expect(() => writeSortState(null, broken)).not.toThrow();
  });
});
