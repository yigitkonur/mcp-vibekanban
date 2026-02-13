#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# worktree-init.sh -- Bootstrap a git worktree for mcp-vibekanban
#
# Run this script from the root of a freshly-created git worktree.
# It copies untracked config files from the main repo and installs deps.
#
# Usage:
#   git worktree add /path/to/worktree <branch>
#   cd /path/to/worktree
#   bash worktree-init.sh
#
# Idempotent: safe to re-run at any time.
###############################################################################

MAIN_REPO="/Users/yigitkonur/dev/projects/mcp-vibekanban"
WORKTREE_DIR="$(pwd)"

echo "==> worktree-init.sh"
echo "    Main repo : ${MAIN_REPO}"
echo "    Worktree  : ${WORKTREE_DIR}"
echo ""

# --------------------------------------------------------------------------- #
# 1. Copy .env (if it exists in the main repo)
# --------------------------------------------------------------------------- #
if [[ -f "${MAIN_REPO}/.env" ]]; then
  cp -v "${MAIN_REPO}/.env" "${WORKTREE_DIR}/.env"
  echo "    .env copied."
else
  echo "    .env not found in main repo -- skipping."
fi

# --------------------------------------------------------------------------- #
# 2. Copy .claude/settings.local.json (if it exists in the main repo)
# --------------------------------------------------------------------------- #
if [[ -f "${MAIN_REPO}/.claude/settings.local.json" ]]; then
  mkdir -p "${WORKTREE_DIR}/.claude"
  cp -v "${MAIN_REPO}/.claude/settings.local.json" \
        "${WORKTREE_DIR}/.claude/settings.local.json"
  echo "    .claude/settings.local.json copied."
else
  echo "    .claude/settings.local.json not found in main repo -- skipping."
fi

# --------------------------------------------------------------------------- #
# 3. Install dependencies with npm
# --------------------------------------------------------------------------- #
echo ""
echo "==> Installing dependencies (npm install) ..."
# Using 'npm install' rather than 'npm ci' because esbuild's platform-specific
# binary postinstall fails under 'npm ci' on macOS when the worktree lives on a
# symlinked path (e.g. /tmp -> /private/tmp). 'npm install' still honours the
# lockfile when present and is safe to re-run (idempotent).
npm install
echo "    Dependencies installed."

# --------------------------------------------------------------------------- #
# 4. Build the project
# --------------------------------------------------------------------------- #
echo ""
echo "==> Building project (npm run build) ..."
npm run build
echo "    Build complete."

echo ""
echo "==> worktree-init.sh finished successfully."
