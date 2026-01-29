import { base, baseSepolia, optimism } from "viem/chains";

const rhinestoneApiKey = process.env.RHINESTONE_API_KEY;
if (!rhinestoneApiKey) {
  throw new Error("RHINESTONE_API_KEY is not set");
}
const depositProcessorUrl = process.env.DEPOSIT_PROCESSOR_URL;
if (!depositProcessorUrl) {
  throw new Error("DEPOSIT_PROCESSOR_URL is not set");
}
const webhookPublicUrl = process.env.WEBHOOK_PUBLIC_URL;
if (!webhookPublicUrl) {
  throw new Error("WEBHOOK_PUBLIC_URL is not set");
}

const response = await fetch(`${depositProcessorUrl}/setup`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": rhinestoneApiKey,
  },
  body: JSON.stringify({
    params: {
      webhookUrl: `${webhookPublicUrl}/notify`,
      sponsorship: {
        [baseSepolia.id]: {
          gas: "all",
        },
        [base.id]: {
          gas: "all",
        },
        [optimism.id]: {
          gas: "all",
        },
      },
    },
  }),
});
console.log(`Setup response: ${response.status}`);
const data = await response.json();
console.log(data);
