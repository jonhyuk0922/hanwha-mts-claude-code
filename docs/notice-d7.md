# 사전 안내 (D-7) — 한화투자증권 MTS 개발자 교육 · 2026-09-22(월) 09:00–17:00

발송 2026-09-15 · 조녁컴퍼니 이종혁 · jonhyuk0922@naver.com

교육일에 설치로 시간을 쓰지 않도록 아래를 미리 끝내 주십시오. 전원 macOS 기준입니다. 약 20분 걸립니다.

## 1. 계정

- Claude 개인 계정 (Pro 또는 Max). 교육 중 각자 계정으로 Claude Code 를 씁니다. 없으면 회신에 적어 주십시오. 2인 1조로 배치합니다.
- GitHub 계정 (개인 계정 가능). 교육 중 fork 와 PR 을 만듭니다.

## 2. 설치 — 터미널에서 순서대로

Homebrew 가 없으면 brew.sh 에 있는 설치 명령을 먼저 실행합니다.

```
brew install node git gh ripgrep ast-grep
curl -fsSL https://claude.ai/install.sh | bash
claude --version
gh auth login
git clone [REPO_URL]
cd hanwha-mts-claude-code
npm run setup
```

- `node` 는 LTS 이상이면 됩니다.
- `claude --version` 이 번호를 출력하면 Claude Code 설치가 된 것입니다. 터미널을 새로 열어야 잡힐 수 있습니다.
- `gh auth login` 은 GitHub 계정으로 브라우저 로그인합니다.
- `npm run setup` 이 마지막에 `READY: hanwha-mts-claude-code` 를 출력하면 준비가 끝난 것입니다.
- `claude` 를 한 번 실행해 개인 계정으로 로그인해 두면 당일 첫 5분이 줄어듭니다.

## 3. 회신 — 9/18(금)까지

`npm run setup` 의 마지막 줄 `READY: hanwha-mts-claude-code` 와 `claude --version` 의 출력 번호, 두 줄을 그대로 회신해 주십시오. 회신으로 준비 완료를 개인 단위로 집계합니다.

## 4. 막히면

- `npm run setup` 이 실패하면 출력의 마지막 20줄을 회신에 붙여 주십시오. 개별로 답합니다.
- 9/19(토) 에 Claude Code 버전 확인 안내가 한 번 더 갑니다. 두 줄짜리입니다.
- 당일 09:00 첫 5분에 버전과 설치를 함께 확인합니다. 미완료여도 오시면 됩니다. 페어로 배치합니다.
