#!/usr/bin/env node
/**
 * Generate the Prisma client without downloading an engine.
 *
 *   pnpm --filter @zal/api run prisma:generate:offline
 *
 * `prisma generate` resolves a query-engine binary from binaries.prisma.sh
 * before it runs any generator. Where that host is unreachable — a restricted
 * CI runner, an air-gapped machine, a sandbox with an egress allow-list — the
 * command fails with a checksum or 403 error and nothing gets generated, which
 * means the API cannot be typechecked or built at all.
 *
 * The generator itself does not need the binary: it writes TypeScript from the
 * schema's DMMF, and the engine is only *copied* next to the output for the
 * client to use at runtime. `skipDownload` skips exactly that copy.
 *
 * So the types this produces are complete and correct, and a client generated
 * this way can typecheck, lint and build — but it cannot connect to a database,
 * because the engine it would load is not there. Run the normal
 * `prisma generate` once you have network, before running anything that talks
 * to Postgres.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(here, '../prisma/schema.prisma');

const { getGenerators } = require('@prisma/internals');

// The generator reads the datasource URL even though it never connects.
process.env.DATABASE_URL ??= 'postgresql://offline:offline@localhost:5432/offline';

/**
 * `skipDownload` alone is not enough: getGenerators still asks fetch-engine to
 * resolve a path, which fetches a checksum before it checks the flag.
 *
 * `binaryPathsOverride` is the real switch. getBinaryPathsByVersion builds its
 * download list from the engines that are *not* overridden, so overriding every
 * engine the generator declares leaves that list empty and the download call is
 * never made. The paths are only recorded on the generator — with `noEngine`
 * nothing copies or executes them — so a placeholder is enough.
 */
const ENGINE_PLACEHOLDER = resolve(here, '../prisma/.no-engine');

const generators = await getGenerators({
  schemaPath,
  printDownloadProgress: false,
  skipDownload: true,
  noEngine: true,
  version: undefined,
  binaryPathsOverride: {
    libqueryEngine: ENGINE_PLACEHOLDER,
    queryEngine: ENGINE_PLACEHOLDER,
    schemaEngine: ENGINE_PLACEHOLDER,
  },
});

try {
  for (const generator of generators) {
    const name = generator.manifest?.prettyName ?? generator.options?.generator?.name ?? 'generator';
    await generator.generate();
    console.log(`✔ ${name} generated (no engine)`);
  }
} finally {
  for (const generator of generators) generator.stop();
}

console.log(
  '\nTypes only — this client cannot reach a database.\n' +
    'Run `prisma generate` normally before starting the API.',
);
