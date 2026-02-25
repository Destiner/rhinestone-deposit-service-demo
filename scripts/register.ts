import {
  type RhinestoneAccountConfig,
  RhinestoneSDK,
  getTokenAddress,
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
  getEnv,
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
    chain: string;
    token: Address | TokenSymbol;
    recipient?: Address;
  };
}

const rhinestoneApiKey = getEnv("RHINESTONE_API_KEY");
const depositProcessorUrl = getEnv("DEPOSIT_PROCESSOR_URL");

// Configure chains
const targetChain = isTestnet ? plasmaTestnet : plasma;
const sourceChains = isTestnet
  ? [baseSepolia, optimismSepolia, arbitrumSepolia]
  : [mainnet, base, optimism, arbitrum, polygon, bsc];

// Token on the target chain
const targetToken = getTokenAddress("USDT0" as TokenSymbol, targetChain.id);

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

const rhinestone = new RhinestoneSDK({
  apiKey: rhinestoneApiKey,
});
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
    chain: `eip155:${targetChain.id}`,
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
