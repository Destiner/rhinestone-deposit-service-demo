import {
  type RhinestoneAccountConfig,
  RhinestoneSDK,
  type TokenSymbol,
} from "@rhinestone/sdk";
import type { Address, Hex } from "viem";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  bsc,
  mainnet,
  optimism,
  optimismSepolia,
  plasma,
  plasmaTestnet,
  polygon,
} from "viem/chains";
import {
  type EnableSessionDetails,
  getSessionDetails,
  isTestnet,
  signerAccount,
} from "./common";

interface AccountInput {
  address: Address;
  accountParams: {
    factory: Address;
    factoryData: Hex;
    sessionDetails: EnableSessionDetails;
  };
  target: {
    chain: number;
    token: Address | TokenSymbol;
    recipient?: Address;
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

// Configure chains
const targetChain = isTestnet ? plasmaTestnet : plasma;
const sourceChains = isTestnet
  ? [baseSepolia, optimismSepolia, arbitrumSepolia]
  : [mainnet, base, optimism, arbitrum, polygon, bsc];

// Token on the target chain
const targetToken = isTestnet
  ? "0x502012b361aebce43b26ec812b74d9a51db4d412"
  : "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb";

// Create account config with sessions enabled
const config: RhinestoneAccountConfig = {
  account: {
    type: "nexus",
  },
  owners: {
    type: "ecdsa",
    accounts: [signerAccount],
  },
  experimental_sessions: {
    enabled: true,
  },
};

const rhinestone = new RhinestoneSDK();
const account = await rhinestone.createAccount(config);
const { factory, factoryData } = account.getInitData();
const address = account.getAddress();

console.log(`Account address: ${address}`);

// Get all unique chains (source chains + target chain)
const allChains = [...new Set([...sourceChains, targetChain])];
console.log(
  `Preparing session details for chains: ${allChains.map((c) => c.name).join(", ")}`,
);

// Get session details for all chains
const sessionDetails = await getSessionDetails(account, allChains);
console.log(
  `Session details prepared for ${sessionDetails.hashesAndChainIds.length} chain(s)`,
);

const accountInput: AccountInput = {
  address,
  accountParams: {
    factory,
    factoryData,
    sessionDetails,
  },
  target: {
    chain: targetChain.id,
    token: targetToken,
    // Optional: custom recipient address
    // recipient: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
  },
};

const response = await fetch(`${depositProcessorUrl}/register`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": rhinestoneApiKey,
  },
  body: JSON.stringify({ account: accountInput }, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  ),
});
console.log(`Register response: ${response.status}`);
const data = await response.json();
console.log(data);
