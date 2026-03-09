import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCrmAccountStatusMap,
  filterCrmDirectoryUsers,
  formatCrmAccountStatus,
  findCrmDirectoryUserById,
  formatCrmProviders,
  getCrmUserDisplayName,
  getCrmUserSecondaryLabel,
} from "./crm-directory.ts";

test("buildCrmAccountStatusMap keys billing state by user id and skips invalid ids", () => {
  const map = buildCrmAccountStatusMap([
    { userId: "user-1", status: "active", monthlyPriceUsd: 49 },
    { userId: "   ", status: "trialing", monthlyPriceUsd: 0 },
    { userId: "user-2", status: "canceled" },
  ]);

  assert.deepEqual(map.get("user-1"), { status: "active", monthlyPriceUsd: 49 });
  assert.deepEqual(map.get("user-2"), { status: "canceled", monthlyPriceUsd: undefined });
  assert.equal(map.has(""), false);
});

test("findCrmDirectoryUserById returns matching users and null-safe fallback", () => {
  const users = [
    { id: "user-1", name: "Analyst", login: "analyst", email: "a@example.com" },
    { id: "user-2", name: "Operator", login: "operator", email: "o@example.com" },
  ];

  assert.deepEqual(findCrmDirectoryUserById(users, "user-2"), { id: "user-2", name: "Operator", login: "operator", email: "o@example.com" });
  assert.equal(findCrmDirectoryUserById(users, "missing"), null);
  assert.equal(findCrmDirectoryUserById(undefined, "user-1"), null);
  assert.equal(findCrmDirectoryUserById(users, ""), null);
});

test("filterCrmDirectoryUsers applies status and query filters against account status and user fields", () => {
  const users = [
    { id: "user-1", name: "Analyst One", login: "analyst", email: "a@example.com", providers: ["github"] },
    { id: "user-2", name: "Operator Two", login: "ops", email: "o@example.com", providers: ["x"] },
  ];
  const accounts = new Map([
    ["user-1", { status: "active" }],
    ["user-2", { status: "trialing" }],
  ]);

  assert.deepEqual(
    filterCrmDirectoryUsers(users, { query: "", status: "active", accounts }).map((entry) => entry.id),
    ["user-1"],
  );
  assert.deepEqual(
    filterCrmDirectoryUsers(users, { query: "github", status: "all", accounts }).map((entry) => entry.id),
    ["user-1"],
  );
  assert.deepEqual(
    filterCrmDirectoryUsers(users, { query: "ops", status: "all", accounts }).map((entry) => entry.id),
    ["user-2"],
  );
  assert.deepEqual(
    filterCrmDirectoryUsers(users, { query: "missing", status: "all", accounts }),
    [],
  );
});

test("formatCrmProviders joins values and applies the configured empty fallback", () => {
  assert.equal(formatCrmProviders(["github", "x"]), "github, x");
  assert.equal(formatCrmProviders([" github", "x "]), "github, x");
  assert.equal(formatCrmProviders(["github", "x"], "|", ""), "github|x");
  assert.equal(formatCrmProviders([" ", ""], ", ", "none"), "none");
  assert.equal(formatCrmProviders(undefined), "—");
  assert.equal(formatCrmAccountStatus("active"), "Active");
  assert.equal(formatCrmAccountStatus(undefined), "None");
});

test("CRM user display helpers prefer name/login/email fallbacks in a stable order", () => {
  assert.equal(getCrmUserDisplayName({ name: "Analyst", login: "analyst", email: "a@example.com" }), "Analyst");
  assert.equal(getCrmUserDisplayName({ name: "", login: "analyst", email: "a@example.com" }), "analyst");
  assert.equal(getCrmUserDisplayName({ name: "", login: "", email: "a@example.com" }), "a@example.com");
  assert.equal(getCrmUserDisplayName(undefined), "Unknown user");

  assert.equal(getCrmUserSecondaryLabel({ login: "analyst", email: "a@example.com" }), "analyst");
  assert.equal(getCrmUserSecondaryLabel({ login: "", email: "a@example.com" }), "a@example.com");
  assert.equal(getCrmUserSecondaryLabel(undefined), "—");
});
