export type SortDirection = 'asc' | 'desc';

/** 등락률 필드를 가진 아무 객체 */
export interface HasChangeRate {
  changeRate: number;
}

/**
 * 등락률 비교자. 기본은 내림차순(상승률 큰 순).
 * 같은 값이면 0 을 돌려주므로 Array.prototype.sort 의 안정 정렬에 맡긴다.
 */
export function compareByChange<T extends HasChangeRate>(a: T, b: T, direction: SortDirection = 'desc'): number {
  const diff = a.changeRate - b.changeRate;
  if (diff === 0) return 0;
  return direction === 'desc' ? -diff : diff;
}

/** 원본을 건드리지 않고 등락률 순으로 정렬한 새 배열을 돌려준다. */
export function sortByChange<T extends HasChangeRate>(items: readonly T[], direction: SortDirection = 'desc'): T[] {
  return [...items].sort((a, b) => compareByChange(a, b, direction));
}

/** 헤더를 눌렀을 때의 다음 방향. 첫 클릭은 내림차순(상승률 큰 순), 그다음부터는 반대 방향으로 오간다. */
export function toggleDirection(current: SortDirection | null): SortDirection {
  return current === 'desc' ? 'asc' : 'desc';
}

/** 저장소에서 읽은 값처럼 출처를 믿을 수 없는 값이 정렬 방향인지 판별한다. */
export function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc';
}
