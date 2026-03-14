import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  collectWorkflowFiles,
  collectSharedImportDrift,
  collectWorkflowPackageManagerDrift,
} from "./check-repo-hygiene.mjs";

test("collectWorkflowPackageManagerDrift scans every workflow file", () => {
  const root = mkdtempSync(join(tmpdir(), "repo-hygiene-"));
  try {
    const workflowsDir = join(root, ".github", "workflows");
    mkdirSync(workflowsDir, { recursive: true });
    writeFileSync(join(workflowsDir, "ci.yml"), "steps:\n  - run: bun test\n");
    writeFileSync(join(workflowsDir, "e2e.yml"), "steps:\n  - run: npm ci\n");
    const offenders = collectWorkflowPackageManagerDrift(collectWorkflowFiles(workflowsDir), ["npm ci", "npm run"]);
    assert.deepEqual(offenders, [
      {
        workflowFile: join(workflowsDir, "e2e.yml"),
        token: "npm ci",
      },
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("collectSharedImportDrift flags relative imports into packages/shared", () => {
  const originalCwd = process.cwd();
  const originalArgv = process.argv[1];
  try {
    process.chdir("/home/pyro1121/Documents/intel-dashboard-worktrees/quality-sweep-2");
    process.argv[1] = "/home/pyro1121/Documents/intel-dashboard-worktrees/quality-sweep-2/scripts/check-repo-hygiene.test.ts";
    const drift = collectSharedImportDrift(["scripts"]);
    assert.deepEqual(drift, []);
  } finally {
    process.chdir(originalCwd);
    process.argv[1] = originalArgv;
  }
});
