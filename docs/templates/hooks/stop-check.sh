#!/usr/bin/env bash
# .claude/hooks/stop-check.sh: Stop 훅 (2교시 · 내 세션의 결정론 게이트)
#
# Claude 가 턴을 끝내려 할 때마다 npm test 를 직접 돌린다.
# 실패면 exit 2 로 턴을 되돌린다. stderr 가 Claude 에게 다음 지시로 들어간다.
# 되돌리는 횟수는 최대 3회. 그 뒤엔 사람에게 넘긴다 (CI 의 retry 상한과 같은 자리).
#
# 설치:  mkdir -p .claude/hooks && cp docs/templates/hooks/stop-check.sh .claude/hooks/ && chmod +x .claude/hooks/stop-check.sh
#        docs/templates/settings.local.snippet.json 을 .claude/settings.local.json 으로 복사 → 세션 재시작
# jq 를 쓰지 않는다 (참가자 맥에 없을 수 있다).

set -u
MAX_RETRY=3
INPUT=$(cat)
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" || exit 0

# stop_hook_active=true 면 "이미 이 훅이 되돌린 뒤의 재시도" 라는 뜻이다. 그 횟수를 파일로 센다.
CNT_FILE=".claude/.stop-retries"
if printf '%s' "$INPUT" | grep -q '"stop_hook_active": *true'; then
  n=$(cat "$CNT_FILE" 2>/dev/null || echo 0)
else
  n=0
fi

if out=$(npm test 2>&1); then
  rm -f "$CNT_FILE"
  exit 0                                   # 통과 → 턴을 끝내도 된다
fi

if [ "$n" -ge "$MAX_RETRY" ]; then
  rm -f "$CNT_FILE"
  echo "stop-check: ${MAX_RETRY}회 되돌린 뒤에도 npm test 실패. 사람에게 넘긴다." >&2
  exit 0                                   # 상한 도달 → 루프를 끊고 사람에게
fi

echo $((n + 1)) > "$CNT_FILE"
{
  echo "stop-check: npm test 실패 ($((n + 1))/${MAX_RETRY}). 통과 전에는 턴을 끝내지 못한다."
  echo "테스트의 기대값은 바꾸지 마라. tests/ 아래 파일은 수정하지 마라. src/ 만 고쳐라."
  printf '%s\n' "$out" | grep -E 'FAIL|✓|×|Expected|Received|Test Files|Tests ' | head -20
} >&2
exit 2                                     # exit 2 = 턴 되돌림. exit 1 은 조용히 지나간다
