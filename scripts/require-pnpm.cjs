// Dependency-free: this must work before packages are installed.
const { existsSync } = require("node:fs");
const { resolve } = require("node:path");
const root = resolve(__dirname, "..");
const foreignLocks = [
  "package-lock.json", "npm-shrinkwrap.json", "yarn.lock", "bun.lock", "bun.lockb",
].filter((name) => existsSync(resolve(root, name)));
if (foreignLocks.length) {
  console.error(`This project is pnpm-only. Remove competing lockfiles: ${foreignLocks.join(", ")}. Keep pnpm-lock.yaml.`);
  process.exit(1);
}
if (process.argv.includes("--lockfiles-only")) process.exit(0);
if (!/^pnpm\/\d+\./.test(process.env.npm_config_user_agent || "")) {
  console.error("This project requires pnpm. Use pnpm install --frozen-lockfile and pnpm <script>. The version is pinned in package.json.");
  process.exit(1);
}
