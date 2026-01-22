import type { RhinestoneAccountConfig } from "@rhinestone/sdk";
import { getAccount, rhinestoneAccount, signerAccount } from "./common";

const depositProcessorUrl = process.env.DEPOSIT_PROCESSOR_URL;

const config: RhinestoneAccountConfig = {
  account: {
    type: "nexus",
  },
  owners: {
    type: "ecdsa",
    accounts: [signerAccount, rhinestoneAccount],
  },
};

const account = await getAccount(config);
const address = account.getAddress();
console.log(`Address: ${address}`);
const response = await fetch(`${depositProcessorUrl}/check/${address}`);
const data = await response.json();
console.log(data);
