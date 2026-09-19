#!/usr/bin/env node
// .claude/hooks/forbid.mjs - PreToolUse(Write|Edit|MultiEdit) 훅
// 저장되기 전에 막는다. exit 2 면 저장이 취소되고 stderr 가 Claude 에게 되돌아간다.

import { readFileSync } from "node:fs";

const RULES = [
  { re: /console\.log\(/, msg: "console.log 는 커밋하지 않는다. 디버깅은 로거를 쓴다." },
  { re: /:\s*any\b/, msg: "any 대신 실제 타입을 쓴다. 모르면 unknown 뒤 좁힌다." },
  { re: /@ts-ignore/, msg: "@ts-ignore 는 금지. 타입을 고치거나 @ts-expect-error 에 사유를 적는다." },
  { re: /\bdebugger\b/, msg: "debugger 문을 남기지 않는다." },
  { re: /\b(it|test|describe)\.(only|skip)\(/, msg: "테스트를 only/skip 으로 두지 않는다." },
  { re: /https?:\/\/(?!localhost)[^\s"'`]+/, msg: "엔드포인트를 하드코딩하지 않는다. 환경변수로 뺀다." },
];

const SKIP_PATH = /(^|\/)(node_modules|dist|build|coverage)\//;

let raw = "";
try {
  raw = readFileSync(0, "utf8");
} catch {
  process.exit(0);
}

let data;
try {
  data = JSON.parse(raw);
} catch {
  process.exit(0);
}

const tool = data.tool_name ?? "";
const ti = data.tool_input ?? {};
const path = ti.file_path ?? "(unknown)";

// 윈도우 경로(C:\...\node_modules\...)도 같은 규칙으로 보도록 구분자를 / 로 맞춘다.
if (SKIP_PATH.test(path.replace(/\\/g, "/"))) process.exit(0);

const chunks = [];
if (tool === "Write") chunks.push(["content", ti.content ?? ""]);
else if (tool === "Edit") chunks.push(["new_string", ti.new_string ?? ""]);
else if (tool === "MultiEdit")
  (ti.edits ?? []).forEach((e, i) => chunks.push([`edits[${i}]`, e.new_string ?? ""]));

const hits = [];
for (const [field, text] of chunks) {
  if (typeof text !== "string") continue;
  text.split("\n").forEach((line, i) => {
    for (const rule of RULES) {
      if (rule.re.test(line)) hits.push({ field, line: i + 1, msg: rule.msg, src: line.trim().slice(0, 100) });
    }
  });
}

if (hits.length === 0) process.exit(0);

const out = [
  `저장 차단: ${path} 에 팀 규칙 위반 ${hits.length}건.`,
  "아래를 모두 고친 뒤 다시 저장한다. 규칙 자체를 지우는 것은 답이 아니다.",
  "",
];
for (const h of hits.slice(0, 20)) out.push(`  ${h.field} line ${h.line}: ${h.msg}`, `    > ${h.src}`);
if (hits.length > 20) out.push(`  ... 외 ${hits.length - 20}건`);
process.stderr.write(out.join("\n") + "\n");
process.exit(2);
