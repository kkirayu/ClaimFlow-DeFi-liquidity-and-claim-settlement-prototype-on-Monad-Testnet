import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { chain, CHAIN_ID, RPC_URL } from './chain';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();

const connectors = [injected({ shimDisconnect: true })];

if (projectId && projectId !== 'undefined') {
  connectors.push(
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name: 'ClaimFlow',
        description: 'Liquidity and claim settlement demo on Monad Testnet',
        url: window.location.origin,
        icons: [`${window.location.origin}/favicon.svg`],
      },
    }),
  );
}

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors,
  transports: {
    [CHAIN_ID]: http(RPC_URL),
  },
  ssr: false,
});
