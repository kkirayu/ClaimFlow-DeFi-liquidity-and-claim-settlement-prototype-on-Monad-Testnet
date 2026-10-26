#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="$PATH:$HOME/.foundry/bin"
RPC_URL="${LOCAL_RPC_URL:-http://127.0.0.1:8545}"

if ! command -v forge >/dev/null 2>&1; then
  echo "Foundry is required. Install it from https://book.getfoundry.sh/getting-started/installation"
  exit 1
fi

ANVIL_PID=""
if ! cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; then
  echo "Starting Anvil on $RPC_URL ..."
  anvil --host 127.0.0.1 --port 8545 --chain-id 31337 > /tmp/claimflow-anvil.log 2>&1 &
  ANVIL_PID=$!
  cleanup() {
    if [[ -n "$ANVIL_PID" ]]; then
      kill "$ANVIL_PID" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup EXIT INT TERM
  for _ in $(seq 1 40); do
    if cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; then break; fi
    sleep 0.25
  done
fi

echo "Building contracts and syncing ABIs ..."
forge build --root contracts
node scripts/sync-abis.mjs

echo "Deploying and seeding local demo ..."
node scripts/deploy.mjs --network local --seed

echo
echo "Starting the frontend at http://localhost:5173"
pnpm --filter @claimflow/frontend dev
