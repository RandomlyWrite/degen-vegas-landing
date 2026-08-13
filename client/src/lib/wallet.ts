/*
 * DEGEN VEGAS wallet layer
 * EIP-1193 browser-wallet integration with a safe demo fallback.
 * This layer only requests the public account and chain ID; it never signs
 * messages or sends transactions.
 */

export type WalletProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type WalletSnapshot = {
  address: string;
  chainId: string;
  isDemo: boolean;
};

declare global {
  interface Window {
    ethereum?: WalletProvider;
  }
}

export function getInjectedProvider() {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export async function connectWallet(): Promise<WalletSnapshot> {
  const provider = getInjectedProvider();

  if (!provider) {
    return {
      address: "0xDEMO…VEGAS",
      chainId: "demo",
      isDemo: true,
    };
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  const chainId = (await provider.request({
    method: "eth_chainId",
  })) as string;

  if (!accounts?.[0]) {
    throw new Error("No wallet account was returned.");
  }

  return {
    address: accounts[0],
    chainId,
    isDemo: false,
  };
}

export async function readWalletSnapshot(): Promise<WalletSnapshot | null> {
  const provider = getInjectedProvider();
  if (!provider) return null;

  const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
  if (!accounts?.[0]) return null;

  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  return { address: accounts[0], chainId, isDemo: false };
}

export function shortAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function formatChain(chainId: string) {
  if (chainId === "demo") return "DEMO TABLE";
  const numeric = Number.parseInt(chainId, 16);
  if (numeric === 1) return "ETH MAINNET";
  if (numeric === 11155111) return "SEPOLIA TESTNET";
  if (numeric === 8453) return "BASE";
  if (numeric === 84532) return "BASE SEPOLIA";
  return `CHAIN ${numeric || chainId}`;
}
