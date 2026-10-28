# Demo script

A repeatable walkthrough for a local ClaimFlow deployment. Budget: 5–8 minutes.

## 0. Setup (once)

```bash
pnpm install
pnpm dev:local
```

Open <http://localhost:5173>. The app reads the local deployment written by the script.

In the wallet:

1. Add network **Anvil Local** if it is missing:
   - RPC: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency: `MON`
2. Import the public Anvil account #0 key (local only):
   `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`
3. Connect the wallet in the top-right. The header should show the shortened address and
   `Anvil Local`.

> This deployment enables self-approval and gives the deployer every role so one wallet can complete
> the flow. Testnet deployments default to separated roles.

### Role-separated variant (optional)

To demonstrate that the contract — not the UI — enforces permissions, switch the connected wallet to
distinct Anvil accounts and grant each one role:

| Step            | Anvil account | Role                  | Address                                      |
| --------------- | ------------- | --------------------- | -------------------------------------------- |
| Submit claim    | #1            | `CLAIM_OPERATOR_ROLE` | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` |
| Approve/reserve | #2            | `CLAIM_APPROVER_ROLE` | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |
| Batch settle    | #3            | `SETTLEMENT_ROLE`     | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` |
| Inspect only    | #4            | none                  | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` |

Grant roles from account #0 on **Protocol** (or with `cast send ... grantRole`). The roleless viewer
sees an explicit “role required” notice and no write actions. `frontend/e2e/business-flow.spec.ts`
automates exactly this sequence end to end.

## 1. Orientation — Overview (45 s)

Point out:

- **Vault balance** is the token balance held by the vault.
- **Available liquidity** is what claims/withdrawals may use.
- **Reserved liquidity** is locked for approved claims.
- **Pool utilization** = reserved ÷ vault balance.
- Claim queue counters and decoded recent events.
- The persistent demo disclosure and “Unaudited contracts” link.

## 2. Faucet + deposit (90 s)

1. Go to **Liquidity**.
2. Click **Get 100,000 mUSDC** if the wallet balance is low. Wait for confirmation.
3. Enter `10000` in **Deposit liquidity** and click the action.
4. If the allowance is insufficient, the first click is **Approve mUSDC**; confirm it, then click
   **Deposit liquidity**.
5. Wait for **Transaction confirmed** (receipt-gated). Metrics and shares refresh.

Talking points:

- Share value is based on **available** liquidity.
- Withdrawals are capped by available liquidity; reserved funds cannot be withdrawn.
- The approval and deposit are separate transactions by design; no optimistic balance updates.

## 3. Submit a claim (60 s)

1. Go to **Claims** → **New claim**.
2. Leave the generated opaque IDs.
3. Branch `101`, category `Vehicle finance`, recipient = your wallet, amount `1000`.
4. Leave the evidence hash empty.
5. Review and submit.

Expected: the claim appears as **Pending**; the pending counter increments.

## 4. Approve and reserve (60 s)

1. On the pending claim row choose **Approve** (or open the detail page).
2. Confirm the dialog.
3. Wait for confirmation.

Expected:

- Status becomes **Approved & Reserved** (indigo lock badge).
- Reserved liquidity increases by 1,000 mUSDC.
- Available liquidity decreases by the same amount.
- Detail timeline shows `Claim submitted` → `Claim approved & reserved` → `Liquidity reserved`.

Optional: demonstrate **Reject** on another pending claim; no reservation is made.

## 5. Settle (60 s)

Single:

1. Open the approved claim → **Settle claim** → confirm.
2. Status becomes **Paid**. Reserved liquidity and vault balance both drop by 1,000.

Batch:

1. Create/approve 2–3 more claims.
2. Go to **Settlement**. Select claims or use **Select all**.
3. Click **Review batch**. Verify recipients, amounts, total, cap, gas estimate, and the
   all-or-nothing warning.
4. Confirm. One transaction pays all selected claims.

Double-payout check: revisit a paid claim; no settle action is offered. Direct contract calls would
revert as well.

## 6. Audit trail (45 s)

Open the paid claim. Show:

- Opaque reference/evidence hashes only (no PII).
- `Created by`, timestamps, created transaction.
- Timeline with per-claim and vault events.
- Explorer links: locally hidden because Anvil has no explorer; on testnet they open Monadscan.

Export the timeline/claims as CSV from the page actions.

## 7. Performance Lab (90 s)

1. Go to **Performance Lab**.
2. Choose **Read-only calls**, workload `10`, start.
3. Show attempted/confirmed, median latency, throughput, and per-sample chart.
4. Choose **Settle batch** with workload `10`, batch `5` (requires self-approval and enough
   liquidity), start.
5. Explain that setup transactions are excluded from measured samples and results describe this
   workload/RPC only.
6. Export CSV/JSON; show the committed reference report selector.

## 8. Protocol + responsive check (45 s)

1. Open **Protocol**: network, chain ID, contract addresses, token/faucet parameters, roles,
   self-approval warning, and safety invariants.
2. Narrow the window to mobile width: the sidebar becomes a drawer, tables become cards, and the
   page does not overflow horizontally.
3. Disconnect the wallet. Read-only metrics stay visible; write actions prompt to connect.

## 9. Reset

Stop the dev process, stop Anvil, then run `pnpm dev:local` again. A fresh chain and deployment are
created. If Anvil runs separately, restart it before redeploying.

## Expected failure demos (optional)

| Scenario               | What to show                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| Wrong network          | Switch wallet to another chain: banner appears and writes are blocked.                         |
| Rejected signature     | Click a write, reject in the wallet: “Transaction rejected — nothing was sent”.                |
| Insufficient liquidity | Approve a claim larger than available liquidity: readable error, state unchanged.              |
| Unauthorized role      | Connect an address without a role: privileged actions are hidden; direct calls revert.         |
| Read failure           | Stop Anvil and refresh: errors are shown, never zero values.                                   |
| Batch invalid          | Select a claim, then settle it elsewhere; the stale batch preview is refreshed before signing. |

## Common demo issues

- **Faucet unavailable**: the per-address cooldown is one hour; use another Anvil account or reset
  the chain.
- **Approval button missing**: the claim is not pending, or the wallet lacks the approver role.
- **Self-approval error on testnet**: expected. Use a separate approver wallet.
- **No benchmark settlement**: the signer needs operator + approver + settlement roles and enough
  available liquidity.
- **Stale metrics**: data refreshes on an interval; use the Retry action on errors or wait for the
  next poll.
