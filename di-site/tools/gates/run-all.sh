#!/usr/bin/env bash
# Runs every gate serially against DI_URL (default http://127.0.0.1:4611/index.html). Each gate exits non-zero on failure.
cd "$(dirname "$0")"
fail=0
# A gate that throws prints its stack to stderr and no report line, and the run then LOOKS green because nothing said
# FAIL. That has happened three times here, always from a selector going stale. Every gate is now checked twice: its
# exit status, and whether it actually reported anything.
for g in layout targets contrast copy images motion ring lightbox dialog curtain a11y; do
  echo "── $g"
  out=$(node "$g.mjs"; echo "EXIT:$?")
  code=${out##*EXIT:}
  body=${out%EXIT:*}
  printf '%s' "$body"
  lines=$(printf '%s' "$body" | grep -c '^\(PASS\|FAIL\)' || true)
  if [ "$code" != "0" ] || [ "$lines" -eq 0 ]; then
    echo "FAIL  $g did not report (exit $code, $lines report lines)"
    fail=1
  fi
done
exit $fail
