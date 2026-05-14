import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    plugin: 'src/plugin.ts',
    'config/index': 'src/config/index.ts',
    'validators/index': 'src/validators/index.ts',
    'hooks/index': 'src/hooks/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  external: ['openclaw'],
  // Bundle claw-core since it's referenced locally
  noExternal: ['@guardianclaw/core'],
});
