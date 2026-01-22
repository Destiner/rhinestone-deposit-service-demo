import { type RhinestoneAccountConfig, RhinestoneSDK } from "@rhinestone/sdk";
import type { Chain } from "viem";
import { polygon, polygonAmoy } from "viem/chains";
import { getSessionDetails, isTestnet, signerAccount } from "./common";

const rhinestoneApiKey = process.env.RHINESTONE_API_KEY;
if (!rhinestoneApiKey) {
  throw new Error("RHINESTONE_API_KEY is not set");
}
const depositProcessorUrl = process.env.DEPOSIT_PROCESSOR_URL;
if (!depositProcessorUrl) {
  throw new Error("DEPOSIT_PROCESSOR_URL is not set");
}

// New chains to add session support for
const newChains: Chain[] = isTestnet
  ? [polygonAmoy] // Example: add Polygon testnet
  : [polygon]; // Example: add Polygon mainnet

// Recreate the account config (must match the registered account)
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
const address = account.getAddress();

console.log(`Account address: ${address}`);
console.log(
  `Adding session support for chains: ${newChains.map((c) => c.name).join(", ")}`,
);

// Get session details for the new chains
const sessionDetails = await getSessionDetails(account, newChains);
console.log(
  `Session details prepared for ${sessionDetails.hashesAndChainIds.length} chain(s)`,
);

const response = await fetch(
  `${depositProcessorUrl}/account/${address}/session`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": rhinestoneApiKey,
    },
    body: JSON.stringify({ sessionDetails }, (_, v) =>
      typeof v === "bigint" ? v.toString() : v,
    ),
  },
);
console.log(`Add session response: ${response.status}`);
const data = await response.json();
console.log(data);
