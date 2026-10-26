# ClaimFlow — Implementation Plan

> Source of truth: `/home/shironeko/Downloads/ClaimFlow_Docs/PRD_ClaimFlow.md` and
> `/home/shironeko/Downloads/ClaimFlow_Docs/design.md` (read-only).
> This document records discovery, decisions, assumptions, milestones, and traceability.

---

## 1. Discovery summary

### 1.1 Product

ClaimFlow is a DeFi liquidity and claim-settlement protocol prototype on **Monad Testnet**. Liquidity
providers deposit a mock USDC token into a shared vault. Authorized claim operators submit claims
containing only opaque references and minimal metadata. Approvers reserve liquidity and approve (or
reject) claims. Settlement operators pay a single approved claim or a batch of approved claims in one
all-or-nothing transaction. Available liquidity and reserved liquidity are accounted separately and
every state transition emits an auditable on-chain event.

This is a hackathon prototype with simulated tokens and synthetic data only. It is not affiliated with
or endorsed by ACC, is not production-audited, and must not be used with real funds or PII.

### 1.2 Feature list (PRD priority)

| Priority | Feature                                                                  |
| -------- | ------------------------------------------------------------------------ |
| P0       | Wallet connect/disconnect, network detection, address display            |
| P0       | Mock USDC token with capped demo faucet                                  |
| P0       | Liquidity vault: deposit, shares, withdraw from available liquidity only |
| P0       | Pool dashboard: vault balance, available, reserved, utilisation, shares  |
| P0       | Claims: submit, list, detail, status, approve, reject                    |
| P0       | Reservation on approval, release on authorized cancellation              |
| P0       | Single settlement with double-payout protection                          |
| P0       | Batch settlement (max 20), all-or-nothing                                |
| P0       | Audit trail: event timeline + explorer links                             |
| P0       | Role-aware UI plus contract-enforced access control                      |
| P0       | Performance lab: synthetic workloads, measured metrics, JSON/CSV export  |
| P1       | CSV export of history/claims                                             |
| P1       | Risk pool segmentation with category exposure caps                       |
| P2       | Off-chain evidence portal, external integrations, separate indexer       |
| Excluded | Real assets, real stablecoins, mainnet funds                             |

### 1.3 User roles

| Role                | On-chain role          | Capabilities                                    |
| ------------------- | ---------------------- | ----------------------------------------------- |
| Liquidity Provider  | none (any wallet)      | faucet, deposit, withdraw own shares            |
| Claim Operator      | `CLAIM_OPERATOR_ROLE`  | submit claims, cancel own pending claims        |
| Claim Approver      | `CLAIM_APPROVER_ROLE`  | approve + reserve, reject pending claims        |
| Settlement Operator | `SETTLEMENT_ROLE`      | settle single claim, settle batch               |
| Claim Canceller     | `CLAIM_CANCELLER_ROLE` | cancel pending or reserved (release) claims     |
| Auditor / Viewer    | none                   | read-only dashboard, claims, events             |
| Protocol Admin      | `DEFAULT_ADMIN_ROLE`   | role grants, batch cap, demo self-approval flag |

### 1.4 On-chain data model

`Claim`: `claimId`, `claimRefHash`, `branchCode`, `categoryId`, `recipient`, `amount`,
`evidenceHash`, `status`, `createdAt`, `updatedAt` (+ `createdBy` for self-approval enforcement).

`ClaimStatus`: `None`, `Pending`, `ApprovedReserved`, `Paid`, `Rejected`, `Cancelled`.

Vault: `asset`, `totalShares`, `sharesOf[address]`, `totalReserved`, `reservedByClaim[claimId]`,
`availableLiquidity() = token.balanceOf(vault) - totalReserved`.

### 1.5 Integrations, wallet, contracts

- **Contracts:** `MockUSDC.sol`, `LiquidityVault.sol`, `ClaimManager.sol` (OpenZeppelin 5.x).
- **Wallet:** wagmi + viem with an injected EVM wallet; read-only RPC for public data.
- **Network:** Monad Testnet chain ID `10143`, RPC `https://testnet-rpc.monad.xyz`,
  explorer `https://testnet.monadscan.com` (verified against Monad docs at build time).
- **Local development:** Anvil chain ID `31337` with a local deployment so the demo is reproducible
  without testnet funds.
- **No backend** for MVP; on-chain reads and event logs only.
- **Benchmark:** browser lab plus a Node/viem CLI benchmark; measured output only.

### 1.6 Open questions from the docs (resolved as assumptions below)

1. Should settlement operators be allowed to settle claims they created/approved? The PRD only
   forbids self-approval; the contract implements only the explicit self-approval rule.
2. Is "Approved & Reserved" a warning (amber) or indigo? PRD §5/§9 says reserved is an attention
   state; design §5.3 explicitly maps the badge to indigo. Visuals follow the design doc, and the
   badge includes a lock icon plus text so colour is not the only signal.
3. How should benchmark transactions be signed? The design asks for in-app controls; the PRD asks
   for a script. Both are delivered: in-app runner for read/submit/single/batch workloads and a CLI
   Node benchmark that persists measured JSON; the UI can load that report.
4. What is the risk-pool category model? Only P1, no schema in the docs and no UI in the design.
   Deferred with a documented rationale; global liquidity limits already enforce exposure.
5. Should cancellation of a reserved claim be exposed? The PRD says "only if demo policy allows".
   A dedicated `CLAIM_CANCELLER_ROLE` is implemented and exposed; operators can only cancel their
   own pending claims unless they also hold the canceller role.

---

## 2. Conflicts between PRD and design docs (PRD wins functionality, design wins visuals)

| #   | PRD                                                                             | Design                                                                               | Resolution                                                                                                                           |
| --- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | `ApprovedReserved` shown as warning/amber in PRD status guidance (§5, §9, §12). | §5.3 status chip is indigo/blue with a lock icon; §2 still calls reserved a warning. | Use the design's indigo badge with a lock icon and explicit text. Amber remains for `Pending`.                                       |
| C2  | PRD P0 benchmark is a script + exportable results (FR-BEN-01..03, Epic G).      | §5.6 defines interactive UI controls (start/cancel, presets) for the lab.            | Deliver both: in-app benchmark runner and a CLI benchmark; both emit the same report schema.                                         |
| C3  | PRD lists CSV export as P1.                                                     | Design never specifies a CSV export UI.                                              | Implement CSV export on Claims, claim detail timeline, and benchmark results (P1).                                                   |
| C4  | PRD lists risk-pool segmentation as P1.                                         | No risk-pool page or component is specified.                                         | Defer P1 segmentation (see assumptions); do not invent a UI that is absent from both docs.                                           |
| C5  | PRD says dashboard shows total shares and contract address (FR-LIQ-05).         | Design overview shows four metric cards only.                                        | Show the four metric cards as designed; surface total shares and contract addresses on Liquidity and Protocol pages.                 |
| C6  | PRD acceptance requires testnet deployment.                                     | Design only references configured network/explorer.                                  | Implement deployment scripts for both local Anvil and Monad Testnet; commit local verification, require user-funded key for testnet. |
| C7  | PRD is in Indonesian; design mixes Indonesian and English copy.                 | Design's copy table and empty states are Indonesian.                                 | UI copy is English throughout for consistency (execution brief prefers English). Documented as an assumption.                        |

---

## 3. Assumptions

1. **Language:** all UI copy, documentation, comments, and commit messages are English. Design copy
   examples were translated faithfully, preserving intent and warnings; no new marketing claims.
2. **Single-token protocol:** only mock USDC is supported. Batch settlement therefore never mixes
   assets; the UI still states that only same-asset claims are eligible.
3. **Share accounting base:** share price is based on available liquidity (PRD §8.1), so reserves
   reduce the withdrawable value per share. Deposits revert when shares exist but available
   liquidity is zero. No yield is promised.
4. **Self-approval:** disabled by default on testnet. Local demo deployment enables it explicitly so
   a single MetaMask account can complete the flow; contract tests cover the default-separated path.
5. **Claim IDs:** generated client-side as random `bytes32` values; the contract rejects duplicates.
   This satisfies "unique ID" without a server.
6. **Categories:** `uint8` IDs 1–8 with a local demo label map (Vehicle finance, Insurance claim,
   Repair, Total loss, Medical subrogation, Other). No PII and no on-chain label mapping.
7. **Branch codes:** `uint32` numeric codes with a local demo label map (e.g. `101 = Jakarta`,
   `102 = Surabaya`); labels are UI-only demo fixtures, not protocol truth.
8. **Faucet:** 100,000 mUSDC per request, 1-hour cooldown, 500,000 mUSDC lifetime cap per address,
   mint role restricted to admin/minter. Values are contract constants visible to the UI.
9. **Reserved-claim cancellation:** exposed only to `CLAIM_CANCELLER_ROLE`; it releases the
   reservation without transferring tokens.
10. **Batch cap:** 20 by default, admin-configurable up to 50. The UI reads the cap from the contract.
11. **Performance lab semantics:** transactions are sent sequentially so latency samples are not
    distorted by nonce contention. Settlement workloads include a separately measured setup phase.
    Throughput is labelled as observed frontend/RPC throughput, not chain capacity.
12. **Testnet deployment:** no funded testnet key was supplied to this environment. Deployment
    scripts are complete, local deployment is verified end to end, and testnet deployment is
    documented as a user step. No keys or RPC secrets are stored.
13. **Indexer:** not built (P2). Event history is read directly from RPC with a deployment block and
    logs; the README documents the scaling limitation.
14. **Risk pool segmentation (P1) is deferred:** implementing multiple pools/caps would require
    changing the core vault accounting model, which the PRD explicitly permits deferring if it
    threatens MVP delivery. The global liquidity constraint and utilisation metric remain.
15. **Off-chain evidence portal / external integrations (P2) are out of scope.**
16. **Charts:** no pie charts. Liquidity uses a stacked bar; benchmark uses a small bar chart plus a
    metrics table (Recharts) and all values are also available as text.

---

## 4. Tech stack (per PRD §11.1)

| Layer           | Choice                                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| Contracts       | Solidity `0.8.24`, OpenZeppelin Contracts `5.6.x`, Foundry                        |
| Frontend        | React 18 + TypeScript strict, Vite 6                                              |
| Styling         | Tailwind CSS 3.4, Inter (bundled via `@fontsource-variable/inter`), Lucide React  |
| Routing         | react-router-dom 7                                                                |
| Data            | @tanstack/react-query 5, wagmi 3, viem 2                                          |
| Charts          | Recharts 3                                                                        |
| Contracts tests | Foundry `forge test` (unit, fuzz, invariant)                                      |
| Frontend tests  | Vitest + Testing Library                                                          |
| E2E             | Playwright (Chromium) against Anvil with an injected EIP-1193 provider            |
| Lint/format     | ESLint 9 flat config + Prettier                                                   |
| CI              | GitHub Actions: contracts, frontend lint/typecheck/unit/build, e2e (optional job) |
| Package manager | pnpm workspaces                                                                   |

Why these choices: the PRD names this stack explicitly. Vite keeps the demo fast; wagmi/viem give
typed contract access and receipt-correct transaction states; no backend keeps the settlement state
single-sourced on-chain.

---

## 5. Folder structure

```text
.
├── contracts/
│   ├── foundry.toml
│   ├── src/
│   │   ├── MockUSDC.sol
│   │   ├── LiquidityVault.sol
│   │   ├── ClaimManager.sol
│   │   └── interfaces/IClaimManager.sol
│   ├── test/
│   │   ├── MockUSDC.t.sol
│   │   ├── LiquidityVault.t.sol
│   │   ├── ClaimManager.t.sol
│   │   ├── Invariants.t.sol
│   │   └── mocks/ReentrantToken.sol
│   └── script/ (reference deployment script)
├── frontend/
│   ├── src/
│   │   ├── app/ (providers, router)
│   │   ├── components/ (layout, wallet, data-display, transactions, ui)
│   │   ├── features/ (dashboard, liquidity, claims, settlement, benchmark, protocol)
│   │   ├── lib/ (chain, contracts, abis, format, errors, benchmark, csv, events, roles)
│   │   ├── config/
│   │   └── styles/
│   ├── e2e/
│   └── public/benchmark/latest.json
├── scripts/
│   ├── deploy.mjs
│   ├── seed.mjs
│   ├── sync-abis.mjs
│   ├── benchmark.mjs
│   └── dev-local.sh
├── deployments/ (generated; .example.json committed)
├── docs/ (benchmark methodology, demo script, deployment)
├── .github/workflows/ci.yml
├── .env.example
├── PLAN.md
├── CHECKLIST.md
└── README.md
```

---

## 6. Milestones and verification

| Milestone                         | Scope                                                               | Verification                 | Commit                                                                 |
| --------------------------------- | ------------------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- |
| M0 Discovery & plan               | Read docs, plan, conflicts, assumptions                             | PLAN.md complete             | `docs: add discovery summary and implementation plan`                  |
| M1 Scaffold                       | git, pnpm workspace, lint/format, env example, CI skeleton, Foundry | `pnpm lint`, `forge build`   | `chore: scaffold monorepo, tooling, and CI`                            |
| M2 Contracts                      | MockUSDC, vault, ClaimManager, events, roles, tests, invariant/fuzz | `forge test`                 | `feat(contracts): implement vault, claims, batch settlement and tests` |
| M3 Deployment & local chain       | Node deploy/seed scripts, ABIs, local chain, testnet instructions   | local deploy + seed verified | `feat(deploy): add local and Monad testnet deployment scripts`         |
| M4 Wallet + shell + design system | AppShell, tokens, network/wallet, tx state machine, errors          | lint, typecheck, unit        | `feat(ui): add design system, wallet connection and app shell`         |
| M5 Liquidity + dashboard          | Overview metrics, faucet, deposit/withdraw, share previews          | unit + e2e                   | `feat(ui): implement overview dashboard and liquidity flows`           |
| M6 Claims + settlement            | Claim queue, filters, detail timeline, role actions, batch preview  | unit + e2e                   | `feat(ui): implement claim lifecycle and batch settlement`             |
| M7 Benchmark + protocol + export  | Browser lab, CLI benchmark, Protocol page, CSV export               | unit + real benchmark run    | `feat(benchmark): add measured performance lab and exports`            |
| M8 QA, docs, checklist            | Full suite, Playwright flows, README, CHECKLIST, screenshots        | all checks + app smoke       | `docs: finalize README, verification checklist and demo guide`         |

PRD priority order is respected: P0 first, then P1 CSV export; P1 risk segmentation documented as
deferred. P2/excluded features are not started.

---

## 7. Requirements-to-task traceability

### 7.1 Functional requirements

| ID        | Requirement                                                  | Tasks / implementation                                        | Milestone |
| --------- | ------------------------------------------------------------ | ------------------------------------------------------------- | --------- |
| FR-WAL-01 | Connect/disconnect wallet                                    | wagmi injected connector, WalletButton menu                   | M4        |
| FR-WAL-02 | Show address + active network                                | WalletButton, NetworkBadge                                    | M4        |
| FR-WAL-03 | Wrong-network switch; disable writes                         | NetworkGuard banner + `switchChain`; action guards            | M4        |
| FR-WAL-04 | Tx states: wallet required/awaiting/pending/confirmed/failed | TransactionProvider + TransactionToast + inline state         | M4        |
| FR-LIQ-01 | Deposit after allowance                                      | Allowance read, approve + deposit flow                        | M5        |
| FR-LIQ-02 | Receive/read shares                                          | Vault shares, LP position panel                               | M5        |
| FR-LIQ-03 | Withdraw from available value                                | Withdraw by shares, available-based preview                   | M5        |
| FR-LIQ-04 | Never withdraw reserved funds                                | Vault math + reserved tests + UI warning                      | M2/M5     |
| FR-LIQ-05 | Dashboard metrics + addresses                                | Metric cards, liquidity summary, Protocol page                | M5/M7     |
| FR-LIQ-06 | Vault events                                                 | Deposited/Withdrawn/LiquidityReserved/Released/PayoutExecuted | M2        |
| FR-CLM-01 | Authorized unique claim creation                             | submitClaim role/duplicate validation, New claim modal        | M2/M6     |
| FR-CLM-02 | Claim detail fields                                          | Claim struct, detail information grid                         | M2/M6     |
| FR-CLM-03 | Approve/reject pending                                       | approveClaim/rejectClaim + role-aware UI                      | M2/M6     |
| FR-CLM-04 | Atomic approve + reserve, insufficient fails                 | Vault.reserve inside approval, custom errors, UI copy         | M2/M6     |
| FR-CLM-05 | Pending cancellation by authorized role                      | cancelClaim with operator/canceller rules                     | M2/M6     |
| FR-CLM-06 | Reserved release only via authorized cancellation            | cancelClaim releases via vault.release                        | M2/M6     |
| FR-CLM-07 | Terminal states immutable                                    | status checks + all transition tests                          | M2        |
| FR-SET-01 | Single settlement                                            | settleClaim                                                   | M2/M6     |
| FR-SET-02 | Batch settlement up to cap                                   | settleBatch + maxBatchSize + UI cap                           | M2/M6     |
| FR-SET-03 | No double payout                                             | status + reservation checks + tests                           | M2        |
| FR-SET-04 | No partial batch payout                                      | single-tx revert loop + invalid batch test                    | M2        |
| FR-SET-05 | Batch preview details                                        | BatchPreview drawer with recipients, total, cap, gas, warning | M6        |
| FR-AUD-01 | Claim/pool event timeline                                    | event decoding hooks + Timeline                               | M6        |
| FR-AUD-02 | Explorer links per confirmed tx                              | tx hash tracker across flows + AddressText links              | M4–M7     |
| FR-BEN-01 | Repeatable synthetic workload                                | browser runner + CLI benchmark                                | M7        |
| FR-BEN-02 | Counts, latency, gas, throughput                             | report schema + metrics engine + tests                        | M7        |
| FR-BEN-03 | Environment/method limitations                               | report metadata + methodology note + docs                     | M7/M8     |

### 7.2 Non-functional requirements

| Area          | Implementation                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Security      | OZ AccessControl/SafeERC20/ReentrancyGuard; CEI; custom errors; unauthorized/double-pay/insufficient/zero/duplicate/status/batch tests; capped faucet |
| Privacy       | No PII fields; hash-only metadata; UI privacy banner; synthetic demo data                                                                             |
| Reliability   | receipt-gated confirmations; read retry UI; no blind write retries; config via env; batch cap tested                                                  |
| Accessibility | labelled inputs, focus rings, text + icon statuses, keyboard dialogs, skip link, table/card responsive layouts                                        |
| UX            | skeletons, empty/error/read-failure states, human-readable errors, 6-decimal formatting, mobile layouts                                               |

### 7.3 Design acceptance items (design.md §13)

| Item                                     | Implementation                                             |
| ---------------------------------------- | ---------------------------------------------------------- |
| Distinguish available/reserved/total     | Metric cards, stacked bar, labels and definitions          |
| Approved & Reserved distinct from Paid   | Indigo lock badge vs green badge                           |
| Confirmation steps for risky actions     | ConfirmActionDialog for approve/reject/cancel/payout/batch |
| Distinct RPC/permission/liquidity errors | `lib/errors.ts` classification + copy                      |
| Persistent disclosure                    | DemoEnvironmentBanner in shell                             |
| Table with filters                       | Claims table/cards + status/category/branch/search/sort    |
| Timeline + tx links                      | Claim detail timeline, explorer hrefs                      |
| Batch preview completeness               | Total, list, cap, gas estimate, atomic warning             |
| No PII                                   | Schema and UI copy                                         |
| Loading/empty/pending/failed/confirmed   | Page skeletons, empty states, tx states                    |
| Responsive desktop/mobile                | Tailwind breakpoints, drawer sidebar, card list            |
| Keyboard/labels/textual status           | Component implementations + tests                          |
| 6-decimal tabular numbers                | `formatTokenAmount`, `tabular-nums`                        |
| Never show read errors as zero           | Read-error component retains `undefined`, shows error      |

---

## 8. Security and correctness notes

- All state-changing entry points enforce roles in `ClaimManager`; the vault restricts reserve/
  release/payout to the configured ClaimManager via `CLAIM_MANAGER_ROLE`.
- Approval updates claim state before calling the vault; transaction rollback preserves atomicity.
- Payout deletes the reservation before the token transfer and is `nonReentrant`.
- Batch settlement validates the full batch before any payout, rejects duplicates, and executes in
  one transaction; any revert rolls back earlier payouts.
- `totalReserved` can never exceed the vault token balance because reserves require available
  liquidity and payouts/releases reduce both reserved and (for payouts) balance by the same amount.
- The mock token is not production USDC; contracts are unaudited and testnet-only.
- No private keys, RPC secrets, or PII are committed. Only local Anvil accounts (publicly known
  dev accounts) are used by tests; testnet deployment requires the user's own env key.
