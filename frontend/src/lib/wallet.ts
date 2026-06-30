'use client';

// Tanur — multi-wallet connection via Stellar Wallets Kit (Freighter default).
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from '@creit.tech/stellar-wallets-kit';
import { PASSPHRASE } from './stellar';

let _kit: StellarWalletsKit | null = null;

export function getKit(): StellarWalletsKit {
  if (!_kit) {
    _kit = new StellarWalletsKit({
      network: WalletNetwork.TESTNET,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }
  return _kit;
}

export async function signXdr(xdr: string, address: string): Promise<string> {
  const { signedTxXdr } = await getKit().signTransaction(xdr, {
    address,
    networkPassphrase: PASSPHRASE,
  });
  return signedTxXdr;
}
