import test from "node:test";
import assert from "node:assert/strict";
import {
  AIR_SEA_DESCRIPTION,
  AIR_SEA_TITLE,
  APP_LANDING_DESCRIPTION,
  APP_LANDING_TITLE,
  BILLING_DESCRIPTION,
  BILLING_TITLE,
  BRIEFINGS_DESCRIPTION,
  BRIEFINGS_TITLE,
  CRM_DESCRIPTION,
  CRM_TITLE,
  LOGIN_DESCRIPTION,
  LOGIN_TITLE,
  MAP_DESCRIPTION,
  MAP_TITLE,
  NOT_FOUND_DESCRIPTION,
  NOT_FOUND_TITLE,
  OSINT_DESCRIPTION,
  OSINT_TITLE,
  OVERVIEW_DESCRIPTION,
  PRODUCTION_HOME_DESCRIPTION,
  OVERVIEW_TITLE,
  PRODUCTION_HOME_TITLE,
  SIGNUP_DESCRIPTION,
  SIGNUP_TITLE,
  TELEGRAM_DESCRIPTION,
  TELEGRAM_TITLE,
  resolveDashboardShellTitle,
} from "../../shared/route-meta.ts";

test("shared route titles stay aligned with dashboard shell resolution", () => {
  assert.equal(PRODUCTION_HOME_TITLE, "SentinelStream OSINT Dashboard | Real-Time Geopolitical Intelligence Platform");
  assert.equal(APP_LANDING_TITLE, "SentinelStream | OSINT Intelligence Platform");
  assert.match(PRODUCTION_HOME_DESCRIPTION, /real-time osint dashboard/i);
  assert.match(APP_LANDING_DESCRIPTION, /real-time osint intelligence/i);
  assert.equal(LOGIN_TITLE, "SentinelStream | Login");
  assert.equal(SIGNUP_TITLE, "SentinelStream | Create Account");
  assert.equal(NOT_FOUND_TITLE, "Page Not Found | SentinelStream");
  assert.match(LOGIN_DESCRIPTION, /secure OAuth/i);
  assert.match(SIGNUP_DESCRIPTION, /OAuth authentication/i);
  assert.match(OVERVIEW_DESCRIPTION, /premium instant delivery/i);
  assert.match(OSINT_DESCRIPTION, /Aggregated OSINT feed/i);
  assert.match(TELEGRAM_DESCRIPTION, /250\+ global Telegram/i);
  assert.match(BRIEFINGS_DESCRIPTION, /every 4 hours/i);
  assert.match(MAP_DESCRIPTION, /live conflict monitoring by region/i);
  assert.match(AIR_SEA_DESCRIPTION, /military aircraft tracking/i);
  assert.match(BILLING_DESCRIPTION, /subscription/i);
  assert.match(CRM_DESCRIPTION, /data quality operations/i);
  assert.match(NOT_FOUND_DESCRIPTION, /continue exploring SentinelStream/i);
  assert.equal(resolveDashboardShellTitle("/overview"), OVERVIEW_TITLE);
  assert.equal(resolveDashboardShellTitle("/osint"), OSINT_TITLE);
  assert.equal(resolveDashboardShellTitle("/telegram/focus"), TELEGRAM_TITLE);
  assert.equal(resolveDashboardShellTitle("/briefings"), BRIEFINGS_TITLE);
  assert.equal(resolveDashboardShellTitle("/map"), MAP_TITLE);
  assert.equal(resolveDashboardShellTitle("/air-sea"), AIR_SEA_TITLE);
  assert.equal(resolveDashboardShellTitle("/billing"), BILLING_TITLE);
  assert.equal(resolveDashboardShellTitle("/crm"), CRM_TITLE);
  assert.equal(resolveDashboardShellTitle("/unknown"), "SentinelStream");
});
