#!/bin/sh
dir=`dirname $0`
cd $dir/..
node node_modules/browserify/bin/cmd.js src/client-worker.js -o www/client-worker.js
