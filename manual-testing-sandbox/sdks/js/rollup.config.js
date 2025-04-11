import alias from '@rollup/plugin-alias';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';

export default [
  // Node build
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/index.js',
        format: 'cjs',
        sourcemap: true,
        inlineDynamicImports: true
      },
      {
        file: 'dist/index.esm.js',
        format: 'es',
        sourcemap: true,
        inlineDynamicImports: true
      }
    ],
    plugins: [
      json(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist'
      }),
      resolve({
        browser: false,
        preferBuiltins: true
      }),
      commonjs()
    ],
    external: ['pino', '.env', /next-js-test\/.*/, /dev-test\/.*/]
  },
  // Browser build
  {
    input: 'src/index-browser.js',
    output: [
      {
        file: 'dist/browser/index.esm.js',
        format: 'es',
        sourcemap: true
      }
    ],
    plugins: [
      alias({
        entries: [
          { find: 'fs', replacement: './src/shims/empty.js' },
          { find: 'path', replacement: './src/shims/empty.js' },
        ]
      }),
      json(),
      commonjs({
      }),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: 'dist',
        compilerOptions: {
          module: 'esnext',
          moduleResolution: 'node',
          esModuleInterop: true,
          allowJs: true,
          allowImportingTsExtensions: true,
          noEmit: true
        }
      }),
      resolve({
        browser: true,
        // Make sure Rollup does not try to use built-ins
        // or polyfill them for the browser
        preferBuiltins: false,
      })
    ],
    // Mark them external so they're never included in the browser bundle
    external: [
      '.env',
      /next-js-test\/.*/,
      /dev-test\/.*/
    ]
  },
]; 