import {
  type RhinestoneAccount,
  type RhinestoneAccountConfig,
  RhinestoneSDK,
  type Session,
  getTokenAddress,
} from "@rhinestone/sdk";
import { toViewOnlyAccount } from "@rhinestone/sdk/utils";
import {
  http,
  type Chain,
  type Hex,
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
} from "viem";
import { type Address, privateKeyToAccount } from "viem/accounts";
import { polygon, sepolia } from "viem/chains";

const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY as Hex;
if (!ownerPrivateKey) {
  throw new Error("OWNER_PRIVATE_KEY is not set");
}
const fundingPrivateKey = process.env.FUNDING_PRIVATE_KEY as Hex;
if (!fundingPrivateKey) {
  throw new Error("FUNDING_PRIVATE_KEY is not set");
}
const rhinestoneSignerAddress = process.env
  .RHINESTONE_SIGNER_ADDRESS as Address;
if (!rhinestoneSignerAddress) {
  throw new Error("RHINESTONE_SIGNER_ADDRESS is not set");
}
const rhinestoneApiKey = process.env.RHINESTONE_API_KEY as string;
if (!rhinestoneApiKey) {
  throw new Error("RHINESTONE_API_KEY is not set");
}

const isTestnet = process.env.USE_TESTNETS === "true";

// User account (root owner)
const signerAccount = privateKeyToAccount(ownerPrivateKey);

// Rhinestone Deposit Service session signer (view-only, we only need the address)
const sessionSignerAccount = toViewOnlyAccount(rhinestoneSignerAddress);

async function getAccount(config: RhinestoneAccountConfig) {
  const rhinestone = new RhinestoneSDK({
    apiKey: rhinestoneApiKey,
  });
  const account = await rhinestone.createAccount(config);
  return account;
}

// Funding
function getTransport(chain: Chain) {
  if (chain.id === sepolia.id) {
    return http("https://ethereum-sepolia-rpc.publicnode.com");
  }
  if (chain.id === polygon.id) {
    return http("https://1rpc.io/matic");
  }
  return http();
}

async function prefund(chain: Chain, address: Address, amount?: bigint) {
  const fundingAccount = privateKeyToAccount(fundingPrivateKey);
  const publicClient = createPublicClient({
    chain,
    transport: getTransport(chain),
  });
  const fundingClient = createWalletClient({
    account: fundingAccount,
    chain,
    transport: getTransport(chain),
  });
  const ethBalance = await publicClient.getBalance({
    address,
  });
  const fundAmount = amount
    ? amount
    : chain.testnet
      ? chain.id === sepolia.id
        ? parseEther("0.005")
        : parseEther("0.001")
      : parseEther("0.00015");
  if (ethBalance < fundAmount / 2n) {
    const txHash = await fundingClient.sendTransaction({
      to: address,
      value: fundAmount,
    });
    await publicClient.waitForTransactionReceipt({ hash: txHash });
  }
  console.log(`Prefunded ${formatEther(fundAmount)} ETH to ${address}`);
}

async function prefundWeth(chain: Chain, address: Address, amount?: bigint) {
  const fundingAccount = privateKeyToAccount(fundingPrivateKey);
  const publicClient = createPublicClient({
    chain,
    transport: getTransport(chain),
  });
  const fundingClient = createWalletClient({
    account: fundingAccount,
    chain,
    transport: getTransport(chain),
  });
  const wethAddress = getTokenAddress("WETH", chain.id);
  const wethBalance = await publicClient.readContract({
    address: wethAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  const fundAmount = amount
    ? amount
    : chain.testnet
      ? parseEther("0.002")
      : parseEther("0.00015");
  // Always fund
  const funderWethBalance = await publicClient.readContract({
    address: wethAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [fundingAccount.address],
  });
  // Wrap WETH if needed
  if (funderWethBalance < fundAmount) {
    const wrapTxHash = await fundingClient.sendTransaction({
      to: wethAddress,
      data: encodeFunctionData({
        abi: [
          {
            inputs: [],
            name: "deposit",
            outputs: [],
            stateMutability: "payable",
            type: "function",
          },
        ],
        functionName: "deposit",
        args: [],
      }),
      value: fundAmount - funderWethBalance,
    });
    await publicClient.waitForTransactionReceipt({ hash: wrapTxHash });
  }
  const txHash = await fundingClient.sendTransaction({
    to: wethAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [address, fundAmount],
    }),
  });
  console.log(`Prefunded ${formatEther(fundAmount)} WETH to ${address}`);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

async function prefundUsdc(chain: Chain, address: Address, amount?: bigint) {
  const fundingAccount = privateKeyToAccount(fundingPrivateKey);
  const publicClient = createPublicClient({
    chain,
    transport: getTransport(chain),
  });
  const fundingClient = createWalletClient({
    account: fundingAccount,
    chain,
    transport: getTransport(chain),
  });
  const usdcAddress = getTokenAddress("USDC", chain.id);
  const fundAmount = amount
    ? amount
    : chain.testnet
      ? parseUnits("0.1", 6)
      : parseUnits("0.05", 6);
  // Always fund
  const txHash = await fundingClient.sendTransaction({
    to: usdcAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [address, fundAmount],
    }),
  });
  console.log(`Prefunded ${formatUnits(fundAmount, 6)} USDC to ${address}`);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

async function prefundUsdt(chain: Chain, address: Address, amount?: bigint) {
  const fundingAccount = privateKeyToAccount(fundingPrivateKey);
  const publicClient = createPublicClient({
    chain,
    transport: getTransport(chain),
  });
  const fundingClient = createWalletClient({
    account: fundingAccount,
    chain,
    transport: getTransport(chain),
  });
  const usdtAddress = getTokenAddress("USDT", chain.id);
  const fundAmount = amount
    ? amount
    : chain.testnet
      ? parseUnits("0.1", 6)
      : parseUnits("0.05", 6);
  // Always fund
  const txHash = await fundingClient.sendTransaction({
    to: usdtAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [address, fundAmount],
    }),
  });
  console.log(`Prefunded ${formatUnits(fundAmount, 6)} USDT to ${address}`);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
}

const fundingAccount = privateKeyToAccount(fundingPrivateKey);
const fundingAddress = fundingAccount.address;

// Session helpers
function buildSession(chain: Chain): Session {
  return {
    owners: {
      type: "ecdsa",
      accounts: [sessionSignerAccount],
    },
    chain,
  };
}

interface EnableSessionDetails {
  hashesAndChainIds: {
    chainId: bigint;
    sessionDigest: Hex;
  }[];
  signature: Hex;
}

async function getSessionDetails(
  rhinestoneAccount: RhinestoneAccount,
  chains: Chain[],
): Promise<EnableSessionDetails> {
  const sessions = chains.map((chain) => buildSession(chain));
  const sessionDetails =
    await rhinestoneAccount.experimental_getSessionDetails(sessions);
  const enableSignature =
    await rhinestoneAccount.experimental_signEnableSession(sessionDetails);
  return {
    hashesAndChainIds: sessionDetails.hashesAndChainIds,
    signature: enableSignature,
  };
}

export {
  buildSession,
  getAccount,
  getSessionDetails,
  isTestnet,
  prefund,
  prefundUsdc,
  prefundUsdt,
  prefundWeth,
  sessionSignerAccount,
  signerAccount,
  fundingAddress,
};
export type { EnableSessionDetails };
