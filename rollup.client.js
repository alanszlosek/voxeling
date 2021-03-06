import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'src/client.mjs',
  output: {
    file: 'www/client.js',
    format: 'iife'
  },
  plugins: [nodeResolve(), commonjs()]
};

