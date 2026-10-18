import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, expect, it } from "vitest";

const directory = mkdtempSync(join(tmpdir(), "fliq-release-"));
const file = join(directory, "config.jsonc");
afterAll(() => {
  unlinkSync(file);
  rmdirSync(directory);
});
function check(origin: string, databaseId: string) {
  writeFileSync(
    file,
    `// JSONC configuration with a trailing comma\n{ "vars": { "APP_ORIGIN": ${JSON.stringify(origin)}, }, "d1_databases": [{ "database_id": ${JSON.stringify(databaseId)}, }], }`,
  );
  return spawnSync(
    process.execPath,
    [
      fileURLToPath(new URL("../scripts/release-check.mjs", import.meta.url)),
      file,
    ],
    { encoding: "utf8" },
  );
}
it("reads the JSONC configuration and rejects placeholder production values with an actionable message", () => {
  const result = check(
    "https://fliq.YOUR_SUBDOMAIN.workers.dev",
    "00000000-0000-0000-0000-000000000000",
  );
  expect(result.status).toBe(2);
  expect(result.stderr).toContain(
    "Configure the real HTTPS APP_ORIGIN and D1 database_id",
  );
  expect(result.stderr).not.toContain("SyntaxError");
});
it("accepts valid settings without depending on the real production configuration file", () => {
  const result = check(
    "https://fliq.example.test",
    "11111111-1111-4111-8111-111111111111",
  );
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("configuration verified");
});
