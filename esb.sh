#!/bin/bash
./node_modules/.bin/esbuild src/client.mjs src/client-worker.mjs --bundle --outdir=www 
