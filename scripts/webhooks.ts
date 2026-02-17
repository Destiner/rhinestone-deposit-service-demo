import { createHmac } from "node:crypto";
import { Hono } from "hono";
import { getEnv } from "./common";

const port = getEnv("WEBHOOK_PORT");
const webhookSecret = process.env.WEBHOOK_SECRET;

const app = new Hono();

app.get("/ok", (c) => {
  return c.text("OK", 200);
});

app.post("/notify", async (c) => {
  const rawBody = await c.req.text();

  if (webhookSecret) {
    const signature = c.req.header("X-Webhook-Signature");
    if (!signature) {
      return c.json({ error: "Missing signature" }, 401);
    }

    const expectedSignature = `sha256=${createHmac("sha256", webhookSecret).update(rawBody).digest("hex")}`;
    if (signature !== expectedSignature) {
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  const timestamp = new Date().toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const body = JSON.parse(rawBody);

  console.log("\n========================================");
  console.log("Webhook received");
  console.log(`Timestamp: ${timestamp}`);
  console.log("----------------------------------------");
  console.log("Payload:");
  console.log(JSON.stringify(body, null, 2));
  console.log("========================================\n");

  return c.json({ timestamp }, 200);
});

console.log(`Webhook server running on http://localhost:${port}`);
console.log(`  - Health check: GET  http://localhost:${port}/ok`);
console.log(`  - Webhook:      POST http://localhost:${port}/notify`);

export default {
  port: port,
  fetch: app.fetch,
  hostname: "0.0.0.0",
};
