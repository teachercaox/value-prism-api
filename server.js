import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@okxweb3/x402-express";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";
import { OKXFacilitatorClient } from "@okxweb3/x402-core";

const app = express();
const port = Number(process.env.PORT || 10000);
const network = "eip155:196";
const payTo = process.env.PAY_TO_ADDRESS;

if (!payTo) {
  throw new Error("PAY_TO_ADDRESS is required");
}

const requiredSecrets = ["OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE"];
for (const name of requiredSecrets) {
  if (!process.env[name]) {
    throw new Error(`${name} is required`);
  }
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
        accepts: {
          scheme: "exact",
          network,
          payTo,
          price: "$0.01",
        },
        description: "Value Prism investment and business decision analysis",
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

  return res.json({
    service: "价值棱镜",
    status: "prototype",
    question: question.trim(),
    context,
    constraints,
    analysis: {
      summary: "已收到决策问题。下一步将接入实时资料和思维框架分析。",
      perspectives: [],
      risks: ["当前原型尚未连接实时数据或模型服务"],
      next_step: "补充目标、时间范围、预算和风险承受能力",
    },
    disclaimer: "这是决策研究辅助信息，不构成投资建议或收益承诺。",
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Value Prism API listening on port ${port}`);
});
