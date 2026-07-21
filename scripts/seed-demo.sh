#!/usr/bin/env bash
set -euo pipefail
[ "${CONFIRM_DESTRUCTIVE_DEMO_SEED:-}" = yes ]||{ echo 'This legacy seed drops tables. Set CONFIRM_DESTRUCTIVE_DEMO_SEED=yes only for a disposable database.' >&2;exit 1;};p="$(cd "$(dirname "$0")/.."&&pwd)";(cd "$p/backend"&&npm run seed)
