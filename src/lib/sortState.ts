// 관심종목 정렬 상태 보관 모듈. localStorage 를 직접 만지는 곳은 이 파일뿐이다.
import { isSortDirection, type SortDirection } from './sortByChange';

/** 정렬 방향을 보관하는 localStorage 키. 값은 'asc' | 'desc' */
export const SORT_STATE_KEY = 'hanwha-mts.watchlist.sort';

/** 테스트에서 바꿔 끼울 수 있게 Storage 의 세 메서드만 요구한다 */
export type SortStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 브라우저 localStorage. 없는 환경(테스트·SSR)이거나 접근이 막혀 있으면 null */
function defaultStorage(): SortStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 저장된 정렬 방향. 저장값이 없거나 깨졌거나 저장소가 없으면 null(정렬 안 함) */
export function readSortState(storage: SortStorage | null = defaultStorage()): SortDirection | null {
  try {
    const value = storage?.getItem(SORT_STATE_KEY);
    return isSortDirection(value) ? value : null;
  } catch {
    return null;
  }
}

/** 정렬 방향을 저장한다. null 이면 키를 지운다. 저장소가 막혀 있어도 화면은 계속 동작한다 */
export function writeSortState(direction: SortDirection | null, storage: SortStorage | null = defaultStorage()): void {
  try {
    if (direction === null) storage?.removeItem(SORT_STATE_KEY);
    else storage?.setItem(SORT_STATE_KEY, direction);
  } catch {
    // 프라이빗 모드 등 쓰기가 막힌 경우: 정렬은 이번 세션에서만 유지된다
  }
}
