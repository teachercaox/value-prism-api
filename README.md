# Value Prism API

Paid A2MCP prototype for OKX.AI using the OKX x402 Express SDK. Each successful request creates one complete Value Prism Meme personality card package from a single user question; the service does not depend on follow-up questions.

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

## Response

After payment, `POST /v1/decision` returns the short `answer` plus a structured `card`.
The `card.image.frontDataUri` and `card.image.backDataUri` fields currently contain SVG previews for the front and back. They are technical fallbacks, not the final visual acceptance standard. Formal delivery must render paired high-quality PNG cards according to `research/meme-card-output-template.md`; the back contains the matching basis, core thinking, public materials, expression nature, scope, and boundary.
