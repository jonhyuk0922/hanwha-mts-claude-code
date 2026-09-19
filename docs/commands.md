# 명령 카드: 하루에 쓰는 명령 전부

한 면에 다 있다. "처음 쓰는 곳"은 교시다.

## 윈도우 현장 PC (09:00, 1교시 덱 2~4장 · 맥북은 건너뛴다)

현장 윈도우 PC에는 git·Node.js·Bun이 없을 수 있다. **Claude Code 설치보다 먼저** PowerShell에서 위부터 깐다. 네이티브 윈도우에서 Git for Windows는 필수는 아니지만 권장이다(없으면 Claude Code가 셸 명령을 PowerShell 도구로 돌리고, 있으면 Git Bash로 Bash 도구를 쓴다). 이 교육은 `git clone` 을 쓰므로 git이 먼저다.

```
winget install --id Git.Git -e --source winget   # ① Git
powershell -c "irm bun.sh/install.ps1|iex"         # ③ Bun (Windows 10 1809 이상)
```

② Node.js는 https://nodejs.org/en/download 에서 LTS(v24)의 **Windows Installer (.msi)** 를 받아 기본값으로 설치한다. PowerShell로 깔고 싶으면 같은 페이지의 Chocolatey 방식(관리자 PowerShell 필요)을 따른다. Chocolatey 설치 명령은 https://docs.chocolatey.org/en-us/choco/setup/ 원문을 복사하고, 그다음 `choco install nodejs --version="24.21.0"`.

**PowerShell 창을 모두 닫고 새로 연 뒤** 네 줄로 확인한다.

```
git --version
node -v          # v24 로 시작하면 LTS
npm -v
bun -v
```

그다음 Claude Code는 아래 「설치」의 윈도우 한 줄(`irm https://claude.ai/install.ps1 | iex`)로 깐다.

| 증상 | 해결 |
|---|---|
| `winget` 을 못 찾는다 | Microsoft Store에서 App Installer 설치(https://apps.microsoft.com/detail/9nblggh4nns1). 첫 로그인 직후라 등록이 덜 됐으면 `Add-AppxPackage -RegisterByFamilyName -MainPackage Microsoft.DesktopAppInstaller_8wekyb3d8bbwe`. 급하면 git-scm.com 설치 파일 |
| 설치했는데 명령을 못 찾는다 | PowerShell 창을 모두 닫고 새로 연다 |
| `npm.ps1 … running scripts is disabled` | `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` 뒤 다시 친다. 그룹 정책이 걸려 있으면 이 설정이 무시된다(다음 행) |
| 관리자 권한·보안 프로그램이 설치를 막는다 | 현장 담당자에게 확인하고, 그동안 짝의 화면으로 진행한다 |
| Claude Code가 Git Bash를 못 찾는다 | `~/.claude/settings.json` 의 `env` 에 `"CLAUDE_CODE_GIT_BASH_PATH": "C:\\Program Files\\Git\\bin\\bash.exe"` |

**윈도우에서 달라지는 1교시 명령 두 가지**

- 작업 폴더: 맥의 `mkdir -p` 대신 `New-Item -ItemType Directory -Force $HOME\Desktop\claude-class` 를 치고, 다음 줄에 `cd $HOME\Desktop\claude-class`(아래 「작업 폴더와 clone」의 윈도우 두 줄). 이 카드는 `&&` 로 잇지 않고 한 줄에 명령 하나씩 친다. Windows PowerShell 5.1 은 `&&` 를 지원하지 않는다(PowerShell 7부터). `git clone`·`cd hanwha-mts-claude-code`·`npm run setup` 은 맥과 같다.
- 레포 크기(환산): `xargs`·`wc` 가 없으므로 claude 세션 안에서 *"이 명령을 실행해 바이트 수만 알려줘: git ls-files -z -- src tests | xargs -0 cat | wc -c"* 로 Claude에게 맡긴다.

## 설치 (09:00, 1교시 덱 5~7장)

```
curl -fsSL https://claude.ai/install.sh | bash    # 맥 설치. 윈도우 사내 PC는 PowerShell 에서 irm https://claude.ai/install.ps1 | iex
claude --version                                  # 터미널 창을 새로 연 뒤 버전 확인
claude doctor                                     # 설치 상태 점검
```

맥에서 터미널 창을 새로 열어도 `claude` 를 못 찾으면 `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc` 를 치고, 다음 줄에 `source ~/.zshrc`. 계정 확인은 세션 안에서 `/status`, 바꿀 때는 `/login` 또는 셸에서 `claude auth logout` → `claude auth login`.

## 작업 폴더와 clone (09:00, 1교시 덱 8~10장)

작업 폴더는 OS 마다 두 줄이다. 이름은 바꿔도 된다.

```
mkdir -p ~/Desktop/claude-class                                   # 맥
cd ~/Desktop/claude-class                                         # 맥
```

```
New-Item -ItemType Directory -Force $HOME\Desktop\claude-class    # 윈도우(PowerShell)
cd $HOME\Desktop\claude-class                                     # 윈도우(PowerShell)
```

여기부터는 맥·윈도우가 같다.

```
git clone https://github.com/jonhyuk0922/hanwha-mts-claude-code   # 원본을 받는다. fork 는 5교시
cd hanwha-mts-claude-code
npm run setup                                                     # 끝에 READY: hanwha-mts-claude-code
claude                                                            # 반드시 이 폴더에서 켠다(pwd 로 확인)
```

5교시에 fork 를 만든 뒤에는 같은 폴더에서 `git remote set-url origin https://github.com/<내 계정>/hanwha-mts-claude-code` 로 원격만 바꾼다.

## OMC (선택, 수업 뒤 · 1교시 덱 26~27장)

세션 안에서 한 줄씩 `/plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode` → `/plugin install oh-my-claudecode` → `/omc-setup`. 업데이트는 `/plugin marketplace update omc` → `/omc-setup`.
셸에서 `claude plugin details oh-my-claudecode` 는 매 세션에 더해지는 토큰 예상치, `claude plugin disable oh-my-claudecode` 는 끄기, `claude plugin uninstall oh-my-claudecode` 는 지우기.
2~6교시 실습은 기본 Claude Code 기준이므로 설치는 수업이 끝난 뒤 본인 환경에서 한다.

## Claude Code 슬래시 명령

| 명령 | 무엇을 하나 | 처음 쓰는 곳 |
|---|---|---|
| `/context` | 지금 세션이 무엇으로 차 있는지 층별 토큰 수와 사용률을 보여 준다. 1교시 A/B 는 총 토큰으로 적는다 | 1교시 |
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

## 1교시 A/B (B안 두 프롬프트와 레포 크기)

```
파일을 열어 읽지 말고 검색으로 주문 수량 검증과 관련된 후보 파일과 줄 번호만 목록으로 내라. 후보는 5개 이하로 좁혀라.
그 후보를 서브에이전트에게 넘겨 주문 수량 검증 로직이 어느 파일 어느 함수에 있는지 조사하고, 결과는 파일:함수 목록으로만 돌려줘. 읽은 파일 본문은 이 대화에 올리지 마라.
```

레포 크기(바이트)는 레포 루트에서 `git ls-files -z -- src tests | xargs -0 cat | wc -c`. 폴더 이름은 내 레포에 맞게 바꾼다. 윈도우는 이 줄을 claude 세션 안에서 Claude에게 맡긴다(위 「윈도우 현장 PC」).

## Stop 훅 (2교시)

훅 파일과 설정 파일을 복사한 뒤 세션을 완전히 종료하고 다시 연다. 레포 루트에서 내 OS 쪽 세 줄을 한 줄씩 친다. `.claude/settings.local.json` 은 git 이 무시한다.

```
mkdir -p .claude/hooks                                                          # 맥
cp docs/templates/hooks/stop-check.mjs .claude/hooks/                           # 맥
cp docs/templates/settings.local.snippet.json .claude/settings.local.json       # 맥
```

```
New-Item -ItemType Directory -Force .claude\hooks                               # 윈도우(PowerShell)
Copy-Item docs\templates\hooks\stop-check.mjs .claude\hooks\                    # 윈도우(PowerShell)
Copy-Item docs\templates\settings.local.snippet.json .claude\settings.local.json # 윈도우(PowerShell)
```

## 훅 두 개 (4교시)

`docs/templates/hooks/` 의 훅 파일을 `.claude/hooks/` 로, 설정 스니펫 `docs/templates/settings.snippet.json` 을 `.claude/settings.json` 으로 복사한다. 레포 루트에서 내 OS 쪽 세 줄을 한 줄씩 친다.

```
mkdir -p .claude/hooks                                                          # 맥
cp docs/templates/hooks/*.mjs .claude/hooks/                                    # 맥
cp docs/templates/settings.snippet.json .claude/settings.json                   # 맥
```

```
New-Item -ItemType Directory -Force .claude\hooks                               # 윈도우(PowerShell)
Copy-Item docs\templates\hooks\*.mjs .claude\hooks\                             # 윈도우(PowerShell)
Copy-Item docs\templates\settings.snippet.json .claude\settings.json            # 윈도우(PowerShell)
```

`forbid.mjs`(PreToolUse)는 저장 전에 막고, `check.mjs`(PostToolUse)는 저장 뒤 lint·typecheck 를 돌린다. 설정이 셸을 거치지 않고 `node` 를 바로 부르므로 맥·윈도우가 같고, 실행 권한도 필요 없다. 붙인 뒤 세션을 새로 연다.

### forbid 훅 확인: 네 가지 입력을 흘려 넣는다

훅은 조용히 안 걸리는 게 제일 위험하다. 붙인 직후 레포 루트에서 한 줄을 친다(맥·윈도우 같다). 마지막 판정 줄의 exit 가 **2 · 0 · 0 · 0** 이면 통과다.

```
node docs/templates/hooks/test-forbid.mjs    # 1) 위반 2 · 2) 정상 0 · 3) 면제 경로(node_modules) 0 · 4) 무관한 도구(Bash) 0
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
cd ../mts-legacy
npm run setup
claude
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

`start` · `after-b2` · `after-b3` · `after-b4` · `review-fixture`, 막히면 다음 블록 시작 때 갈아탄다: `git stash` 를 치고, 다음 줄에 `git checkout <브랜치>`
`legacy/orderbook-tangled`: 6교시 레거시 분석 시범 전용(호가창·주문 폼이 얽힌 상태, 세 검사는 초록). 정답 형상은 `after-b2`, 차이는 `git diff legacy/orderbook-tangled..after-b2 -- src`
정답은 `git diff main..fix/defect-N -- src tests` (④ 는 `git diff after-b3..fix/defect-4 -- src tests`). `-- src tests` 를 빼면 정답과 무관한 파일 차이가 섞인다.
