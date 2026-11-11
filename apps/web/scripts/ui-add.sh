#!/usr/bin/env bash
# Add shadcn/ui components: ./scripts/ui-add.sh button dialog ...
# shadcn 4.23 resolves the `@/lib/utils` alias to an npm package called `cn` in this layout (TS 7 has no
# baseUrl), so undo that: never depend on `cn`, import our own helper instead.
set -euo pipefail
cd "$(dirname "$0")/.."
pnpm dlx shadcn@4.23.0 add "$@" --yes
if grep -q '"cn"' package.json; then pnpm remove cn >/dev/null; fi
sed -i '' 's#from "cn"#from "@/lib/utils"#' src/components/ui/*.tsx
