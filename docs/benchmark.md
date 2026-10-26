# Benchmark methodology

ClaimFlow measures a **declared synthetic workload** and reports only observed values. It does not
estimate maximum chain capacity, and it does not compare chains.

## What is measured

| Operation       | Samples                                   | Setup excluded from samples     |
| --------------- | ----------------------------------------- | ------------------------------- |
| `read`          | Sequential `availableLiquidity()` reads   | None                            |
| `submit`        | Independent `submitClaim` transactions    | None                            |
| `settle-single` | Sequential `settleClaim` transactions     | Submit + approve for each claim |
| `settle-batch`  | All-or-nothing `settleBatch` transactions | Submit + approve for each claim |

Transactions are sent **sequentially** so nonce contention does not distort latency. Every sample
records:

- submitted timestamp, confirmed timestamp, end-to-end latency (ms);
- transaction hash, block number, gas used, and final status;
- an error message for failed or reverted samples.

## Metrics

| Metric                      | Definition                                                         |
| --------------------------- | ------------------------------------------------------------------ |
| Attempted                   | Samples scheduled in the measured phase                            |
| Submitted                   | Samples that returned a transaction hash                           |
| Confirmed                   | Receipts with `status = success`                                   |
| Reverted / failed / skipped | Receipt reverted / client or RPC error / intentionally skipped     |
| Success rate                | Confirmed ÷ attempted                                              |
| Median latency              | Median submit → receipt time for confirmed samples                 |
| p95 latency                 | 95th percentile for confirmed samples; shown only with ≥ 5 samples |
| Throughput                  | Confirmed samples ÷ measured phase duration (tx/s)                 |
| Total gas                   | Sum of `gasUsed` in the measured phase                             |
| Median gas                  | Median `gasUsed` per confirmed transaction                         |
| Claims processed            | Claims actually paid (settlement workloads)                        |
| Setup time                  | Time spent preparing claims, explicitly excluded from throughput   |

`p95` uses linear interpolation over the sorted latency series. Latency includes wallet/network/RPC
and block inclusion time on the target chain; it is **not** pure execution time.

## Running the browser lab

1. Open **Performance Lab**.
2. Choose an operation, workload size (`10`, `25`, `50`), and batch size where applicable.
3. Start the workload. Cancellation stops unsent work; already submitted transactions are not
   cancelled.
4. Export CSV or JSON. Recent reports are stored in `localStorage`; the committed reference report
   is loaded from `/benchmark/latest.json`.

Preflight rules:

- Settlement workloads need available liquidity ≥ 1 mUSDC × workload.
- The connected wallet needs the required roles.
- Self-approval must be enabled (or separate operator/approver wallets used) for setup.
- Batch size must not exceed the on-chain cap.

## Running the CLI

```bash
# Read-only latency
node scripts/benchmark.mjs --network local --operation read --size 25

# Sequential single settlements
node scripts/benchmark.mjs --network local --operation settle-single --size 10

# Batch settlements
node scripts/benchmark.mjs --network local --operation settle-batch --size 10 --batch 5

# Testnet (requires PRIVATE_KEY with roles and liquidity)
node scripts/benchmark.mjs --network testnet --operation read --size 10 --publish
```

Options:

| Flag          | Default                                   | Notes                                                  |
| ------------- | ----------------------------------------- | ------------------------------------------------------ |
| `--network`   | `local`                                   | `local` or `testnet`                                   |
| `--operation` | `read`                                    | See table above                                        |
| `--size`      | `10`                                      | Max 100 per run                                        |
| `--batch`     | `5`                                       | Batch size for `settle-batch`; capped by contract      |
| `--out`       | `benchmark-results/<op>-<timestamp>.json` | Also writes a sibling `.csv`                           |
| `--publish`   | off                                       | Copies JSON to `frontend/public/benchmark/latest.json` |

The CLI uses the deployment record in `deployments/<chainId>.json`, the public Anvil account locally,
and `PRIVATE_KEY` on testnet. It does not read or write private keys anywhere else.

## Committed reference run

`frontend/public/benchmark/latest.json` is a real local run, not a hand-authored sample:

| Field          | Value                                             |
| -------------- | ------------------------------------------------- |
| Operation      | Batch settlements                                 |
| Network        | Anvil Local, chain 31337                          |
| Workload       | 10 claims, batch size 5 → 2 measured transactions |
| Setup          | 10 submits + 10 approvals, 4.289 s, excluded      |
| Success        | 2 / 2 (100%)                                      |
| Median latency | 16 ms                                             |
| p95            | Not reported (fewer than 5 samples)               |
| Throughput     | 62.5 tx/s observed                                |
| Total gas      | 391,030                                           |
| Median gas     | 204,059                                           |

This demonstrates the measurement pipeline and batch gas profile on a local node. Local Anvil
latency is not representative of Monad Testnet or mainnet conditions. To publish a real testnet
reference, fund a key with the required roles and liquidity, then run the CLI with
`--network testnet --publish`.

## Report schema

```jsonc
{
  "version": 1,
  "id": "1793028364568-925aa7f3",
  "source": "cli", // or "browser"
  "operation": "settle-batch",
  "workloadSize": 10,
  "batchSize": 5,
  "chainId": 31337,
  "chainName": "Anvil Local",
  "rpcProvider": "Local Anvil RPC",
  "signer": "0x...",
  "startedAt": "2026-10-26T15:26:04.568Z",
  "finishedAt": "2026-10-26T15:26:08.889Z",
  "durationMs": 32,
  "setupMs": 4289,
  "setupNotes": "10 synthetic claims ... 20 setup transactions are excluded ...",
  "samples": [
    {
      "index": 0,
      "label": "Settle batch 1 (5 claims)",
      "status": "success",
      "txHash": "0x...",
      "submittedAt": 1793028364578,
      "confirmedAt": 1793028364594,
      "latencyMs": 16,
      "gasUsed": 203291,
      "blockNumber": 40,
    },
  ],
  "summary": { "attempted": 2, "confirmed": 2, "medianLatencyMs": 16, "totalGas": 391030 },
  "methodology": "Transactions were sent sequentially ...",
}
```

The CSV export contains report identity, environment, sample status/timestamps/latency/gas, and
errors.

## Limitations

- Results describe only the workload, signer, RPC provider, and time window shown.
- Sequential submission measures end-to-end client latency, not validator parallelism.
- Local Anvil is a development node; use testnet numbers for any external claim.
- Read workloads include RPC round trips, not contract execution alone.
- Throughput is limited by the runner’s sequencing by design. It is not a capacity benchmark.
- Gas values include the fixed cost of the transaction and batch loop; they vary with calldata.
- No statistical confidence intervals are reported; treat small samples as directional.
