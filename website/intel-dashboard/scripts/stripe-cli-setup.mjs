#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { SITE_ORIGIN, siteUrl } from "../shared/site-config.ts";

function parseArgs(argv) {
  const out = {
    apply: false,
    monthlyUsd: 8,
    appOrigin: SITE_ORIGIN,
    workerConfig: "worker/wrangler.toml",
    backendConfig: "backend/wrangler.jsonc",
    workerEnv: "",
    backendEnv: "",
    productName: "SentinelStream Pro",
    webhookUrl: siteUrl("/api/webhooks/stripe"),
    createWebhook: false,
    startListener: false,
    priceId: "",
    usageToken: "",
    stripeSecretKey: "",
    webhookSecret: "",
    crmStripeLiveEnabled: "true",
    crmStripeSyncTimeoutMs: "8000",
    crmStripeMaxSubscriptions: "5000",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--apply") out.apply = true;
    else if (arg === "--create-webhook") out.createWebhook = true;
    else if (arg === "--listen") out.startListener = true;
    else if (arg === "--monthly-usd" && next) {
      out.monthlyUsd = Number(next);
      i += 1;
    } else if (arg === "--app-origin" && next) {
      out.appOrigin = next;
      i += 1;
    } else if (arg === "--worker-config" && next) {
      out.workerConfig = next;
      i += 1;
    } else if (arg === "--backend-config" && next) {
      out.backendConfig = next;
      i += 1;
    } else if (arg === "--worker-env" && next) {
      out.workerEnv = next;
      i += 1;
    } else if (arg === "--backend-env" && next) {
      out.backendEnv = next;
      i += 1;
    } else if (arg === "--product-name" && next) {
      out.productName = next;
      i += 1;
    } else if (arg === "--webhook-url" && next) {
      out.webhookUrl = next;
      i += 1;
    } else if (arg === "--price-id" && next) {
      out.priceId = next;
      i += 1;
    } else if (arg === "--usage-token" && next) {
      out.usageToken = next;
      i += 1;
    } else if (arg === "--stripe-secret-key" && next) {
      out.stripeSecretKey = next;
      i += 1;
    } else if (arg === "--webhook-secret" && next) {
      out.webhookSecret = next;
      i += 1;
    } else if (arg === "--crm-stripe-live-enabled" && next) {
      out.crmStripeLiveEnabled = next;
      i += 1;
    } else if (arg === "--crm-stripe-sync-timeout-ms" && next) {
      out.crmStripeSyncTimeoutMs = next;
      i += 1;
    } else if (arg === "--crm-stripe-max-subscriptions" && next) {
      out.crmStripeMaxSubscriptions = next;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
  }

  return out;
}

function printHelp() {
  console.log(`
Stripe CLI subscription bootstrap for intel-dashboard.

Usage:
  node scripts/stripe-cli-setup.mjs [options]

Options:
  --apply                     Execute writes (Stripe create + Wrangler secret put)
  --monthly-usd <amount>      Monthly subscription amount in USD (default: 8)
  --app-origin <url>          App origin for success/cancel redirects
  --price-id <price_id>       Reuse an existing Stripe price id
  --product-name <name>       Product name when creating a new price
  --create-webhook            Create Stripe webhook endpoint and capture secret
  --webhook-url <url>         Webhook URL (default: edge /api/webhooks/stripe)
  --listen                    Start stripe listen forwarding after setup
  --usage-token <token>       Shared backend/worker API bearer token
  --stripe-secret-key <key>   Stripe secret key to write to backend secret store
  --webhook-secret <secret>   Stripe webhook secret to write to backend secret store
  --crm-stripe-live-enabled <bool> Enable live Stripe CRM metrics (default: true)
  --crm-stripe-sync-timeout-ms <ms> Stripe CRM sync timeout in ms (default: 8000)
  --crm-stripe-max-subscriptions <n> Max subscriptions scanned per CRM sync (default: 5000)
  --backend-config <path>     Wrangler backend config path
  --worker-config <path>      Wrangler worker config path
  --backend-env <name>        Wrangler env for backend secret writes (default: root env)
  --worker-env <name>         Wrangler env for worker secret writes (default: root env)

Examples:
  node scripts/stripe-cli-setup.mjs --apply --create-webhook --usage-token "$(openssl rand -hex 32)"
  node scripts/stripe-cli-setup.mjs --apply --price-id price_123 --webhook-secret whsec_123
`);
}

function run(command, args, opts = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: opts.stdio || ["pipe", "pipe", "pipe"],
    input: opts.input || undefined,
  });
  if (result.status !== 0) {
    const out = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`${command} ${args.join(" ")} failed.\n${out}`);
  }
  return result.stdout.trim();
}

function runJson(command, args) {
  const raw = run(command, args);
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Unable to parse JSON from: ${command} ${args.join(" ")}`);
  }
}

function putWranglerSecret(configPath, envName, key, value, apply) {
  if (!value || !value.trim()) {
    return;
  }
  const envArg = envName === "" ? '--env=""' : `--env=${envName}`;
  if (!apply) {
    console.log(`[dry-run] wrangler secret put ${key} --config ${configPath} ${envArg}`);
    return;
  }
  run("wrangler", ["secret", "put", key, "--config", configPath, "--env", envName], {
    stdio: ["pipe", "inherit", "inherit"],
    input: `${value}\n`,
  });
}

function ensureCommand(name, versionArg = "--version") {
  run(name, [versionArg]);
}

function ensureStripeAuth() {
  run("stripe", ["products", "list", "--limit", "1"]);
}

function createStripePrice({ monthlyUsd, productName }) {
  const unitAmount = Math.max(1, Math.floor(monthlyUsd * 100));
  const product = runJson("stripe", [
    "products",
    "create",
    "--name",
    productName,
    "--description",
    "SentinelStream premium monthly subscription",
  ]);
  const productId = String(product?.id || "").trim();
  if (!productId) {
    throw new Error("Stripe product creation did not return id.");
  }

  const price = runJson("stripe", [
    "prices",
    "create",
    "--currency",
    "usd",
    "--unit-amount",
    String(unitAmount),
    "--recurring",
    "interval=month",
    "--product",
    productId,
    "--nickname",
    "SentinelStream Monthly",
  ]);
  const priceId = String(price?.id || "").trim();
  if (!priceId) {
    throw new Error("Stripe price creation did not return id.");
  }

  return { productId, priceId };
}

function createStripeWebhook({ webhookUrl }) {
  const endpoint = runJson("stripe", [
    "webhook_endpoints",
    "create",
    "--url",
    webhookUrl,
    "--description",
    "SentinelStream billing webhook",
    "--enabled-events",
    "checkout.session.completed",
    "--enabled-events",
    "customer.subscription.updated",
    "--enabled-events",
    "customer.subscription.deleted",
  ]);

  return {
    endpointId: String(endpoint?.id || "").trim(),
    webhookSecret: String(endpoint?.secret || "").trim(),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(args.monthlyUsd) || args.monthlyUsd <= 0) {
    throw new Error("--monthly-usd must be a positive number.");
  }

  ensureCommand("stripe");
  ensureCommand("wrangler");
  ensureStripeAuth();

  let priceId = args.priceId.trim();
  if (!priceId) {
    if (!args.apply) {
      console.log("[dry-run] stripe products create ...");
      console.log("[dry-run] stripe prices create ...");
      priceId = "price_dry_run";
    } else {
      const created = createStripePrice({
        monthlyUsd: args.monthlyUsd,
        productName: args.productName,
      });
      priceId = created.priceId;
      console.log(`Created Stripe product ${created.productId}`);
      console.log(`Created Stripe price ${created.priceId}`);
    }
  } else {
    console.log(`Using existing Stripe price ${priceId}`);
  }

  let webhookSecret = args.webhookSecret.trim();
  if (args.createWebhook) {
    if (!args.apply) {
      console.log(`[dry-run] stripe webhook_endpoints create --url ${args.webhookUrl} ...`);
    } else {
      const created = createStripeWebhook({ webhookUrl: args.webhookUrl });
      console.log(`Created Stripe webhook endpoint ${created.endpointId}`);
      if (created.webhookSecret) {
        webhookSecret = created.webhookSecret;
      } else {
        console.warn("Stripe API did not return webhook secret. Configure STRIPE_WEBHOOK_SECRET manually.");
      }
    }
  }

  const successUrl = `${args.appOrigin.replace(/\/+$/, "")}/billing?checkout=success`;
  const cancelUrl = `${args.appOrigin.replace(/\/+$/, "")}/billing?checkout=cancel`;
  const portalReturnUrl = `${args.appOrigin.replace(/\/+$/, "")}/billing`;

  putWranglerSecret(args.backendConfig, args.backendEnv, "STRIPE_PRICE_ID", priceId, args.apply);
  putWranglerSecret(args.backendConfig, args.backendEnv, "STRIPE_SUCCESS_URL", successUrl, args.apply);
  putWranglerSecret(args.backendConfig, args.backendEnv, "STRIPE_CANCEL_URL", cancelUrl, args.apply);
  putWranglerSecret(args.backendConfig, args.backendEnv, "STRIPE_PORTAL_RETURN_URL", portalReturnUrl, args.apply);
  putWranglerSecret(args.backendConfig, args.backendEnv, "STRIPE_SECRET_KEY", args.stripeSecretKey.trim(), args.apply);
  putWranglerSecret(args.backendConfig, args.backendEnv, "STRIPE_WEBHOOK_SECRET", webhookSecret, args.apply);
  putWranglerSecret(args.backendConfig, args.backendEnv, "CRM_STRIPE_LIVE_ENABLED", args.crmStripeLiveEnabled.trim(), args.apply);
  putWranglerSecret(args.backendConfig, args.backendEnv, "CRM_STRIPE_SYNC_TIMEOUT_MS", args.crmStripeSyncTimeoutMs.trim(), args.apply);
  putWranglerSecret(
    args.backendConfig,
    args.backendEnv,
    "CRM_STRIPE_MAX_SUBSCRIPTIONS",
    args.crmStripeMaxSubscriptions.trim(),
    args.apply,
  );

  const sharedUsageToken = args.usageToken.trim();
  putWranglerSecret(args.backendConfig, args.backendEnv, "USAGE_DATA_SOURCE_TOKEN", sharedUsageToken, args.apply);
  putWranglerSecret(args.workerConfig, args.workerEnv, "USAGE_DATA_SOURCE_TOKEN", sharedUsageToken, args.apply);

  console.log("\nStripe billing bootstrap summary:");
  console.log(`- price_id: ${priceId}`);
  console.log(`- success_url: ${successUrl}`);
  console.log(`- cancel_url: ${cancelUrl}`);
  console.log(`- portal_return_url: ${portalReturnUrl}`);
  if (webhookSecret) {
    console.log("- webhook_secret: configured");
  } else {
    console.log("- webhook_secret: not configured (pass --webhook-secret or --create-webhook)");
  }
  if (sharedUsageToken) {
    console.log("- worker/backend usage token: configured");
  } else {
    console.log("- worker/backend usage token: unchanged (pass --usage-token)");
  }
  console.log(`- crm_stripe_live_enabled: ${args.crmStripeLiveEnabled}`);
  console.log(`- crm_stripe_sync_timeout_ms: ${args.crmStripeSyncTimeoutMs}`);
  console.log(`- crm_stripe_max_subscriptions: ${args.crmStripeMaxSubscriptions}`);

  if (args.startListener) {
    const listenArgs = [
      "listen",
      "--forward-to",
      args.webhookUrl,
      "--events",
      "checkout.session.completed,customer.subscription.updated,customer.subscription.deleted",
    ];
    if (!args.apply) {
      console.log(`[dry-run] stripe ${listenArgs.join(" ")}`);
      return;
    }
    console.log(`\nStarting: stripe ${listenArgs.join(" ")}`);
    spawnSync("stripe", listenArgs, { stdio: "inherit" });
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
