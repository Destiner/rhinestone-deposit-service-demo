import {
  type RhinestoneAccountConfig,
  type TokenSymbol,
  getTokenAddress,
} from "@rhinestone/sdk";
import {
  http,
  type Address,
  type Chain,
  type Hex,
  createPublicClient,
  erc20Abi,
  parseEther,
  parseUnits,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  optimism,
  optimismSepolia,
  plasma,
  plasmaTestnet,
} from "viem/chains";
import {
  getAccount,
  getEnv,
  getSessionDetails,
  prefund,
  prefundUsdc,
  prefundWeth,
} from "./common";

// --- Config ---

const POLL_INTERVAL = 500;
const BRIDGE_TIMEOUT = 120_000;
const LOG_INTERVAL = 10_000;

const RECIPIENT: Address = "0x08EAfb4AA851AA866a20d3a66b5AB99C418D2181";

const rhinestoneApiKey = getEnv("RHINESTONE_API_KEY");
const depositProcessorUrl = getEnv("DEPOSIT_PROCESSOR_URL");

// --- Colors ---

const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

// --- Types ---

interface TestCase {
  sourceChain: Chain;
  sourceToken: string;
  targetChain: Chain;
  targetToken: string;
}

type TestStatus = "pass" | "fail" | "skip";

interface TestResult {
  network: "testnet" | "mainnet";
  sourceChain: string;
  sourceToken: string;
  targetChain: string;
  targetToken: string;
  status: TestStatus;
  durationMs?: number;
  error?: string;
}

// --- Test definitions ---

const testnetCases: TestCase[] = [
  // // -> Plasma Testnet USDT
  // {
  //   sourceChain: baseSepolia,
  //   sourceToken: "USDC",
  //   targetChain: plasmaTestnet,
  //   targetToken: "USDT0",
  // },
  // {
  //   sourceChain: baseSepolia,
  //   sourceToken: "ETH",
  //   targetChain: plasmaTestnet,
  //   targetToken: "USDT0",
  // },
  // // -> Arbitrum Sepolia
  // {
  //   sourceChain: baseSepolia,
  //   sourceToken: "USDC",
  //   targetChain: arbitrumSepolia,
  //   targetToken: "USDC",
  // },
  // {
  //   sourceChain: baseSepolia,
  //   sourceToken: "USDC",
  //   targetChain: arbitrumSepolia,
  //   targetToken: "ETH",
  // },
  // // -> Optimism Sepolia
  // {
  //   sourceChain: baseSepolia,
  //   sourceToken: "ETH",
  //   targetChain: optimismSepolia,
  //   targetToken: "USDC",
  // },
  // {
  //   sourceChain: baseSepolia,
  //   sourceToken: "ETH",
  //   targetChain: optimismSepolia,
  //   targetToken: "ETH",
  // },
  // Same-chain
  // {
  //   sourceChain: baseSepolia,
  //   sourceToken: "USDC",
  //   targetChain: baseSepolia,
  //   targetToken: "USDC",
  // },
  // {
  //   sourceChain: optimismSepolia,
  //   sourceToken: "ETH",
  //   targetChain: optimismSepolia,
  //   targetToken: "ETH",
  // },
  // {
  //   sourceChain: arbitrumSepolia,
  //   sourceToken: "USDC",
  //   targetChain: arbitrumSepolia,
  //   targetToken: "ETH",
  // },
];

const mainnetCases: TestCase[] = [
  // -> Plasma USDT
  {
    sourceChain: optimism,
    sourceToken: "USDC",
    targetChain: plasma,
    targetToken: "USDT0",
  },
  {
    sourceChain: optimism,
    sourceToken: "ETH",
    targetChain: plasma,
    targetToken: "USDT0",
  },
  {
    sourceChain: base,
    sourceToken: "ETH",
    targetChain: plasma,
    targetToken: "USDT0",
  },
  {
    sourceChain: base,
    sourceToken: "USDC",
    targetChain: plasma,
    targetToken: "USDT0",
  },
  {
    sourceChain: arbitrum,
    sourceToken: "WETH",
    targetChain: plasma,
    targetToken: "USDT0",
  },
  {
    sourceChain: arbitrum,
    sourceToken: "USDC",
    targetChain: plasma,
    targetToken: "USDT0",
  },
  {
    sourceChain: arbitrum,
    sourceToken: "ETH",
    targetChain: plasma,
    targetToken: "USDT0",
  },
  // -> Arbitrum ETH
  {
    sourceChain: base,
    sourceToken: "USDC",
    targetChain: arbitrum,
    targetToken: "ETH",
  },
  // -> Optimism ETH
  {
    sourceChain: base,
    sourceToken: "USDC",
    targetChain: optimism,
    targetToken: "ETH",
  },
];

// --- Helpers ---

interface TargetGroup {
  targetChain: Chain;
  targetToken: string;
  cases: TestCase[];
}

function jsonStringify(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? v.toString() : v,
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatStatus(status: TestStatus): string {
  switch (status) {
    case "pass":
      return `${colors.green}${colors.bold}✓ PASS${colors.reset}`;
    case "fail":
      return `${colors.red}${colors.bold}✗ FAIL${colors.reset}`;
    case "skip":
      return `${colors.yellow}${colors.bold}- SKIP${colors.reset}`;
  }
}

function uniqueChains(chains: Chain[]): Chain[] {
  return chains.filter(
    (chain, index, arr) => arr.findIndex((c) => c.id === chain.id) === index,
  );
}

function groupByTarget(cases: TestCase[]): TargetGroup[] {
  const groups: TargetGroup[] = [];
  for (const tc of cases) {
    let group = groups.find(
      (g) =>
        g.targetChain.id === tc.targetChain.id &&
        g.targetToken === tc.targetToken,
    );
    if (!group) {
      group = {
        targetChain: tc.targetChain,
        targetToken: tc.targetToken,
        cases: [],
      };
      groups.push(group);
    }
    group.cases.push(tc);
  }
  return groups;
}

async function getTargetBalance(
  targetChain: Chain,
  targetToken: string,
  accountAddress: Address,
): Promise<bigint> {
  const client = createPublicClient({
    chain: targetChain,
    transport: http(),
  });
  if (targetToken === "ETH") {
    return client.getBalance({ address: accountAddress });
  }
  const tokenAddress = getTokenAddress(
    targetToken as TokenSymbol,
    targetChain.id,
  );
  return client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [accountAddress],
  });
}

async function waitForBalanceIncrease(
  targetChain: Chain,
  targetToken: string,
  accountAddress: Address,
  initialBalance: bigint,
): Promise<boolean> {
  const startTime = Date.now();
  let lastLogTime = 0;
  while (Date.now() - startTime < BRIDGE_TIMEOUT) {
    const balance = await getTargetBalance(
      targetChain,
      targetToken,
      accountAddress,
    );
    if (balance > initialBalance) {
      console.log(`  Balance increased: ${initialBalance} -> ${balance}`);
      return true;
    }
    const elapsed = Date.now() - startTime;
    if (elapsed - lastLogTime >= LOG_INTERVAL) {
      console.log(`  Waiting for bridge... (${Math.round(elapsed / 1000)}s)`);
      lastLogTime = elapsed;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
  return false;
}

function getRandomFundAmount(chain: Chain, token: string): bigint {
  const variance = 1 + Math.random() / 5; // 1x to 1.2x
  switch (token) {
    case "ETH": {
      const base = chain.testnet ? 0.0001 : 0.00015;
      return parseEther((base * variance).toFixed(8));
    }
    case "USDC": {
      const base = chain.testnet ? 0.2 : 0.2;
      return parseUnits((base * variance).toFixed(6), 6);
    }
    case "WETH": {
      const base = chain.testnet ? 0.0002 : 0.00015;
      return parseEther((base * variance).toFixed(8));
    }
    default:
      throw new Error(`Unknown token: ${token}`);
  }
}

async function fundToken(
  chain: Chain,
  token: string,
  address: Address,
  amount: bigint,
) {
  switch (token) {
    case "ETH":
      return await prefund(chain, address, amount);
    case "USDC":
      return await prefundUsdc(chain, address, amount);
    case "WETH":
      return await prefundWeth(chain, address, amount);
    default:
      throw new Error(`Unknown token: ${token}`);
  }
}

async function registerAccount(
  address: Address,
  factory: Address,
  factoryData: string,
  sessionDetails: { hashesAndChainIds: unknown[]; signature: string },
  targetChain: Chain,
  targetToken: string,
): Promise<void> {
  const targetTokenAddress = getTokenAddress(
    targetToken as TokenSymbol,
    targetChain.id,
  );
  const response = await fetch(`${depositProcessorUrl}/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": rhinestoneApiKey,
    },
    body: jsonStringify({
      account: {
        address,
        accountParams: { factory, factoryData, sessionDetails },
        target: {
          chain: `eip155:${targetChain.id}`,
          token: targetTokenAddress,
        },
      },
    }),
  });
  if (!response.ok) {
    const data = await response.text();
    throw new Error(`Registration failed (${response.status}): ${data}`);
  }
  await response.json();
}

function formatRoute(r: TestResult): string {
  return `${r.sourceChain} ${r.sourceToken} → ${r.targetChain} ${r.targetToken}`;
}

function printTable(title: string, results: TestResult[]): void {
  if (results.length === 0) return;

  const STATUS_VISIBLE = 6;
  const maxRoute = Math.max(5, ...results.map((r) => formatRoute(r).length));
  const maxDuration = 8;
  const maxError = Math.max(
    5,
    ...results.map((r) => Math.min((r.error || "").length, 30)),
  );

  const borderFn = (l: string, m: string, r: string) =>
    `${l}${"─".repeat(maxRoute + 2)}${m}${"─".repeat(STATUS_VISIBLE + 2)}${m}${"─".repeat(maxDuration + 2)}${m}${"─".repeat(maxError + 2)}${r}`;

  console.log(`\n${colors.bold}${colors.cyan} ${title}${colors.reset}`);
  console.log(borderFn("┌", "┬", "┐"));
  console.log(
    `│ ${"Route".padEnd(maxRoute)} │ ${"Status".padEnd(STATUS_VISIBLE)} │ ${"Duration".padEnd(maxDuration)} │ ${"Error".padEnd(maxError)} │`,
  );
  console.log(borderFn("├", "┼", "┤"));
  for (const r of results) {
    const routeStr = formatRoute(r);
    const statusStr = formatStatus(r.status);
    const durationStr =
      r.durationMs != null ? formatDuration(r.durationMs) : "-";
    const errorStr = (r.error || "").slice(0, maxError);
    console.log(
      `│ ${routeStr.padEnd(maxRoute)} │ ${statusStr} │ ${durationStr.padEnd(maxDuration)} │ ${errorStr.padEnd(maxError)} │`,
    );
  }
  console.log(borderFn("└", "┴", "┘"));
}

function printReport(results: TestResult[]): void {
  const testnetResults = results.filter((r) => r.network === "testnet");
  const mainnetResults = results.filter((r) => r.network === "mainnet");

  printTable("Testnet Results", testnetResults);
  printTable("Mainnet Results", mainnetResults);

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  const summaryColor = failed === 0 ? colors.green : colors.red;
  const failedColor = failed > 0 ? colors.red : colors.dim;
  const skippedColor = skipped > 0 ? colors.yellow : colors.dim;

  console.log(
    `\n${colors.bold} Summary: ${colors.reset}${summaryColor}${passed} passed${colors.reset}, ${failedColor}${failed} failed${colors.reset}, ${skippedColor}${skipped} skipped${colors.reset}\n`,
  );
}

async function sweepFunds(
  account: Awaited<ReturnType<typeof getAccount>>,
  targetChain: Chain,
  targetToken: string,
  recipientAddress: Address,
): Promise<void> {
  const targetTokenAddress = getTokenAddress(
    targetToken as TokenSymbol,
    targetChain.id,
  );
  const accountAddress = account.getAddress();
  const balance = await getTargetBalance(
    targetChain,
    targetToken,
    accountAddress,
  );
  if (balance === 0n) {
    console.log("No funds to sweep.");
    return;
  }

  console.log(`Sweeping ${balance} tokens to ${recipientAddress}...`);

  const result = await account.sendTransaction({
    chain: targetChain,
    tokenRequests: [
      {
        address: targetTokenAddress,
      },
    ],
    recipient: recipientAddress,
  });
  console.log(`Sweep intent submitted: ${result.id}`);
}

// --- Main ---

const results: TestResult[] = [];

// Create account with random key
const ownerPrivateKey = generatePrivateKey();
const ownerAccount = privateKeyToAccount(ownerPrivateKey);

const config: RhinestoneAccountConfig = {
  account: { type: "nexus" },
  owners: { type: "ecdsa", accounts: [ownerAccount] },
  experimental_sessions: { enabled: true },
};

const account = await getAccount(config);
const { factory, factoryData } = account.getInitData();
const address = account.getAddress();

console.log(`Account address: ${address}\n`);

// --- Testnet phase ---

console.log("=== TESTNET TESTS ===\n");

const testnetGroups = groupByTarget(testnetCases);
let testnetPassed = true;

for (const group of testnetGroups) {
  const { targetChain, targetToken, cases } = group;

  const sourceChains = uniqueChains(cases.map((c) => c.sourceChain));
  const sessionChains = uniqueChains([...sourceChains, targetChain]);
  const sessionDetails = await getSessionDetails(account, sessionChains);
  await registerAccount(
    address,
    factory,
    factoryData,
    sessionDetails,
    targetChain,
    targetToken,
  );

  console.log(`Target: ${targetChain.name} (${targetToken})\n`);

  let groupFailed = false;

  for (const tc of cases) {
    if (groupFailed) {
      results.push({
        network: "testnet",
        sourceChain: tc.sourceChain.name,
        sourceToken: tc.sourceToken,
        targetChain: tc.targetChain.name,
        targetToken: tc.targetToken,
        status: "skip",
        error: "Previous test failed",
      });
      continue;
    }

    console.log(
      `Testing: ${tc.sourceChain.name} (${tc.sourceToken}) → ${targetChain.name} (${targetToken})`,
    );

    const startTime = Date.now();
    try {
      const initialBalance = await getTargetBalance(
        targetChain,
        targetToken,
        address,
      );
      const amount = getRandomFundAmount(tc.sourceChain, tc.sourceToken);
      await fundToken(tc.sourceChain, tc.sourceToken, address, amount);

      const success = await waitForBalanceIncrease(
        targetChain,
        targetToken,
        address,
        initialBalance,
      );
      const durationMs = Date.now() - startTime;
      if (success) {
        results.push({
          network: "testnet",
          sourceChain: tc.sourceChain.name,
          sourceToken: tc.sourceToken,
          targetChain: tc.targetChain.name,
          targetToken: tc.targetToken,
          status: "pass",
          durationMs,
        });
        console.log(
          `  ${colors.green}${colors.bold}✓ PASS${colors.reset} (${formatDuration(durationMs)})\n`,
        );
      } else {
        results.push({
          network: "testnet",
          sourceChain: tc.sourceChain.name,
          sourceToken: tc.sourceToken,
          targetChain: tc.targetChain.name,
          targetToken: tc.targetToken,
          status: "fail",
          durationMs,
          error: "Timeout",
        });
        console.log(
          `  ${colors.red}${colors.bold}✗ FAIL${colors.reset}: Timeout (${formatDuration(durationMs)})\n`,
        );
        groupFailed = true;
        testnetPassed = false;
      }
    } catch (e) {
      const durationMs = Date.now() - startTime;
      const error = e instanceof Error ? e.message : String(e);
      results.push({
        network: "testnet",
        sourceChain: tc.sourceChain.name,
        sourceToken: tc.sourceToken,
        targetChain: tc.targetChain.name,
        targetToken: tc.targetToken,
        status: "fail",
        durationMs,
        error,
      });
      console.log(
        `  ${colors.red}${colors.bold}✗ FAIL${colors.reset}: ${error} (${formatDuration(durationMs)})\n`,
      );
      groupFailed = true;
      testnetPassed = false;
    }
  }
}

// --- Mainnet phase ---

if (!testnetPassed) {
  console.log("Testnet tests failed. Skipping mainnet tests.\n");
  for (const tc of mainnetCases) {
    results.push({
      network: "mainnet",
      sourceChain: tc.sourceChain.name,
      sourceToken: tc.sourceToken,
      targetChain: tc.targetChain.name,
      targetToken: tc.targetToken,
      status: "skip",
      error: "Testnet failed",
    });
  }
} else if (mainnetCases.length > 0) {
  console.log("=== MAINNET TESTS ===\n");

  const mainnetGroups = groupByTarget(mainnetCases);
  let mainnetAborted = false;

  for (const group of mainnetGroups) {
    if (mainnetAborted) {
      for (const tc of group.cases) {
        results.push({
          network: "mainnet",
          sourceChain: tc.sourceChain.name,
          sourceToken: tc.sourceToken,
          targetChain: tc.targetChain.name,
          targetToken: tc.targetToken,
          status: "skip",
          error: "Previous group failed",
        });
      }
      continue;
    }

    const { targetChain, targetToken, cases } = group;

    const sourceChains = uniqueChains(cases.map((c) => c.sourceChain));
    const sessionChains = uniqueChains([...sourceChains, targetChain]);
    const sessionDetails = await getSessionDetails(account, sessionChains);
    await registerAccount(
      address,
      factory,
      factoryData,
      sessionDetails,
      targetChain,
      targetToken,
    );

    console.log(`Target: ${targetChain.name} (${targetToken})\n`);

    let groupFailed = false;

    for (const tc of cases) {
      if (groupFailed) {
        results.push({
          network: "mainnet",
          sourceChain: tc.sourceChain.name,
          sourceToken: tc.sourceToken,
          targetChain: tc.targetChain.name,
          targetToken: tc.targetToken,
          status: "skip",
          error: "Previous test failed",
        });
        continue;
      }

      console.log(
        `Testing: ${tc.sourceChain.name} (${tc.sourceToken}) → ${targetChain.name} (${targetToken})`,
      );

      const startTime = Date.now();
      try {
        const initialBalance = await getTargetBalance(
          targetChain,
          targetToken,
          address,
        );
        const amount = getRandomFundAmount(tc.sourceChain, tc.sourceToken);
        await fundToken(tc.sourceChain, tc.sourceToken, address, amount);

        const success = await waitForBalanceIncrease(
          targetChain,
          targetToken,
          address,
          initialBalance,
        );
        const durationMs = Date.now() - startTime;
        if (success) {
          results.push({
            network: "mainnet",
            sourceChain: tc.sourceChain.name,
            sourceToken: tc.sourceToken,
            targetChain: tc.targetChain.name,
            targetToken: tc.targetToken,
            status: "pass",
            durationMs,
          });
          console.log(
            `  ${colors.green}${colors.bold}✓ PASS${colors.reset} (${formatDuration(durationMs)})\n`,
          );
        } else {
          results.push({
            network: "mainnet",
            sourceChain: tc.sourceChain.name,
            sourceToken: tc.sourceToken,
            targetChain: tc.targetChain.name,
            targetToken: tc.targetToken,
            status: "fail",
            durationMs,
            error: "Timeout",
          });
          console.log(
            `  ${colors.red}${colors.bold}✗ FAIL${colors.reset}: Timeout (${formatDuration(durationMs)})\n`,
          );
          groupFailed = true;
        }
      } catch (e) {
        const durationMs = Date.now() - startTime;
        const error = e instanceof Error ? e.message : String(e);
        results.push({
          network: "mainnet",
          sourceChain: tc.sourceChain.name,
          sourceToken: tc.sourceToken,
          targetChain: tc.targetChain.name,
          targetToken: tc.targetToken,
          status: "fail",
          durationMs,
          error,
        });
        console.log(
          `  ${colors.red}${colors.bold}✗ FAIL${colors.reset}: ${error} (${formatDuration(durationMs)})\n`,
        );
        groupFailed = true;
      }
    }

    if (groupFailed) {
      mainnetAborted = true;
    }
  }
}

// --- Report ---

printReport(results);

// --- Sweep ---

const allTargetGroups = groupByTarget([...testnetCases, ...mainnetCases]);
for (const group of allTargetGroups) {
  await sweepFunds(account, group.targetChain, group.targetToken, RECIPIENT);
}
