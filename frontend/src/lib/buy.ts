'use client';

// Tanur — buy TANUR by spending USDC through the SDEX (path payment strict send).
// Requires a TANUR/USDC offer on the book (the treasury posts one — see
// deploy/run-loop.sh) and a KYC-authorized TANUR trustline on the buyer.
import * as StellarSdk from '@stellar/stellar-sdk';
import { ASSETS } from './config';
import { horizon, PASSPHRASE } from './stellar';

const usdcAsset = () => new StellarSdk.Asset(ASSETS.usdc.code, ASSETS.usdc.issuer);
const tanurAsset = () =>
  new StellarSdk.Asset(ASSETS.tanur.code, ASSETS.tanur.issuer);

export async function buildBuyXdr(
  buyer: string,
  usdcAmount: string,
  minTanur = '0.0000001'
): Promise<string> {
  const account = await horizon.loadAccount(buyer);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.pathPaymentStrictSend({
        sendAsset: usdcAsset(),
        sendAmount: usdcAmount,
        destination: buyer,
        destAsset: tanurAsset(),
        destMin: minTanur,
        path: [],
      })
    )
    .setTimeout(120)
    .build();
  return tx.toXDR();
}
