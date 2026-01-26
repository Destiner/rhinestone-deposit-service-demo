import type { RhinestoneAccountConfig } from "@rhinestone/sdk";
import { base } from "viem/chains";
import { getAccount, prefundUsdc, signerAccount } from "./common";
import { parseUnits } from "viem";

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

// Fund the smart account
// const sourceChain = isTestnet ? baseSepolia : base;
const sourceChain = base;
// await prefundUsdc(sourceChain, address);
await prefundUsdc(sourceChain, address, parseUnits("0.001", 6));
// await prefundWeth(sourceChain, address, parseEther("0.0000005"));

// TODO check that deposit was successful
