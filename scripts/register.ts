import {
  type RhinestoneAccountConfig,
  RhinestoneSDK,
  type TokenSymbol,
} from "@rhinestone/sdk";
import type { Address, Hex } from "viem";
import { plasma, arbitrumSepolia } from "viem/chains";
import { isTestnet, rhinestoneAccount, signerAccount } from "./common";

interface AccountInput {
  address: Address;
  accountParams: {
    factory: Address;
    factoryData: Hex;
  };
  target: {
    chain: number;
    token: Address | TokenSymbol;
  };
}

const rhinestoneApiKey = process.env.RHINESTONE_API_KEY;
if (!rhinestoneApiKey) {
  throw new Error("RHINESTONE_API_KEY is not set");
}
const depositProcessorUrl = process.env.DEPOSIT_PROCESSOR_URL;
if (!depositProcessorUrl) {
  throw new Error("DEPOSIT_PROCESSOR_URL is not set");
}

const targetChain = isTestnet ? arbitrumSepolia : plasma;
// const targetToken = "USDC";
const targetToken = "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb";

const config: RhinestoneAccountConfig = {
  account: {
    type: "nexus",
  },
  owners: {
    type: "ecdsa",
    accounts: [signerAccount, rhinestoneAccount],
  },
};

const rhinestone = new RhinestoneSDK();
const account = await rhinestone.createAccount(config);
const { factory, factoryData } = account.getInitData();

const accountInput: AccountInput = {
  address: account.getAddress(),
  accountParams: {
    factory,
    factoryData,
  },
  target: {
    chain: targetChain.id,
    token: targetToken,
  },
};

const response = await fetch(`${depositProcessorUrl}/register`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": rhinestoneApiKey,
  },
  body: JSON.stringify({
    account: accountInput,
  }),
});
console.log(`Register response: ${response.status}`);
const data = await response.json();
console.log(data);
