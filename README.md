# Deposit Service Demo

> A collection of scripts to demonstrate the deposit service.

## Scripts

1. `setup.ts` — sets the developer to use the service, done once
2. `register.ts` — registers a new account with the service
3. `check.ts` — checks the status of an account
4. `deposit.ts` — make a deposit on the source chain

## Webhooks

Run `webhooks.ts` to start the webhook listener server.

## Utilities

1. `check.ts` — checks the status of an account
2. `recover.ts` — pulls funds back to the source chain

See the webhook spec [here](https://gist.github.com/Destiner/659ff5c0266644e92f93672c3c8e17c4).

Make sure to update the `WEBHOOK_PUBLIC_URL` in `.env` to match your public URL. You might need to use a service like [ngrok](https://ngrok.com/) to expose your local server to the internet.
