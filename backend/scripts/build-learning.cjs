const { buildSync } = require('../../frontend/node_modules/esbuild');
const path = require('node:path');
buildSync({
  entryPoints: [
    path.resolve(__dirname, '../../frontend/app/lib/learning/domain.ts'),
  ],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.resolve(__dirname, '../domain/learning.cjs'),
});
