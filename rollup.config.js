import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

let client = {
  input: 'src/client2.mjs',
  output: {
    file: 'www/client.js',
    format: 'iife'
  },
  plugins: [nodeResolve(), commonjs()]
};

let clientWorker = {
  input: 'src/client-worker.mjs',
  output: {
    file: 'www/client-worker.js',
    format: 'iife'
  },
  plugins: [nodeResolve(), commonjs()]
};

export { client, clientWorker };
