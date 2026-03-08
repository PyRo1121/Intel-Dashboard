import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INTERNAL_BACKEND_ORIGIN,
  resolveBackendEndpointUrl,
  usesBackendServiceBinding,
} from "../src/backend-origin.ts";

describe("usesBackendServiceBinding", () => {
  it("detects the configured service binding", () => {
    assert.equal(
      usesBackendServiceBinding({
        INTEL_BACKEND: {
          fetch: async () => new Response(),
          connect: (() => {
            throw new Error("not_used_in_test");
          }) as never,
        },
      }),
      true,
    );
    assert.equal(usesBackendServiceBinding({}), false);
  });
});

describe("resolveBackendEndpointUrl", () => {
  it("prefers the internal service binding origin", () => {
    const url = resolveBackendEndpointUrl(
      {
        INTEL_BACKEND: {
          fetch: async () => new Response(),
          connect: (() => {
            throw new Error("not_used_in_test");
          }) as never,
        },
      },
      "/api/intel-dashboard/user-info",
    );
    assert.equal(url, `${INTERNAL_BACKEND_ORIGIN}/api/intel-dashboard/user-info`);
  });

  it("allows explicit BACKEND_URL fallback only when opted in", () => {
    const url = resolveBackendEndpointUrl(
      {
        ALLOW_BACKEND_URL_FALLBACK: "true",
        BACKEND_URL: "http://127.0.0.1:8787",
      },
      "/api/intel-dashboard/user-info",
    );
    assert.equal(url, "http://127.0.0.1:8787/api/intel-dashboard/user-info");
  });

  it("rejects public fallback origins", () => {
    assert.throws(
      () =>
        resolveBackendEndpointUrl(
          {
            ALLOW_BACKEND_URL_FALLBACK: "true",
            BACKEND_URL: "https://backend-e2e.pyro1121.com",
          },
          "/api/intel-dashboard/user-info",
        ),
      /backend_url_fallback_requires_loopback_origin/,
    );
  });

  it("rejects fallback origins with credentials", () => {
    const url = resolveBackendEndpointUrl(
      {
        ALLOW_BACKEND_URL_FALLBACK: "true",
        BACKEND_URL: "http://user:pass@localhost:8787",
      },
      "/api/intel-dashboard/user-info",
    );
    assert.equal(url, "http://localhost:8787/api/intel-dashboard/user-info");
  });

  it("fails closed when the internal service binding is missing", () => {
    assert.throws(
      () => resolveBackendEndpointUrl({}, "/api/intel-dashboard/user-info"),
      /intel_backend_binding_required/,
    );
  });
});
