#!/usr/bin/env bash
# 참가자 셋업: 의존성 설치 후 완료 코드를 출력한다.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi

echo "READY: hanwha-mts-claude-code"
