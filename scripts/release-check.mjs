import { readFileSync } from "node:fs";
import process from "node:process";
import { URL, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { parse } from "jsonc-parser";
const errors = [];
const config = parse(
  readFileSync(
    process.argv[2]
      ? pathToFileURL(resolve(process.argv[2]))
      : new URL("../wrangler.production.jsonc", import.meta.url),
    "utf8",
  ),
  errors,
  { allowTrailingComma: true },
);
const origin = config?.vars?.APP_ORIGIN;
let validOrigin = false;
try {
  validOrigin =
    typeof origin === "string" &&
    origin.startsWith("https://") &&
    !origin.includes("YOUR_SUBDOMAIN") &&
    new URL(origin).origin === origin;
} catch {
  /* Invalid origins fail the guard below. */
}
const databaseId = config?.d1_databases?.[0]?.database_id;
if (
  errors.length ||
  !validOrigin ||
  typeof databaseId !== "string" ||
  !/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(databaseId) ||
  databaseId === "00000000-0000-0000-0000-000000000000"
) {
  process.stderr.write(
    "Configure the real HTTPS APP_ORIGIN and D1 database_id in wrangler.production.jsonc before deployment.\n",
  );
  process.exit(2);
}
process.stdout.write(
  "Production origin and database configuration verified. Google secrets must be configured separately.\n",
);
