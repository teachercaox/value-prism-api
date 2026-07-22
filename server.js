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
const bridgeHealthTtlMs = Number(process.env.BRIDGE_HEALTH_TTL_MS || 30000);
const bridgeHealthTimeoutMs = Number(process.env.BRIDGE_HEALTH_TIMEOUT_MS || 5000);
let bridgeHealth = {
  checkedAt: 0,
  ok: false,
  detail: "not checked",
};

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

function bridgeBaseUrl() {
  return bridgeUrl.replace(/\/$/, "");
}

async function checkBridgeHealth(force = false) {
  const now = Date.now();
  if (!force && now - bridgeHealth.checkedAt < bridgeHealthTtlMs) {
    return bridgeHealth;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), bridgeHealthTimeoutMs);
  try {
    const response = await fetch(`${bridgeBaseUrl()}/health`, {
      headers: { authorization: `Bearer ${bridgeToken}` },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    bridgeHealth = {
      checkedAt: Date.now(),
      ok: response.ok,
      detail: response.ok ? "ready" : `bridge health returned ${response.status}`,
      payload,
    };
  } catch (error) {
    bridgeHealth = {
      checkedAt: Date.now(),
      ok: false,
      detail: error?.name === "AbortError" ? "bridge health check timed out" : "bridge health check failed",
    };
  } finally {
    clearTimeout(timeout);
  }
  return bridgeHealth;
}

async function requireHealthyBridge(req, res, next) {
  if (req.method !== "POST" || req.path !== "/v1/decision") return next();
  const health = await checkBridgeHealth();
  if (health.ok) return next();
  return res.status(503).json({
    error: "decision service temporarily unavailable",
    detail: "content backend unavailable; no payment challenge was issued",
  });
}

app.get("/health", async (_req, res) => {
  const health = await checkBridgeHealth(true);
  res.status(health.ok ? 200 : 503).json({
    status: health.ok ? "ok" : "degraded",
    service: "value-prism-api",
    contentBackend: health.ok ? "ready" : "unavailable",
    detail: health.detail,
  });
});

app.use(express.json({ limit: "32kb" }));

// Fail closed before x402 issues a payment challenge.
app.use(requireHealthyBridge);

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

  fetch(`${bridgeBaseUrl()}/analyze`, {
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
        bridgeHealth = {
          checkedAt: Date.now(),
          ok: false,
          detail: `bridge returned ${bridgeResponse.status}`,
        };
        return res.status(503).json({
          error: "decision service temporarily unavailable",
          detail: "content backend unavailable",
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
    .catch(() => {
      bridgeHealth = {
        checkedAt: Date.now(),
        ok: false,
        detail: "bridge request failed",
      };
      return res.status(503).json({
        error: "decision service temporarily unavailable",
        detail: "content backend unavailable",
      });
    });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Value Prism API listening on port ${port}`);
});
