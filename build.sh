#!/bin/bash
./node_modules/.bin/rollup -c rollup.client.js && ./node_modules/.bin/rollup -c rollup.client-worker.js

