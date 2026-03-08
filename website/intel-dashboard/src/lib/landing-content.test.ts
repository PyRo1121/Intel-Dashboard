import test from "node:test";
import assert from "node:assert/strict";
import {
  BACKEND_LANDING_HERO,
  BACKEND_OPERATOR_CARDS,
  BACKEND_OPERATOR_PANEL,
  BACKEND_OPERATOR_PRICING,
  LANDING_CAPABILITIES,
  LANDING_CAPABILITIES_SECTION,
  LANDING_FINAL_CTA,
  LANDING_FAQ_ITEMS,
  LANDING_HEADER_LINKS,
  LANDING_HERO_BULLETS,
  LANDING_HERO_CONTENT,
  LANDING_OPS_SNAPSHOT,
  LANDING_PLATFORM_CARDS,
  LANDING_PRICING_COPY,
  LANDING_SUPPORTING_STATS,
  LANDING_SUPPORTING_STATS_COPY,
  LANDING_TESTIMONIALS,
  LANDING_TESTIMONIALS_SECTION,
  LANDING_WORKFLOW_STEPS,
} from "../../shared/landing-content.ts";

test("shared landing content remains populated and internally consistent", () => {
  assert.equal(LANDING_CAPABILITIES.length, 3);
  assert.equal(LANDING_TESTIMONIALS.length, 3);
  assert.equal(LANDING_WORKFLOW_STEPS.length, 4);
  assert.equal(LANDING_PLATFORM_CARDS.length, 4);
  assert.equal(LANDING_FAQ_ITEMS.length, 4);
  assert.equal(LANDING_HERO_BULLETS.length, 3);
  assert.equal(LANDING_OPS_SNAPSHOT.metrics.length, 3);
  assert.equal(LANDING_OPS_SNAPSHOT.logs.length, 3);
  assert.equal(LANDING_SUPPORTING_STATS.length, 3);
  assert.equal(BACKEND_LANDING_HERO.stats.length, 3);
  assert.equal(BACKEND_OPERATOR_PANEL.actions.length, 3);
  assert.equal(BACKEND_OPERATOR_CARDS.length, 4);
  assert.equal(LANDING_HEADER_LINKS.signup, "Start 7-day trial");
  assert.equal(LANDING_HERO_CONTENT.primaryCta, "Start Trial with OAuth");
  assert.equal(LANDING_CAPABILITIES_SECTION.heading, "Built for high-accountability teams");
  assert.equal(LANDING_TESTIMONIALS_SECTION.heading, "Trusted by response-focused operators");
  assert.equal(LANDING_FINAL_CTA.heading, "Upgrade your intelligence response speed this week.");
  assert.equal(BACKEND_OPERATOR_PANEL.heading, "Operator console");
  assert.equal(BACKEND_OPERATOR_PRICING.launchCheckoutLabel, "Launch checkout");
  assert.match(LANDING_PRICING_COPY.summary, /7-day trial/i);
  assert.match(LANDING_PRICING_COPY.summary, /\$8\/mo/i);
  assert.match(LANDING_PRICING_COPY.freeFeatures[0] ?? "", /90-minute/i);
  assert.match(LANDING_PRICING_COPY.premiumPriceLabel, /\$8 \/ month/i);
  assert.match(LANDING_SUPPORTING_STATS_COPY["Response Time"], /triage acceleration/i);
});
