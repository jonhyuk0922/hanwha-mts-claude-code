#!/usr/bin/env bash
# .claude/hooks/check.sh — PostToolUse (matcher: Edit|Write) 훅
#
# 실행 권한이 있어야 한다:  chmod +x .claude/hooks/check.sh
# 검사 실패 시 exit 2 로 끝낸다. exit 2 여야 stderr 가 Claude 에게 되돌아가 스스로 고친다.
# exit 1 은 조용히 지나가므로 쓰지 않는다.
#
# 검사 내용: npm run lint -- --quiet && npm run typecheck

set -u

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 2

if out=$(npm run lint -- --quiet 2>&1 && npm run typecheck 2>&1); then
  echo "check.sh: lint + typecheck OK"
  exit 0
fi

echo "check.sh: lint 또는 typecheck 실패. 아래 출력을 보고 고친 뒤 다시 저장한다." >&2
echo "$out" >&2
exit 2
