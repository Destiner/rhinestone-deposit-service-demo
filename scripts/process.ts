import { randomBytes } from "node:crypto";
import { type RhinestoneAccountConfig, getTokenAddress } from "@rhinestone/sdk";
import type { Hex } from "viem";
import { parseUnits, zeroAddress } from "viem";
import { base, baseSepolia } from "viem/chains";
import { getAccount, getEnv, isTestnet, signerAccount } from "./common";

const depositProcessorUrl = getEnv("DEPOSIT_PROCESSOR_URL");
const rhinestoneApiKey = getEnv("RHINESTONE_API_KEY");

// Get txHash from command line argument or generate a random one
const txHash =
  (process.argv[2] as Hex) || `0x${randomBytes(32).toString("hex")}`;
const sender = (process.argv[3] as Hex) || zeroAddress;

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

const account = await getAccount(config);
const address = account.getAddress();
console.log(`Processing deposit for address: ${address}`);

// Use the same deposit parameters as deposit.ts
const sourceChain = isTestnet ? baseSepolia : base;
const usdcAmount = isTestnet ? parseUnits("0.05", 6) : parseUnits("0.001", 6);

const deposit = {
  chainId: `eip155:${sourceChain.id}`,
  token: getTokenAddress("USDC", sourceChain.id),
  amount: usdcAmount.toString(),
  txHash,
  sender,
};

console.log(`Processing deposit for address: ${address}`);
console.log(`Deposit details: ${JSON.stringify(deposit, null, 2)}`);

const response = await fetch(`${depositProcessorUrl}/process/${address}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": rhinestoneApiKey,
  },
  body: JSON.stringify({ deposit }),
});

console.log(`Process response: ${response.status}`);
const data = await response.json();
console.log(data);
