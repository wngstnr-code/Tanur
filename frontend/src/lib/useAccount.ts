'use client';

import { useCallback, useEffect, useState } from 'react';
import { getKit } from './wallet';

const LS_KEY = 'tanur:wallet';

/**
 * Wallet-account hook built on Stellar Wallets Kit (Freighter / Lobstr / xBull).
 * Tracks the active address and exposes connect/disconnect. Reconnects silently
 * from localStorage on load.
 */
export function useAccount() {
  const [address, setAddress] = useState<string | undefined>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null;
    if (saved) {
      getKit().setWallet(saved.split('|')[0]);
      setAddress(saved.split('|')[1] || undefined);
    }
    setReady(true);
  }, []);

  const connect = useCallback(async () => {
    const kit = getKit();
    await kit.openModal({
      onWalletSelected: async (option) => {
        kit.setWallet(option.id);
        const { address: addr } = await kit.getAddress();
        setAddress(addr);
        localStorage.setItem(LS_KEY, `${option.id}|${addr}`);
      },
    });
  }, []);

  const disconnect = useCallback(() => {
    setAddress(undefined);
    localStorage.removeItem(LS_KEY);
  }, []);

  return {
    address,
    publicKey: address,
    connected: Boolean(address),
    ready,
    connect,
    disconnect,
  };
}
