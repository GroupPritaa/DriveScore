import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";

export function useWallet() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    if (typeof window.ethereum === "undefined") {
      alert("Please install MetaMask!");
      return;
    }

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();
      const signer = await provider.getSigner();

      setProvider(window.ethereum);
      setChainId(Number(network.chainId));
      setAccounts(accounts);
      setSigner(signer);
      setIsConnected(true);
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window.ethereum === "undefined") {
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    
    const checkConnection = async () => {
      try {
        const accounts = await provider.send("eth_accounts", []);
        if (accounts.length > 0) {
          const network = await provider.getNetwork();
          const signer = await provider.getSigner();
          setProvider(window.ethereum);
          setChainId(Number(network.chainId));
          setAccounts(accounts);
          setSigner(signer);
          setIsConnected(true);
        }
      } catch (error) {
        console.error("Failed to check connection:", error);
      }
    };

    checkConnection();

    const handleAccountsChanged = (accounts: string[]) => {
      setAccounts(accounts);
      setIsConnected(accounts.length > 0);
    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
        window.ethereum.removeListener("chainChanged", handleChainChanged);
      }
    };
  }, []);

  return {
    provider,
    chainId,
    accounts,
    signer,
    isConnected,
    connect,
  };
}

interface EthereumProvider extends ethers.Eip1193Provider {
  on(event: string, handler: (...args: any[]) => void): void;
  removeListener(event: string, handler: (...args: any[]) => void): void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

