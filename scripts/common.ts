import {
  type RhinestoneAccount,
  type RhinestoneAccountConfig,
  RhinestoneSDK,
  type Session,
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
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  bsc,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  sepolia,
} from "viem/chains";

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

function getUsdcAddress(chain: Chain): Address {
  switch (chain.id) {
    case sepolia.id:
      return "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
    case baseSepolia.id:
      return "0x036cbd53842c5426634e7929541ec2318f3dcf7e";
    case arbitrumSepolia.id:
      return "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
    case optimismSepolia.id:
      return "0x5fd84259d66Cd46123540766Be93DFE6D43130D7";
    case base.id:
      return "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    case arbitrum.id:
      return "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
    case optimism.id:
      return "0x0b2c639c533813f4aa9d7837caf62653d097ff85";
    case polygon.id:
      return "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";
    case mainnet.id:
      return "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
    case bsc.id:
      return "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d";
    default:
      throw new Error("Unsupported chain");
  }
}

function getUsdtAddress(chain: Chain): Address {
  switch (chain.id) {
    case mainnet.id:
      return "0xdac17f958d2ee523a2206206994597c13d831ec7";
    case polygon.id:
      return "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
    case arbitrum.id:
      return "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9";
    case bsc.id:
      return "0x55d398326f99059fF775485246999027B3197955";
    default:
      throw new Error("Unsupported chain");
  }
}

function getWethAddress(chain: Chain) {
  switch (chain.id) {
    case sepolia.id:
      return "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    case baseSepolia.id:
      return "0x4200000000000000000000000000000000000006";
    case arbitrumSepolia.id:
      return "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";
    case optimismSepolia.id:
      return "0x4200000000000000000000000000000000000006";
    case base.id:
      return "0x4200000000000000000000000000000000000006";
    case arbitrum.id:
      return "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    case optimism.id:
      return "0x4200000000000000000000000000000000000006";
    default:
      throw new Error("Unsupported chain");
  }
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
  const wethAddress = getWethAddress(chain);
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
  const usdcAddress = getUsdcAddress(chain);
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
  const usdtAddress = getUsdtAddress(chain);
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
