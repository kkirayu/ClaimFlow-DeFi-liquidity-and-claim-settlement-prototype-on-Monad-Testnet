import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  decodeErrorResult,
  type Abi,
  type Hex,
} from 'viem';
import { claimManagerAbi, liquidityVaultAbi, mockUSDCAbi } from './contracts';
import { formatDateTime, formatToken } from './format';

export type ErrorKind =
  | 'wallet-required'
  | 'rejected'
  | 'wrong-network'
  | 'insufficient-liquidity'
  | 'access-denied'
  | 'invalid-state'
  | 'validation'
  | 'rpc'
  | 'configuration'
  | 'unknown';

export interface AppError {
  kind: ErrorKind;
  title: string;
  message: string;
  details?: string;
  txHash?: string;
}

const ABIS: Abi[] = [claimManagerAbi, liquidityVaultAbi, mockUSDCAbi];

const ERROR_MAP: Record<string, { kind: ErrorKind; title: string; message: string }> = {
  AccessControlUnauthorizedAccount: {
    kind: 'access-denied',
    title: 'Action requires a protocol role',
    message:
      'Your wallet does not hold the required role. Permissions are enforced by the smart contract, not just the interface.',
  },
  SelfApprovalNotAllowed: {
    kind: 'access-denied',
    title: 'Self-approval is disabled',
    message: 'This claim was submitted by the same wallet. A different approver must review it.',
  },
  NotAuthorizedToCancel: {
    kind: 'access-denied',
    title: 'Not authorized to cancel',
    message:
      'Only the claim creator (while holding the operator role) or an authorized canceller can cancel this claim.',
  },
  InsufficientLiquidity: {
    kind: 'insufficient-liquidity',
    title: 'Not enough available liquidity',
    message:
      'Available liquidity is not enough to reserve this claim. Reserved funds cannot be used for new approvals.',
  },
  NoLiquidityForDeposit: {
    kind: 'insufficient-liquidity',
    title: 'Deposit is unavailable right now',
    message:
      'All pool liquidity is currently reserved. Deposits are blocked while the available share price cannot be determined.',
  },
  NoLiquidityForWithdrawal: {
    kind: 'insufficient-liquidity',
    title: 'No available liquidity to withdraw',
    message: 'Reserved funds cannot be withdrawn. Try again after claims are settled or released.',
  },
  InsufficientShares: {
    kind: 'validation',
    title: 'Not enough pool shares',
    message: 'The requested share amount exceeds your pool position.',
  },
  ReservationMissing: {
    kind: 'invalid-state',
    title: 'Claim cannot be paid',
    message:
      'This claim has no active reservation. It may already be paid, cancelled, or was never approved.',
  },
  ReservationMismatch: {
    kind: 'invalid-state',
    title: 'Reservation does not match payout',
    message:
      'The reserved amount differs from the payout amount, so the contract rejected the transfer.',
  },
  InvalidStatus: {
    kind: 'invalid-state',
    title: 'Claim is not in the required state',
    message:
      'The claim has already moved to another state. Refresh the page to read the latest on-chain status.',
  },
  ClaimAlreadyExists: {
    kind: 'validation',
    title: 'Claim ID already exists',
    message: 'Claim IDs must be unique. Generate a new claim ID and try again.',
  },
  ClaimNotFound: {
    kind: 'invalid-state',
    title: 'Claim not found',
    message: 'This claim ID does not exist on the configured ClaimManager.',
  },
  FaucetCooldownActive: {
    kind: 'validation',
    title: 'Faucet cooldown is active',
    message:
      'This wallet has already requested demo tokens recently. Try again after the cooldown.',
  },
  FaucetCapExceeded: {
    kind: 'validation',
    title: 'Faucet limit reached',
    message: 'This wallet has reached the maximum demo token amount available from the faucet.',
  },
  ERC20InsufficientBalance: {
    kind: 'validation',
    title: 'Insufficient mUSDC balance',
    message: 'Your wallet does not hold enough demo USDC for this deposit.',
  },
  ERC20InsufficientAllowance: {
    kind: 'validation',
    title: 'Approval required',
    message: 'Approve mUSDC spending before depositing into the vault.',
  },
  InsufficientFundsError: {
    kind: 'wallet-required',
    title: 'Not enough testnet gas',
    message: 'The connected account needs testnet MON to pay for gas.',
  },
  ChainMismatchError: {
    kind: 'wrong-network',
    title: 'Wrong network',
    message: 'Switch your wallet to the configured ClaimFlow network before sending a transaction.',
  },
  SwitchChainError: {
    kind: 'wrong-network',
    title: 'Could not switch network',
    message: 'Add the ClaimFlow network to your wallet and try again.',
  },
  UserRejectedRequestError: {
    kind: 'rejected',
    title: 'Transaction rejected',
    message: 'You rejected the request in your wallet. Nothing was sent on-chain.',
  },
};

function extractNameAndArgs(error: unknown): { name?: string; args?: readonly unknown[] } {
  if (!(error instanceof BaseError)) return {};

  const reverted = error.walk(
    (cause) => cause instanceof ContractFunctionRevertedError,
  ) as ContractFunctionRevertedError | null;

  if (reverted) {
    if (reverted.data?.errorName) {
      return {
        name: reverted.data.errorName,
        args: reverted.data.args as readonly unknown[] | undefined,
      };
    }
    if (reverted.raw) {
      for (const abi of ABIS) {
        try {
          const decoded = decodeErrorResult({ abi, data: reverted.raw });
          return { name: decoded.errorName, args: decoded.args as readonly unknown[] };
        } catch {
          // Try the next ABI.
        }
      }
    }
  }

  // Some providers only expose raw revert data on the cause.
  let current: unknown = error;
  while (current && typeof current === 'object') {
    const candidate = (current as { data?: unknown }).data;
    if (typeof candidate === 'string' && candidate.startsWith('0x') && candidate.length > 10) {
      for (const abi of ABIS) {
        try {
          const decoded = decodeErrorResult({ abi, data: candidate as Hex });
          return { name: decoded.errorName, args: decoded.args as readonly unknown[] };
        } catch {
          // Try the next ABI.
        }
      }
    }
    current = (current as { cause?: unknown }).cause;
  }

  return {};
}

function extractTxHash(error: unknown): string | undefined {
  if (!(error instanceof BaseError)) return undefined;
  const match = error.message.match(/0x[a-fA-F0-9]{64}/);
  return match?.[0];
}

export function describeError(error: unknown): AppError {
  const details =
    error instanceof BaseError ? error.shortMessage : error instanceof Error ? error.message : '';

  if (
    error instanceof UserRejectedRequestError ||
    /user rejected|rejected the request/i.test(details)
  ) {
    return { ...ERROR_MAP.UserRejectedRequestError!, details };
  }

  const { name, args } = extractNameAndArgs(error);
  const mapped = name ? ERROR_MAP[name] : undefined;

  if (name === 'FaucetCooldownActive' && args?.[0] !== undefined) {
    return {
      kind: 'validation',
      title: 'Faucet cooldown is active',
      message: `This wallet can request demo tokens again after ${formatDateTime(
        Number(args[0]),
      )}.`,
      details,
    };
  }

  if (name === 'InsufficientLiquidity' && args) {
    return {
      kind: 'insufficient-liquidity',
      title: 'Not enough available liquidity',
      message: `The claim needs ${formatToken(BigInt(String(args[1] ?? 0)))} mUSDC but only ${formatToken(
        BigInt(String(args[0] ?? 0)),
      )} mUSDC is available. Reserved funds cannot be used.`,
      details,
    };
  }

  if (mapped) {
    return { ...mapped, details };
  }

  if (/insufficient funds|exceeds the balance/i.test(details)) {
    return { ...ERROR_MAP.InsufficientFundsError!, details };
  }
  if (/user rejected|4001|denied transaction/i.test(details)) {
    return { ...ERROR_MAP.UserRejectedRequestError!, details };
  }
  if (/chain mismatch|does not match the target chain/i.test(details)) {
    return { ...ERROR_MAP.ChainMismatchError!, details };
  }
  if (/timeout|timed out|failed to fetch|network error|rate limit|429|502|503|504/i.test(details)) {
    return {
      kind: 'rpc',
      title: 'RPC request failed',
      message:
        'The network request did not complete. Read-only data can be retried; a transaction is not assumed successful until its receipt is confirmed.',
      details,
    };
  }
  if (/returned no data|is not a contract|call revert exception/i.test(details)) {
    return {
      kind: 'configuration',
      title: 'Contract is not available',
      message:
        'The configured address did not respond as a ClaimFlow contract. Check the deployment and network configuration.',
      details,
      txHash: extractTxHash(error),
    };
  }

  return {
    kind: 'unknown',
    title: 'Transaction could not be completed',
    message:
      'The request failed. Check the claim status, your role, and available liquidity before trying again.',
    details,
    txHash: extractTxHash(error),
  };
}

export function readErrorMessage(error: unknown): AppError {
  const described = describeError(error);
  if (described.kind === 'unknown') {
    return {
      ...described,
      title: 'Could not load on-chain data',
      message:
        'The app could not read from the configured RPC. Values are not shown as zero because the read failed. Retry the request.',
    };
  }
  if (described.kind === 'rejected') {
    return {
      ...described,
      title: 'RPC read failed',
      message: 'The RPC provider did not return data. Retry the request.',
    };
  }
  return described;
}
