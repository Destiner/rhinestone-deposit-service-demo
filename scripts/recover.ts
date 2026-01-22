import { RhinestoneSDK, type RhinestoneAccountConfig } from "@rhinestone/sdk";
import { isOrchestratorError } from "@rhinestone/sdk/errors";
import { base } from "viem/chains";
import { signerAccount, fundingAddress } from "./common";
import { encodeFunctionData, erc20Abi } from "viem";
import type { OrchestratorError } from "@rhinestone/sdk/dist/src/orchestrator";

const rhinestoneApiKey = process.env.RHINESTONE_API_KEY;
if (!rhinestoneApiKey) {
  throw new Error("RHINESTONE_API_KEY is not set");
}

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

const chain = base;
const token = "USDC";
const receiver = fundingAddress;

try {
  console.log(account.getAddress());
  const maxAmount = await account.getMaxSpendableAmount(chain, token, 50_000n);
  console.log(maxAmount);
  // const maxAmount = 1_000_000n;
  const transactionData = await account.sendTransaction({
    targetChain: chain,
    calls: [
      {
        to: token,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [receiver, maxAmount],
        }),
      },
    ],
    tokenRequests: [
      {
        address: token,
        amount: maxAmount,
      },
    ],
    signers: {
      type: "owner",
      kind: "ecdsa",
      accounts: [signerAccount],
    },
  });
  const transactionStatus = await account.waitForExecution(transactionData);
  console.log(transactionStatus);
} catch (error) {
  if (isOrchestratorError(error as Error)) {
    const e = error as OrchestratorError;
    console.log(e.name);
    console.log(e.message);
    console.dir(e.context, { depth: null });
  }
}
