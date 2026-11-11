#!/usr/bin/env bash
set -euo pipefail

BRANCH_NAME="feat/configurator-parametric-engine-v4"

echo "==> [1/4] Switching to branch: ${BRANCH_NAME}"
git checkout -B "${BRANCH_NAME}"

echo "==> [2/4] Staging all V4.1 / V4.2 / V4.3 source files, tests, and docs/configurator reports..."
git add apps packages docs tests package.json tsconfig.json vitest.config.ts playwright.config.ts playwright.v41.config.ts README.md AGENTS.md .gitignore

echo "==> [3/4] Running TypeScript check (npm run lint) and unit tests (npm test)..."
if [ -d "node_modules" ]; then
  npm run lint
  npm test
else
  echo "    (node_modules not found yet; run 'npm install && npm test' to execute full Vitest suite)"
fi

echo "==> [4/4] Committing and pushing ${BRANCH_NAME} to origin..."
git commit -m "feat(v4): integrate store customer UX (auto-fix, exploded view, sync materials) & factory planner BOM/CNC/DXF/deflection engine" || echo "No new changes to commit"
git push -u origin "${BRANCH_NAME}" --force

echo "==> Done! Open or review your Pull Request at:"
echo "    https://github.com/Centan2025/birim-configurator/compare/main...${BRANCH_NAME}?expand=1"
