# Acceptance checklist

Verified on 2026-10-26 against a local Anvil deployment (chain `31337`) with the frontend running at
`http://127.0.0.1:5173`. Commands used:

```bash
pnpm contracts:test        # 62 passed
pnpm test                  # 67 passed
pnpm lint                  # clean
pnpm typecheck             # clean
pnpm build                 # success
pnpm test:e2e              # 7 passed
node scripts/benchmark.mjs --network local --operation settle-batch --size 10 --batch 5 --publish
```

Status legend: **Verified** · **Partial** · **Deferred** · **Out of scope**.

## PRD acceptance criteria (MVP)

| #   | Criterion                                                                       | Status                            | Evidence                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | App runs from README with clear environment variables                           | Verified                          | Quick start, `.env.example`, `frontend/.env.example`; `pnpm dev:local` starts chain, deployment, seed, and app.                                                                                                     |
| 2   | Contracts deployed to Monad Testnet with addresses in config                    | **Partial**                       | Deploy scripts for chain `10143` are complete and refuse zero-balance/chain mismatch. No funded testnet key was available in this environment, so no testnet deployment was executed. Local deployment is verified. |
| 3   | Mock token can be requested within faucet limits                                | Verified                          | `MockUSDC.t.sol`: amount, cooldown, lifetime cap, role checks; UI faucet panel and error copy.                                                                                                                      |
| 4   | LP deposits, receives shares, sees available/reserved, withdraws only available | Verified                          | Vault unit/fuzz tests; `LiquidityPage`, deposit/withdraw previews; E2E real `approve → deposit`; available-only math in `liquidity.ts` and vault tests.                                                             |
| 5   | Authorized operator submits synthetic claims                                    | Verified                          | `ClaimManager.t.sol` role/duplicate/field tests; New Claim dialog with validation; Playwright claims flow.                                                                                                          |
| 6   | Approver approves + reserves; insufficient liquidity fails                      | Verified                          | Atomic approval tests, insufficient-liquidity fuzz/unit tests, `InsufficientLiquidity` UI mapping.                                                                                                                  |
| 7   | Approver rejects pending without reservation                                    | Verified                          | Reject tests confirm no reserved balance change; UI action + confirmation.                                                                                                                                          |
| 8   | Settlement operator pays approved + reserved claim                              | Verified                          | Single settlement tests; claim detail action; local demo run.                                                                                                                                                       |
| 9   | Second payout of the same claim fails                                           | Verified                          | Double-payout tests for single and batch; terminal-status checks. UI hides the action.                                                                                                                              |
| 10  | Unauthorized roles cannot submit/approve/settle                                 | Verified                          | `AccessControlUnauthorizedAccount` tests for each entry point; UI hides actions but contract remains authority.                                                                                                     |
| 11  | Withdraw cannot touch reserved funds                                            | Verified                          | Vault tests for partial/full withdraw with active reservations; invariant `balance >= totalReserved`.                                                                                                               |
| 12  | Valid batch succeeds; invalid item reverts with no partial payout               | Verified                          | Batch success, duplicate rejection, invalid-item and rollback tests; batch preview warning.                                                                                                                         |
| 13  | UI waits for receipt before showing confirmed                                   | Verified                          | `TransactionProvider` sets confirmed only after `waitForTransactionReceipt`; reverted receipt is a failure. E2E observes receipt-gated state.                                                                       |
| 14  | Transaction history has correct explorer links                                  | Verified (testnet links not live) | `TxLink`/`AddressText` generate Monadscan URLs; local deployment intentionally hides dead links because Anvil has no explorer. Testnet URLs are covered by unit logic, not a live testnet deployment.               |
| 15  | Benchmark reports actual metrics, workload, and limitations                     | Verified                          | `docs/benchmark.md`; committed real Anvil report (`10 claims / 2 batches`, 391,030 gas, setup excluded); in-app and CLI runners.                                                                                    |
| 16  | Main test suite passes; no known critical demo-path bug                         | Verified                          | 62 contract + 67 unit/component + 7 E2E tests pass; lint/typecheck/build clean.                                                                                                                                     |
| 17  | Demo uses mock token and synthetic data only; no PII                            | Verified                          | Faucet token; hash-only claim fields; synthetic seeds; persistent disclosure; no PII inputs.                                                                                                                        |

## PRD test plan coverage

| Test area                                                | Status   | Evidence                                                                                                               |
| -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| Mint role/cap/cooldown                                   | Verified | `MockUSDC.t.sol`                                                                                                       |
| Initial + second depositor share math                    | Verified | `LiquidityVault.t.sol`                                                                                                 |
| Partial/full withdraw from available                     | Verified | Vault tests; unit preview tests                                                                                        |
| Reservation reduces available                            | Verified | Vault + manager tests; live dashboard                                                                                  |
| Withdraw cannot take reserved                            | Verified | Vault tests + invariant                                                                                                |
| Approval fails on insufficient liquidity                 | Verified | Manager/vault tests + fuzz                                                                                             |
| Release frees liquidity without transfer                 | Verified | Cancellation tests                                                                                                     |
| Payout reduces reserved and balance equally              | Verified | Payout tests + invariant                                                                                               |
| Double payout reverts                                    | Verified | Single/batch tests                                                                                                     |
| Unauthorized role reverts                                | Verified | Role tests on every restricted function                                                                                |
| Duplicate/zero/oversized/invalid status                  | Verified | Manager unit + fuzz tests                                                                                              |
| Valid batch pays all                                     | Verified | Batch tests                                                                                                            |
| Invalid batch item causes full rollback                  | Verified | Batch rollback tests                                                                                                   |
| Invariant `balance >= totalReserved`                     | Verified | Foundry invariant test with handler sequences                                                                          |
| Reentrancy review                                        | Verified | `ReentrancyGuard`, CEI, reentrant-token test                                                                           |
| Wallet disconnected / wrong network / rejected signature | Verified | NetworkGuard, wallet error copy; wrong-network and rejection classifications unit-tested; E2E connects injected wallet |
| Loading / pending / confirmed / reverted states          | Verified | TransactionProvider/Toast/State components; receipt-gated E2E                                                          |
| Role changes do not expose active buttons                | Verified | `availableClaimActions` unit tests; contract re-checks                                                                 |
| Dashboard after each lifecycle change                    | Verified | Seed + benchmark transactions observed on Overview/Claims/Settlement                                                   |
| Batch preview totals/cap/warning                         | Verified | `BatchPreview`; Playwright settlement page; manual local run                                                           |
| RPC error/timeout never assumed successful               | Verified | Read errors rendered as errors, not zero; only receipts mark confirmation                                              |
| Benchmark count/type/reproducibility                     | Verified | CLI and UI share schema; committed run reproducible locally                                                            |

## Design acceptance checklist

| #   | Criterion                                                                   | Status   | Evidence                                                                                       |
| --- | --------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| 1   | Available, reserved, and total vault balance clearly distinct               | Verified | Four metric cards, stacked composition bar, definitions; overview screenshot.                  |
| 2   | `Approved & Reserved` clearly distinct from `Paid`                          | Verified | Indigo lock badge vs green check; text labels + icons.                                         |
| 3   | All risky on-chain actions have confirmation                                | Verified | `ConfirmActionDialog` for approve/reject/cancel/payout/batch.                                  |
| 4   | RPC vs permission vs liquidity errors are distinct                          | Verified | `errors.ts` classification and copy; unit tests.                                               |
| 5   | Persistent testnet/mock disclosure                                          | Verified | Header banner + sidebar notice + Protocol warning.                                             |
| 6   | Table usable for dozens of demo claims with status filter                   | Verified | Status/category/branch/search/sort; backend cap independent; table + mobile cards.             |
| 7   | Claim detail shows timeline and transaction links                           | Verified | Timeline with decoded manager/vault events and `TxLink`; Playwright detail flow.               |
| 8   | Batch preview shows recipients, amounts, total, cap, all-or-nothing warning | Verified | `BatchPreview` dialog with gas, cap, totals, warning, transaction state.                       |
| 9   | No PII in sample data or forms                                              | Verified | Hash/numeric/address fields only; synthetic labels.                                            |
| 10  | Loading, empty, pending, failed, confirmed states                           | Verified | Skeletons, empty states, error states, transaction toast/state; tests.                         |
| 11  | Responsive desktop and mobile                                               | Verified | Drawer navigation, card lists under `md`, mobile E2E overflow check; screenshots.              |
| 12  | Keyboard focus, labels, textual status indicators                           | Verified | Labelled inputs, focus rings, dialog escape/focus handling, skip link, `sr-only` granted text. |
| 13  | 6-decimal token formatting and tabular digits                               | Verified | `formatToken`/`parseTokenInput`, `.tabular`; unit tests.                                       |
| 14  | Read errors never displayed as zero                                         | Verified | `ErrorState` retains undefined values; `readErrorMessage`; unit test.                          |

## Explicitly deferred / out of scope

| Item                                                    | Reason                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Risk-pool segmentation with category exposure caps (P1) | Requires changing vault accounting and has no UI/schema in the docs; deferred with rationale in `PLAN.md`. |
| Off-chain evidence portal (P2)                          | Out of scope and conflicts with the no-PII/hash-only model.                                                |
| External integrations and dedicated indexer (P2)        | Out of scope; direct RPC event reads are documented as a scaling limit.                                    |
| Real assets, real stablecoins, mainnet funds            | Excluded by the PRD and safety policy.                                                                     |
| Live Monad Testnet deployment                           | Awaiting a funded testnet key; scripts and local verification are complete.                                |

## Visual evidence

| Screen          | File                                   |
| --------------- | -------------------------------------- |
| Overview        | `docs/screenshots/overview.png`        |
| Claims queue    | `docs/screenshots/claims.png`          |
| Performance Lab | `docs/screenshots/benchmark.png`       |
| Mobile overview | `docs/screenshots/mobile-overview.png` |

## Notes

- The local deployment enables self-approval for a single-wallet demo. The contract default is
  disabled, covered by tests and shown on the Protocol page when enabled.
- The committed benchmark is a real **local** run. It is not evidence of Monad network performance.
- Testnet deployment remains the only partial acceptance item; follow `docs/deployment.md` with a
  funded key to complete it.
