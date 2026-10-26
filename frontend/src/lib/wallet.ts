import { addChainParams, CHAIN_ID } from './chain';

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
}

interface ConnectorLike {
  getProvider: () => Promise<unknown>;
}

/**
 * Switches an injected wallet to the configured ClaimFlow chain. If the chain is unknown to the
 * wallet, it is added first using only public values from the deployment configuration.
 */
export async function switchToClaimFlowNetwork({
  connector,
  switchChain,
}: {
  connector?: ConnectorLike;
  switchChain: (args: { chainId: number }) => Promise<unknown>;
}): Promise<void> {
  try {
    await switchChain({ chainId: CHAIN_ID });
    return;
  } catch (error) {
    const provider = (await connector?.getProvider()) as Eip1193Provider | undefined;
    if (!provider) throw error;
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [addChainParams()],
    });
    await switchChain({ chainId: CHAIN_ID });
  }
}
