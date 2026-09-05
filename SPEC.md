# SPEC.md — 관심종목 정렬

계획 세션에서 채우고, 커밋한 뒤 세션을 완전히 종료한다. 새 세션은 이 파일만 읽고 구현을 시작한다.
네 칸을 전부 채운다. 빈 칸이 있으면 새 세션이 되묻는다.

요구사항 원본: `docs/templates/requirements-card.md`

## 1. 대상 파일

손대는 파일을 경로로 적는다. 여기 없는 파일은 손대지 않는다. 새로 만드는 파일은 `(신규)`를 붙인다.

| 파일 | 무엇을 바꾸는가 |
|---|---|
| `src/screens/Watchlist.tsx` | 목록 위에 헤더 행(종목 / 등락률)을 추가한다. "등락률" 칸 클릭 핸들러, 정렬 상태 읽기·쓰기 호출, 정렬된 순서로 행 그리기, 현재 방향 표시(▼ 내림차순 · ▲ 오름차순) |
| `src/lib/sortState.ts` (신규) | 정렬 상태 보관 모듈. `localStorage` 키 하나에 방향을 저장하고 읽는다. 화면 계층은 이 모듈의 읽기·쓰기 함수만 부른다 |
| `src/lib/sortByChange.ts` | 방향 전환 함수와 방향 값 판별 함수를 추가한다. 기존 `compareByChange` · `sortByChange` 는 시그니처를 바꾸지 않는다 |
| `src/styles.css` | 헤더 행(`.wl-head`) 스타일 추가. 새 CSS 파일을 만들지 않는다 |
| `tests/sortByChange.test.ts` | 추가한 두 함수의 테스트 |
| `tests/sortState.test.ts` (신규) | 읽기·쓰기 왕복, 저장값이 깨졌을 때, 저장소가 없을 때 |

## 2. 인터페이스

새로 만들거나 바꾸는 함수·타입·props 의 이름과 시그니처를 적는다. 구현이 아니라 이름과 입출력만 적는다.

```ts
// src/lib/sortByChange.ts — 기존 export 유지 (SortDirection, HasChangeRate, compareByChange, sortByChange)
export function toggleDirection(current: SortDirection | null): SortDirection
//   null → 'desc' (첫 클릭은 상승률 큰 순) · 'desc' → 'asc' · 'asc' → 'desc'
export function isSortDirection(value: unknown): value is SortDirection

// src/lib/sortState.ts (신규)
export const SORT_STATE_KEY: string                       // localStorage 키
export type SortStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export function readSortState(storage?: SortStorage | null): SortDirection | null
//   저장값이 없거나 'asc' | 'desc' 가 아니면 null. storage 가 없거나 예외를 던져도 null
export function writeSortState(direction: SortDirection | null, storage?: SortStorage | null): void
//   null 이면 키를 지운다. storage 가 없거나 예외를 던져도 조용히 넘어간다

// src/screens/Watchlist.tsx — props 변경 없음 (items · quotes · selected · onSelect 그대로)
//   내부 상태: direction: SortDirection | null (초기값 readSortState())
//   handleSortClick(): direction 을 toggleDirection 으로 바꾸고 writeSortState 로 저장
```

## 3. 범위 밖

이 작업에서 하지 않는 것을 적는다. 새 세션이 "이것도 해 둘까요"라고 물을 만한 것을 미리 막는다.

- 등락률 외 다른 열(종목명·현재가)의 정렬. 헤더의 "종목" 칸은 라벨일 뿐 클릭해도 아무 일도 없다
- 서버 연동. 목록 데이터는 지금처럼 `watchlist.json` import 그대로
- "정렬 해제(원래 순서로 되돌리기)" 상태. 한 번 정렬하면 내림차순과 오름차순 사이만 오간다
- 정렬 상태의 종목별·계정별 분리. 키 하나에 방향 하나만 저장한다
- `useQuoteFeed` · `App.tsx` · 다른 화면 파일 수정
- 관심종목 행 높이·목록 슬롯 높이 등 기존 레이아웃 값 변경

## 4. E2E 검증 단계

구현이 끝났을 때 새 세션이 스스로 실행할 명령과 기대 출력을 순서대로 적는다. 사람이 확인해 줄 단계를 남기지 않는다.

1. `npm test` — 전부 통과. `tests/sortByChange.test.ts` 와 `tests/sortState.test.ts` 가 목록에 있다
2. `npm run lint -- --quiet && npm run typecheck` — 출력 없음
3. `npm run dev` 로 띄운 뒤 관심종목 패널에서 "등락률" 헤더 클릭 → 등락률 큰 종목이 맨 위, 헤더에 ▼
4. 한 번 더 클릭 → 등락률 작은(하락 큰) 종목이 맨 위, 헤더에 ▲
5. 브라우저 새로고침 → 4번의 순서와 ▲ 표시가 그대로 남아 있다
6. 개발자 도구에서 `localStorage.removeItem('hanwha-mts.watchlist.sort')` 후 새로고침 → `watchlist.json` 순서로 돌아오고 헤더에 방향 표시 없음

## 확정된 결정

계획 세션에서 되물어 확정한 항목을 적는다. 질문과 답을 한 줄씩.

- Q: 정렬 상태는 어디에 유지하나 (세션 메모리 / localStorage / 서버 프로필)? → A: `localStorage`. 키는 `hanwha-mts.watchlist.sort`, 값은 `'asc' | 'desc'`. 읽기·쓰기는 `src/lib/sortState.ts` 에만 두고 화면 계층은 그 함수만 부른다
- Q: 등락률은 부호를 포함해 정렬하나, 절대값(변동 폭)으로 정렬하나? 시세가 없는 종목(거래정지·미수신)은 어디에 두나? → A: 부호 포함. 내림차순이면 +3.4 → +0.5 → 0 → -2.1 순. 시세가 없어 등락률이 없는 종목은 정렬 대상에서 빼고 목록 맨 아래에 `watchlist.json` 순서로 둔다. `null` 과 숫자를 비교하지 않는다
- Q: 첫 클릭의 방향은? → A: 내림차순(상승률 큰 순). 다음 클릭부터 반대 방향으로 오간다
