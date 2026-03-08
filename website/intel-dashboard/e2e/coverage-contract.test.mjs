import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import {
  APP_API_FILE_CLASSIFICATION,
  APP_API_ROUTES,
  APP_ROUTE_FILE_CLASSIFICATION,
  AUTHENTICATED_BROWSER_NOERROR_ROUTES,
  AUTHENTICATED_BROWSER_ROUTES,
  BACKEND_ENDPOINT_CLASSIFICATION,
  BROWSER_METADATA_EXPECTATIONS,
  EDGE_API_ROUTE_CLASSIFICATION,
  PUBLIC_AUTH_BROWSER_ROUTES,
  PUBLIC_BROWSER_ROUTES,
  WORKER_SHADOWED_ROUTE_EXPECTATIONS,
} from "./coverage-manifest.mjs";

test("route coverage manifest classifies every top-level app route file", () => {
  const routeFiles = readdirSync("src/routes", { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const manifestFiles = Object.keys(APP_ROUTE_FILE_CLASSIFICATION).sort();

  assert.deepEqual(manifestFiles, routeFiles, "every top-level route file must be classified in the e2e coverage manifest");
});

test("route coverage manifest classifies every app api route file", () => {
  const apiFiles = readdirSync("src/routes/api", { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  const manifestFiles = Object.keys(APP_API_FILE_CLASSIFICATION).sort();

  assert.deepEqual(manifestFiles, apiFiles, "every app api route file must be classified in the e2e coverage manifest");
  assert.deepEqual(
    Object.values(APP_API_FILE_CLASSIFICATION).sort(),
    [...APP_API_ROUTES].sort(),
    "every app api route path should be represented in the coverage manifest",
  );
});

test("browser route manifests stay aligned with classified production paths", () => {
  const authenticatedPaths = new Set(AUTHENTICATED_BROWSER_ROUTES.map((entry) => entry.path));
  const noErrorPaths = new Set(AUTHENTICATED_BROWSER_NOERROR_ROUTES);
  const publicAuthPaths = new Set(PUBLIC_AUTH_BROWSER_ROUTES.map((entry) => entry.path));
  const publicPaths = new Set(PUBLIC_BROWSER_ROUTES);
  const metadataPaths = new Set(BROWSER_METADATA_EXPECTATIONS.map((entry) => entry.path));

  for (const [file, classification] of Object.entries(APP_ROUTE_FILE_CLASSIFICATION)) {
    if (classification === "browser-authenticated") {
      const expectedPath = `/${file.replace(/\.tsx$/, "")}`;
      assert.ok(authenticatedPaths.has(expectedPath), `${file} should appear in AUTHENTICATED_BROWSER_ROUTES`);
      assert.ok(noErrorPaths.has(expectedPath), `${file} should appear in AUTHENTICATED_BROWSER_NOERROR_ROUTES`);
      assert.ok(metadataPaths.has(expectedPath), `${file} should appear in BROWSER_METADATA_EXPECTATIONS`);
      continue;
    }

    if (classification === "browser-public-auth") {
      const expectedPath = `/${file.replace(/\.tsx$/, "")}`;
      assert.ok(publicAuthPaths.has(expectedPath), `${file} should appear in PUBLIC_AUTH_BROWSER_ROUTES`);
      assert.ok(publicPaths.has(expectedPath), `${file} should appear in PUBLIC_BROWSER_ROUTES`);
      assert.ok(metadataPaths.has(expectedPath), `${file} should appear in BROWSER_METADATA_EXPECTATIONS`);
      continue;
    }

    if (classification === "browser-public-404") {
      assert.ok(publicPaths.has("/this-page-should-not-exist-xyz"), "404 surface should be covered in PUBLIC_BROWSER_ROUTES");
      continue;
    }

    assert.equal(classification, "worker-shadowed-root", `${file} must use a known coverage classification`);
    assert.ok(
      Object.prototype.hasOwnProperty.call(WORKER_SHADOWED_ROUTE_EXPECTATIONS, file),
      `${file} should appear in WORKER_SHADOWED_ROUTE_EXPECTATIONS`,
    );
  }
});

test("edge api coverage manifest stays aligned with worker route declarations", async () => {
  const { readFileSync } = await import("node:fs");
  const workerSource = readFileSync("worker/src/index.ts", "utf8");
  const detected = new Set();

  for (const match of workerSource.matchAll(/path === "([^"]+)"/g)) {
    const path = match[1];
    if (path.startsWith("/api/")) {
      detected.add(path);
    }
  }

  for (const match of workerSource.matchAll(/if \(path\.startsWith\("([^"]+)"\)/g)) {
    const prefix = match[1];
    if (prefix.startsWith("/api/")) {
      detected.add(`${prefix}*`);
    }
  }

  const removedApiSetMatch = workerSource.match(/const REMOVED_API_PATHS = new Set\(\[([^\]]*)\]\);/);
  if (removedApiSetMatch) {
    for (const entry of removedApiSetMatch[1].matchAll(/"([^"]+)"/g)) {
      const path = entry[1];
      if (path.startsWith("/api/")) {
        detected.add(path);
      }
    }
  }

  const manifestPaths = Object.keys(EDGE_API_ROUTE_CLASSIFICATION).sort();
  assert.deepEqual(manifestPaths, [...detected].sort(), "every worker /api route should be classified in EDGE_API_ROUTE_CLASSIFICATION");
});

test("backend endpoint coverage manifest stays aligned with backend path constants", async () => {
  const { readFileSync } = await import("node:fs");
  const backendSource = readFileSync("backend/src/index.ts", "utf8");
  const detected = new Set(["/"]);
  let endpointPath = null;
  let seedSuffix = null;

  for (const match of backendSource.matchAll(/^const (DEFAULT_[A-Z0-9_]+) = "([^"]+)";$/gm)) {
    const name = match[1];
    const value = match[2];
    if (value.startsWith("/api/intel-dashboard/")) {
      detected.add(value);
    }
    if (name === "DEFAULT_ENDPOINT_PATH") {
      endpointPath = value;
    }
    if (name === "DEFAULT_SEED_PATH_SUFFIX") {
      seedSuffix = value;
    }
  }

  if (endpointPath && seedSuffix) {
    detected.add(`${endpointPath}${seedSuffix}`);
  }

  const manifestPaths = Object.keys(BACKEND_ENDPOINT_CLASSIFICATION).sort();
  assert.deepEqual(manifestPaths, [...detected].sort(), "every backend endpoint constant should be classified in BACKEND_ENDPOINT_CLASSIFICATION");
});
