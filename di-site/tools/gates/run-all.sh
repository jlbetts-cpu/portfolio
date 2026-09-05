#!/usr/bin/env bash
# Runs every gate serially against DI_URL (default http://127.0.0.1:4611/index.html). Each gate exits non-zero on failure.
cd "$(dirname "$0")"
fail=0
for g in layout targets contrast copy images motion orbit dialog a11y; do
  echo "── $g"; node "$g.mjs" || fail=1
done
exit $fail
