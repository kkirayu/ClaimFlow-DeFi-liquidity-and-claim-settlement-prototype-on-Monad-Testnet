import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConnection, useWalletClient } from 'wagmi';
import type { Abi, Address, Hex, TransactionReceipt } from 'viem';
import { CHAIN_ID, chain, publicClient } from '@/lib/chain';
import { describeError, type AppError } from '@/lib/errors';
import { TransactionToast } from '@/components/transactions/TransactionToast';

export type TxPhase = 'idle' | 'awaiting-signature' | 'pending' | 'confirmed' | 'failed';

export interface ContractWriteRequest {
  address: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

export interface TxState {
  id: number;
  phase: TxPhase;
  label: string;
  hash?: Hex;
  error?: AppError;
  startedAt?: number;
  confirmedAt?: number;
  receipt?: TransactionReceipt;
}

export interface TxRunOptions {
  label: string;
  request: ContractWriteRequest;
  successMessage?: string;
  onConfirmed?: (receipt: TransactionReceipt) => void | Promise<void>;
}

export interface TxResult {
  hash: Hex;
  receipt: TransactionReceipt;
}

interface TransactionContextValue {
  state: TxState;
  isBusy: boolean;
  run: (options: TxRunOptions) => Promise<TxResult | undefined>;
  reset: () => void;
}

const IDLE: TxState = { id: 0, phase: 'idle', label: '' };
const TransactionContext = createContext<TransactionContextValue | null>(null);

export function TransactionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { isConnected, chainId } = useConnection();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<TxState>(IDLE);
  const idRef = useRef(0);
  const busyRef = useRef(false);

  const reset = useCallback(() => {
    if (busyRef.current) return;
    setState(IDLE);
  }, []);

  const run = useCallback(
    async (options: TxRunOptions): Promise<TxResult | undefined> => {
      if (busyRef.current) return undefined;

      const fail = (error: AppError) => {
        idRef.current += 1;
        setState({ id: idRef.current, phase: 'failed', label: options.label, error });
        busyRef.current = false;
        return undefined;
      };

      if (!isConnected || !walletClient?.account) {
        return fail({
          kind: 'wallet-required',
          title: 'Wallet connection required',
          message: 'Connect an EVM wallet before sending a transaction.',
        });
      }

      if (chainId !== CHAIN_ID) {
        return fail({
          kind: 'wrong-network',
          title: 'Wrong network',
          message: `Switch the wallet to ${chain.name} (chain ${CHAIN_ID}) before sending a transaction.`,
        });
      }

      idRef.current += 1;
      const id = idRef.current;
      const startedAt = Date.now();
      busyRef.current = true;
      setState({ id, phase: 'awaiting-signature', label: options.label, startedAt });

      let hash: Hex | undefined;
      try {
        hash = await walletClient.writeContract({
          ...options.request,
          account: walletClient.account,
          chain,
        } as never);

        setState({ id, phase: 'pending', label: options.label, hash, startedAt });

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
          return fail({
            kind: 'invalid-state',
            title: 'Transaction reverted',
            message:
              'The transaction was confirmed but reverted on-chain. Check the claim status, role, and available liquidity. Reserved state was not changed optimistically.',
            txHash: hash,
          });
        }

        setState({
          id,
          phase: 'confirmed',
          label: options.label,
          hash,
          startedAt,
          confirmedAt: Date.now(),
          receipt,
        });
        busyRef.current = false;

        await queryClient.invalidateQueries();
        if (options.onConfirmed) {
          try {
            await options.onConfirmed(receipt);
          } catch {
            // A UI callback must never rewrite a confirmed on-chain outcome.
          }
        }

        return { hash, receipt };
      } catch (error) {
        const described = describeError(error);
        return fail({ ...described, txHash: described.txHash ?? hash });
      }
    },
    [chainId, isConnected, queryClient, walletClient],
  );

  const value = useMemo<TransactionContextValue>(
    () => ({
      state,
      isBusy: state.phase === 'awaiting-signature' || state.phase === 'pending',
      run,
      reset,
    }),
    [reset, run, state],
  );

  return (
    <TransactionContext.Provider value={value}>
      {children}
      <TransactionToast />
    </TransactionContext.Provider>
  );
}

export function useTransaction(): TransactionContextValue {
  const context = useContext(TransactionContext);
  if (!context) throw new Error('useTransaction must be used inside TransactionProvider.');
  return context;
}
