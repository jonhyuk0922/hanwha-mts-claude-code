# 명령 카드: 하루에 쓰는 명령 전부

한 면에 다 있다. "처음 쓰는 곳"은 교시다.

## Claude Code 슬래시 명령

| 명령 | 무엇을 하나 | 처음 쓰는 곳 |
|---|---|---|
| `/context` | 지금 세션이 무엇으로 차 있는지 층별 사용률을 보여 준다 | 1교시 |
| `/clear` | 세션 맥락을 전부 비운다. 무관한 작업 사이, 각 블록 자체 실습 시작 시 | 1교시 |
| `/compact <지시>` | 맥락을 요약해 줄인다. 이어지는 작업일 때. 예: `/compact 결함 ① 재현 결과만 남겨` | 1교시 |
| `/btw <질문>` | 맥락에 남지 않는 곁가지 질문 | 1교시 |
| `/usage` | 플랜 사용량. 오늘 기준선, 점심 직전 잔량 | 1교시 |
| `/effort` | 사고 깊이 단계. 기본 medium, 계획 모드·리뷰 세션에서만 high 로 올리고 되돌린다 | 1교시 공지 |
| `/rename <이름>` | 세션에 이름을 붙인다. 하루 뒤 `/resume <이름>` 으로 찾을 때 | 1교시 |
| `/plan [설명]` | 계획 모드로 바로 들어간다. `/plan open` 은 지금 계획 파일을 에디터에서 연다 | 3교시 |
| `/exit` | 세션을 완전히 끝낸다(별칭 `/quit`). 인계 실습의 "닫는다"는 이것이다 | 3교시 |
| `/init` | CLAUDE.md 초안을 만든다 | 4교시 |
| `/doctor` | 설치·설정 상태 점검. 프루닝 뒤 CLAUDE.md 와 `.claude/settings.json` 이 정상 로드되는지 | 4교시 |
| `/code-review` | 현재 diff 를 로컬에서 리뷰한다. Actions 가 안 되면 이 출력을 PR 코멘트로 붙인다 | 5교시 |

## 키

| 키 | 무엇을 하나 |
|---|---|
| `Shift+Tab` | 모드 전환. 하단에 `⏸ plan mode on` 이 뜰 때까지 누른다(auto 시작이면 세 번). 파일을 읽되 고치지 않는다. `claude --permission-mode plan` 으로 시작해도 같다 |
| `Ctrl+G` | 입력 중인 프롬프트를, 또는 "Ready to code?" 승인 대화상자에서 계획 파일을 외부 에디터로 연다. 저장하고 닫으면 "Plan saved!" |

## 검색 (1교시 B안)

```
rg -n "validateQty" src/                                        # 문자열로 후보 파일 좁히기
rg -n --type ts "qty|Qty" src/ tests/                            # 확장자 한정
```

## git worktree (6교시 시범: 참가자는 따라 치지 않는다)

```
git worktree add ../wt-a -b explore/quote-flow
git worktree add ../wt-b -b feat/sort-toggle
git worktree add ../wt-c -b feat/loading-skeleton
git worktree list
```

되돌리기: `git rebase --abort` → `git worktree remove ../wt-c --force` → `git branch -D feat/loading-skeleton` → `git worktree prune`

## 레거시 분석 (6교시 시범: 외부 스킬)

```
git worktree add ../mts-legacy legacy/orderbook-tangled
cd ../mts-legacy && npm run setup && claude
/mattpocock-skills:improve-codebase-architecture src/screens 호가창과 주문 폼. 현재가가 두 곳에서 따로 움직인다
```

플러그인 설치(한 번만): 터미널에서 `claude plugin install mattpocock-skills`, 세션 안에서는 `/plugin install mattpocock-skills`
이어 가는 스킬: `/mattpocock-skills:tdd` (테스트 선행 구현) · `/mattpocock-skills:implement` (명세·티켓 기준 구현). 시범에서는 구현을 승인하지 않는다.

## npm

```
npm run setup        # 의존성 설치 → 마지막 줄 READY: hanwha-mts-claude-code
npm run dev          # 로컬 실행
npm test             # 테스트 전체. 하나만: npm test -- tests/validateQty.test.ts
npm run lint         # 린트. 경고도 실패로: npm run lint -- --max-warnings 0
npm run typecheck    # tsc --noEmit
```

## 첫 프롬프트 끝에 붙이는 한 줄

`npm test && npm run lint -- --max-warnings 0 && npm run typecheck 를 직접 실행하고 출력을 보고하라.`

## 체크포인트 브랜치

`start` · `after-b2` · `after-b3` · `after-b4` · `review-fixture`, 막히면 다음 블록 시작 때 갈아탄다: `git stash && git checkout <브랜치>`
`legacy/orderbook-tangled`: 6교시 레거시 분석 시범 전용(호가창·주문 폼이 얽힌 상태, 세 검사는 초록). 정답 형상은 `after-b2`, 차이는 `git diff legacy/orderbook-tangled..after-b2 -- src`
정답은 `git diff main..fix/defect-N -- src tests` (④ 는 `git diff after-b3..fix/defect-4 -- src tests`). `-- src tests` 를 빼면 main 에만 있는 문서 변경이 섞여 11파일이 뜬다.
