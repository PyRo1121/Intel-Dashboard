import assert from "node:assert/strict";
import test from "node:test";
import { clearCookie, getSetCookieValues, parseCookies } from "../src/cookies.ts";

test("parseCookies extracts cookie pairs from a header string", () => {
  assert.deepEqual(parseCookies("a=1; b=two; c=three"), {
    a: "1",
    b: "two",
    c: "three",
  });
  assert.deepEqual(parseCookies(null), {});
});

test("clearCookie builds secure deletion cookie directives", () => {
  assert.equal(
    clearCookie("session"),
    "session=deleted; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
  );
});

test("getSetCookieValues returns set-cookie values with and without getSetCookie", () => {
  const headers = {
    get(name: string) {
      return name.toLowerCase() === "set-cookie" ? "a=1; Path=/, b=2; Path=/" : null;
    },
  } as Headers;
  assert.deepEqual(getSetCookieValues(headers), ["a=1; Path=/", "b=2; Path=/"]);

  const headersWithMethod = new Headers() as Headers & { getSetCookie: () => string[] };
  headersWithMethod.getSetCookie = () => ["a=1; Path=/", "b=2; Path=/"];
  assert.deepEqual(getSetCookieValues(headersWithMethod), ["a=1; Path=/", "b=2; Path=/"]);
});
