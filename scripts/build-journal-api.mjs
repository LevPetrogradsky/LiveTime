import { build } from 'esbuild'

await build({
  entryPoints: ['server/journal-entry.ts'],
  outfile: 'api/journal.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['jose', '@neondatabase/serverless'],
  legalComments: 'none',
})

await build({
  entryPoints: ['server/livetime-history.ts'],
  outfile: 'api/livetime-history.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: ['@neondatabase/serverless'],
  legalComments: 'none',
})
