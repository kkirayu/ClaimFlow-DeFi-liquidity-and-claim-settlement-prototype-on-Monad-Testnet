/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_CHAIN_NAME?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_EXPLORER_URL?: string;
  readonly VITE_EXPLORER_NAME?: string;
  readonly VITE_NATIVE_SYMBOL?: string;
  readonly VITE_NETWORK_LABEL?: string;
  readonly VITE_PROVIDER_LABEL?: string;
  readonly VITE_MOCK_USDC_ADDRESS?: string;
  readonly VITE_VAULT_ADDRESS?: string;
  readonly VITE_CLAIM_MANAGER_ADDRESS?: string;
  readonly VITE_DEPLOYMENT_BLOCK?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_BENCHMARK_PROVIDER_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
