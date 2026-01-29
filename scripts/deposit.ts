import type { RhinestoneAccountConfig } from "@rhinestone/sdk";
import { base, baseSepolia } from "viem/chains";
import { isTestnet, getAccount, prefundUsdc, signerAccount } from "./common";
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
const sourceChain = isTestnet ? baseSepolia : base;
const usdcAmount = isTestnet ? parseUnits("0.05", 6) : parseUnits("0.005", 6);
await prefundUsdc(sourceChain, address, usdcAmount);
// await prefundWeth(sourceChain, address, parseEther("0.0000005"));

// TODO check that deposit was successful
