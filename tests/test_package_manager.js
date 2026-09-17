const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const guard = resolve(__dirname, "../scripts/require-pnpm.cjs");
const run = (path, agent, args = []) => spawnSync(process.execPath, [path, ...args], {
  env: {...process.env, npm_config_user_agent: agent}, encoding: "utf8",
});
test("package manager guard accepts pnpm and rejects other launchers without downloads", () => {
  assert.equal(run(guard, "pnpm/10.34.5 npm/? node/v22.0.0").status, 0);
  for (const agent of ["", "npm/10.0.0", "yarn/1.22.0", "bun/1.2.0", "not-pnpm/10.0.0"]) {
    const result = run(guard, agent);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires pnpm/);
  }
});
test("lockfile check rejects every competing lockfile, including modern Bun", () => {
  const root = mkdtempSync(join(tmpdir(), "pnpm-guard-"));
  try {
    mkdirSync(join(root, "scripts"));
    const copy = join(root, "scripts/require-pnpm.cjs");
    copyFileSync(guard, copy);
    assert.equal(run(copy, "", ["--lockfiles-only"]).status, 0);
    for (const name of ["package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock", "bun.lockb"]) {
      writeFileSync(join(root, name), "");
      const result = run(copy, "", ["--lockfiles-only"]);
      assert.equal(result.status, 1);
      assert.ok(result.stderr.includes(name));
      rmSync(join(root, name));
    }
  } finally { rmSync(root, {recursive:true, force:true}); }
});
