import { Hono } from "hono";

const port = process.env.WEBHOOK_PORT;
if (!port) {
  throw new Error("WEBHOOK_PORT is not set");
}

const app = new Hono();

app.get("/ok", (c) => {
  return c.text("OK", 200);
});

app.post("/notify", async (c) => {
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

  const body = await c.req.json();

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
