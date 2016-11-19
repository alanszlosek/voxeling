#!/bin/sh
dir=`dirname $0`
cd $dir/../www
../node_modules/beefy/bin/beefy ../src/client.js:bundle.js
