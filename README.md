# hanwha-mts-claude-code

이 레포는 교육용 모의 MTS다. 실제 시세·주문과 무관하며, 화면 4개(호가창·관심종목·주문 폼·차트)와 순수 함수 3개가 목 JSON 위에서 돈다. Vite + React + TypeScript + Vitest + ESLint.

## 설치

```bash
git clone https://github.com/jonhyuk0922/hanwha-mts-claude-code   # fork 는 5교시에
cd hanwha-mts-claude-code
npm run setup        # 의존성 설치 → "READY: hanwha-mts-claude-code" 가 찍히면 완료
npm run dev          # http://localhost:5173
```

`npm run setup` 과 `docs/templates/hooks/` 의 훅은 node 스크립트라 맥 터미널과 윈도우 PowerShell 에서 같은 명령으로 돈다. 훅은 교시마다 필요한 파일만 이름을 지정해 `.claude/hooks/` 로 복사한다(명령은 `docs/commands.md`).

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
| `main` | 앱 + 결함 ①②③ + docs (시작점) |
| `start` | = main |
| `fix/defect-1` | 결함 ① 실패 테스트 → 수정 (커밋 2개) |
| `fix/defect-2` | 결함 ② 실패 테스트 → 수정 (커밋 2개) |
| `fix/defect-3` | 결함 ③ CSS·마크업 수정 |
| `after-b2` | 2교시 완료 상태 (①②③ 전부 수정) |
| `after-b3` | 3교시 완료 상태 (SPEC.md + 관심종목 정렬, 결함 ④ 포함) |
| `review-fixture` | = after-b3 |
| `fix/defect-4` | 결함 ④ 수정 |
| `after-b4` | 4교시 완료 상태 (CLAUDE.md + `.claude/` 체크인) |
| `legacy/orderbook-tangled` | 6교시 레거시 분석 시범용. 화면 안에 병합·피드·수량 판정 사본이 얽혀 있고 테스트·린트·타입 검사는 통과. 정답 형상은 `after-b2`, 차이는 `git diff legacy/orderbook-tangled..after-b2 -- src` |

막히면 해당 블록의 `after-*` 브랜치로 갈아탄다: `git switch after-b2`

## 구조

```
src/lib/        applyQuote · validateQty · sortByChange · orderRules · format
src/screens/    OrderBook · Watchlist · OrderForm · chart/(Chart · Axes · Candles)
src/data/       quotes · watchlist · orders · candles (목 JSON)
src/vendor/mts-bridge/  가상 사내 시세 브리지(레거시, 신규 코드에서 쓰지 않음)
tests/          순수 함수 테스트
docs/           워크시트·명령 카드·실습 템플릿
docs/templates/hooks/   훅 템플릿(.mjs): stop-check(2교시) · forbid · check(4교시), test-forbid(복사하지 않고 그 자리에서 실행)
scripts/        setup.mjs (npm run setup)
```

교안 슬라이드는 이 레포에 없다. 강사가 화면으로 띄우고 파일은 교육 당일 따로 전달한다.
