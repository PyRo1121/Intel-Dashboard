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
  const root = mkdtempSync(join(tmpdir(), "repo-hygiene-"));
  const originalCwd = process.cwd();
  try {
    const scriptsDir = join(root, "scripts");
    const relativeSharedImport = "../packages/shared/foo";
    mkdirSync(scriptsDir, { recursive: true });
    writeFileSync(join(scriptsDir, "ok.ts"), 'import x from "@intel-dashboard/shared";\n');
    writeFileSync(join(scriptsDir, "bad.ts"), `import x from "${relativeSharedImport}";\n`);
    process.chdir(root);
    const drift = collectSharedImportDrift(["scripts"]);
    assert.deepEqual(drift, [`scripts/bad.ts:1:import x from "${relativeSharedImport}";`]);
  } finally {
    process.chdir(originalCwd);
    rmSync(root, { recursive: true, force: true });
  }
});
