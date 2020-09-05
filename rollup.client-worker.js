import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/client-worker.mjs',
  output: {
    file: 'www/client-worker.js',
    format: 'iife'
  },
  plugins: [nodeResolve(), commonjs()]
};

