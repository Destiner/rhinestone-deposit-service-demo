import type { RhinestoneAccountConfig } from "@rhinestone/sdk";
import { getAccount, getEnv, signerAccount } from "./common";

const depositProcessorUrl = getEnv("DEPOSIT_PROCESSOR_URL");

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
console.log(`Address: ${address}`);
const response = await fetch(`${depositProcessorUrl}/check/${address}`);
const data = await response.json();
console.log(data);
