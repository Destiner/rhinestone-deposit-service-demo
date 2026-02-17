import { base, baseSepolia, optimism } from "viem/chains";
import { getEnv } from "./common";

const rhinestoneApiKey = getEnv("RHINESTONE_API_KEY");
const depositProcessorUrl = getEnv("DEPOSIT_PROCESSOR_URL");
const webhookPublicUrl = getEnv("WEBHOOK_PUBLIC_URL");
const webhookSecret = process.env.WEBHOOK_SECRET;

const response = await fetch(`${depositProcessorUrl}/setup`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": rhinestoneApiKey,
  },
  body: JSON.stringify({
    params: {
      webhookUrl: `${webhookPublicUrl}/notify`,
      webhookSecret,
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
