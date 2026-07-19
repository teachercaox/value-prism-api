# Value Prism API

Paid A2MCP prototype for OKX.AI using the OKX x402 Express SDK.

## Local test

Set these environment variables before starting:

- `PAY_TO_ADDRESS`: X Layer wallet address that receives payment
- `OKX_API_KEY`: OKX developer API key
- `OKX_SECRET_KEY`: OKX developer API secret
- `OKX_PASSPHRASE`: OKX developer API passphrase

Run:

```bash
npm install
npm start
```

Health check:

```bash
curl http://localhost:10000/health
```

Paid endpoint without payment should return `402`:

```bash
curl -i -X POST http://localhost:10000/v1/decision \
  -H 'content-type: application/json' \
  -d '{"question":"是否应该进入一个新市场？"}'
```
