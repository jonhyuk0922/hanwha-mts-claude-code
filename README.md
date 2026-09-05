# hanwha-mts-claude-code

이 레포는 교육용 모의 MTS다. 실제 시세·주문과 무관하며, 화면 4개(호가창·관심종목·주문 폼·차트)와 순수 함수 3개가 목 JSON 위에서 돈다. Vite + React + TypeScript + Vitest + ESLint.

## 설치

```bash
git clone <fork 주소> && cd hanwha-mts-claude-code
npm run setup        # 의존성 설치 → "READY: hanwha-mts-claude-code" 가 찍히면 완료
npm run dev          # http://localhost:5173
```

## 명령 5개

| 명령 | 역할 |
|---|---|
| `npm run setup` | 의존성 설치 + 완료 코드 출력 |
| `npm run dev` | 로컬 실행 |
| `npm test` | 테스트 실행 |
| `npm run lint` | 린트 |
| `npm run typecheck` | 타입 검사 |

## 브랜치

| 브랜치 | 내용 |
|---|---|
| `main` | 앱 + 결함 ①②③ + docs + deck (시작점) |
| `start` | = main |
| `fix/defect-1` | 결함 ① 실패 테스트 → 수정 (커밋 2개) |
| `fix/defect-2` | 결함 ② 실패 테스트 → 수정 (커밋 2개) |
| `fix/defect-3` | 결함 ③ CSS·마크업 수정 |
| `after-b2` | 2교시 완료 상태 (①②③ 전부 수정) |
| `after-b3` | 3교시 완료 상태 (SPEC.md + 관심종목 정렬, 결함 ④ 포함) |
| `review-fixture` | = after-b3 |
| `fix/defect-4` | 결함 ④ 수정 |
| `after-b4` | 4교시 완료 상태 (CLAUDE.md + `.claude/` 체크인) |

막히면 해당 블록의 `after-*` 브랜치로 갈아탄다: `git switch after-b2`

## 구조

```
src/lib/        applyQuote · validateQty · sortByChange · orderRules · format
src/screens/    OrderBook · Watchlist · OrderForm · chart/(Chart · Axes · Candles)
src/data/       quotes · watchlist · orders · candles (목 JSON)
tests/          순수 함수 테스트
docs/           워크시트·명령 카드·템플릿
deck/           교안
```
