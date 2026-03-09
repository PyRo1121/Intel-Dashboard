import test from "node:test";
import assert from "node:assert/strict";
import { formatActivityKindLabel, formatEventLabel, formatTitleLabel } from "./event-label.ts";

test("formatEventLabel normalizes separators and preserves lowercase words", () => {
  assert.equal(formatEventLabel("subscription_set_active"), "subscription set active");
  assert.equal(formatEventLabel("stripe.checkout-completed"), "stripe checkout completed");
  assert.equal(formatEventLabel(undefined), "—");
});

test("formatActivityKindLabel provides a title-cased activity fallback", () => {
  assert.equal(formatActivityKindLabel("trial_started"), "Trial started");
  assert.equal(formatActivityKindLabel(""), "Event");
});

test("formatTitleLabel title-cases normalized labels", () => {
  assert.equal(formatTitleLabel("middle_east"), "Middle East");
  assert.equal(formatTitleLabel("naval-major"), "Naval Major");
  assert.equal(formatTitleLabel(undefined), "—");
});
