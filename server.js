import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT || 10000);
const network = "eip155:196";
const payTo = process.env.PAY_TO_ADDRESS;
const bridgeUrl = process.env.CODEX_BRIDGE_URL;
const bridgeToken = process.env.CODEX_BRIDGE_TOKEN;

if (!payTo) {
  throw new Error("PAY_TO_ADDRESS is required");
}

const requiredSecrets = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"];
for (const name of requiredSecrets) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
}

if (!bridgeUrl || !bridgeToken) {
  throw new Error("CODEX_BRIDGE_URL and CODEX_BRIDGE_TOKEN are required");
}

const facilitator = new OKXFacilitatorClient({
  apiKey: process.env.OKX_API_KEY,
  secretKey: process.env.OKX_SECRET_KEY,
  passphrase: process.env.OKX_PASSPHRASE,
});

const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register(network, new ExactEvmScheme());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "value-prism-api" });
});

app.use(express.json({ limit: "32kb" }));

app.use(
  paymentMiddleware(
    {
      "POST /v1/decision": {
        accepts: [
          {
            scheme: "exact",
            network,
            payTo,
            price: "$0.01",
          },
        ],
        description: "Value Prism Meme personality decision card",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

app.post("/v1/decision", (req, res) => {
  const { question, context = "", constraints = [] } = req.body || {};

  if (typeof question !== "string" || question.trim().length < 5) {
    return res.status(400).json({
      error: "question must be a string with at least 5 characters",
    });
  }

  fetch(`${bridgeUrl.replace(/\/$/, "")}/analyze`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${bridgeToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ question: question.trim(), context, constraints }),
  })
    .then(async (bridgeResponse) => {
      const payload = await bridgeResponse.json().catch(() => ({}));
      if (!bridgeResponse.ok) {
        return res.status(502).json({
          error: "local Codex bridge unavailable",
          detail: payload.error || `bridge returned ${bridgeResponse.status}`,
        });
      }
      return res.json({
        service: "价值棱镜",
        status: "ok",
        question: question.trim(),
        context,
        constraints,
        answer: payload.answer || "分析服务返回了无法识别的结果。",
        card: payload.card || null,
        disclaimer: "这是决策研究辅助信息，不构成投资建议或收益承诺。",
      });
    })
    .catch(() => res.status(502).json({ error: "local Codex bridge unavailable" }));
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Value Prism API listening on port ${port}`);
});
