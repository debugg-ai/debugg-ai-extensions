import commonjs from '@rollup/plugin-commonjs';
import inject from '@rollup/plugin-inject';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

// Shared plugins and config
const basePlugins = [
  json(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: 'dist',
    compilerOptions: {
      module: 'esnext',
      moduleResolution: 'node'
    }
  }),
  commonjs()
];

// Create separate configs for node and browser
export default [
  // Node.js build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/node/index.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      ...basePlugins,
      resolve({
        browser: false,
        preferBuiltins: true
      })
    ],
    external: ['pino', 'thread-stream', '.env', 'fs', 'path', /next-js-test\/.*/, /dev-test\/.*/]
  },
  // Browser build
  {
    input: 'src/index.js',
    output: {
      file: 'dist/browser/index.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      inject({
        fs: ['fs', 'default'],
        path: ['path', 'default'],
        modules: {
          fs: '{default: {}}',
          path: '{default: {}}'
        }
      }),
      ...basePlugins,
      resolve({
        browser: true,
        preferBuiltins: false
      })
    ],
    external: ['pino', 'thread-stream', '.env', /next-js-test\/.*/, /dev-test\/.*/]
  }
]; 