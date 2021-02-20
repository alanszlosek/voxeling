voxeling
====

## The Latest News

Rewrite in progress! We've moved to ES Modules and are refactoring all the things. I've moved everything to a branch called "main". Check the "master" branch for the old code.

As of 2021 I've hired a graphic designer to create new textures. Soon I will be able to phase out bdcraft (http://bdcraft.net/purebdcraft-minetest) and distribute my own textures so you can more-easily set up your own instances with less headache.

If you want to see what I'm working on, I occasionally make videos at [Relaxing With Code](https://www.youtube.com/channel/UCtuuC26V9NnEcdSKpIP15hw) on YouTube. Specifically in the [Voxeling playlist](https://www.youtube.com/playlist?list=PLGonE3T1sorRgdHNBGhpjUojdChc5CSD0).

## Introduction

Inspired by [voxel-engine](https://github.com/maxogden/voxel-engine) and [voxel.js](http://voxeljs.com), this is a multiplayer sandbox (like Minecraft creative mode) implemented in WebGL with very few dependencies. Very much a work in progress.

Demo of old, non-ES version: https://voxeling.greaterscope.com (Google Chrome and Firefox 46+)

Project blog: https://blog.alanszlosek.com/tags/voxeling/

Player skins from:

* https://github.com/maxogden/voxel-client
* https://github.com/deathcap/avatar


# Gameplay Features

* Multiplayer, with maxogden, substack and viking skins
* Block creation and destruction (batch operations via click-and-drag)
* Jumping and flying
* First-person, over-shoulder, third person camera views (these need some love, though)
* Building materials and material picker dialog
* Gamepad support (80% complete)
* Adjustable draw distance (change it according to your GPU speed and memory)
* World state is saved to files or mysql (install mysql npm module)


# What I'm working on

## Currently

* Finishing port to ES modules
* Optimizations, always and forever

## Perhaps in the Future 

* Point light sources and shadow mapping

# Technical Features

* Client and Server (ported bits from my voxel-client and voxel-server forks)
* Simple physics engine for player movements
* My own "horizonal merge" meshing algorithm
* Sample world generators
* Websocket connection for chat messages, player positions, world changes
* Chunk data is fetched via AJAX and gzipped
* Object pool to reduce memory allocations and garbage-collection pauses
* voxel-highlight replacement
* Uses hashlru for minimizing trips to the file-system or database for frequently requested chunks
* Relatively flat architecture means it's easy to get a WebGL handle and the inverse camera matrix for drawing
* All IO and chunk meshing is done in a web worker, which keeps the framerate very high
* Directional lighting
* Day and night cycle (still needs some love)

See it in action in the demo (Google Chrome or Firefox): https://voxeling.greaterscope.com

Or follow the installation instructions below to run it locally.


# Installation - Broken during port, YMMV

In terminal 1:

```
# git clone the repo into voxeling folder
cd /path/to/voxeling
# Download textures from http://bdcraft.net/purebdcraft-minetest (256x256 version). I can't distribute these textures, but I've commisioned my own textures and should be switching to them some time in 2021.
# Extract to www/testbdcraft

# Generate combined texture file (cuts down on WebGL bindTexture calls)
cd scripts
# This generates www/textures.png and texture-offsets.js
python3 -m venv ./venv
source venv/bin/activate
pip3 install pillow
python3 texture-atlases.py

cd ..
npm install

# create folder for world chunks
mkdir -p chunks/your-world

# copy the default configs and customize
cp config-example.mjs config.mjs
cp config-server-example.mjs config-server.mjs
# NOTES
# Be sure to change websocketBindAddress to the address of the interface you want to listen on
# The server config key tells the browser where to connect for a websocket connection.
# Use the "wss://" protocol for secure websocket connection from the browser, "ws://" otherwise
# TODO: put note about server vs httpServer params in config
# Also sample Caddy config for running websocket through same domain assets are served through
vim config.mjs
vim config-server.mjs

# Build the app and web worker JS bundles
# This forks 2 npm rollup processes
./build.sh 

# start server
node src/server.mjs
```

In terminal 2, start a webserver:

```
cd /path/to/voxeling
# Start Caddy 2 to serve the HTML, JavaScript, CSS and chunk files
caddy run -config ./third-party/Caddyfile -adapter caddyfile
```

Now, point your browser to http://127.0.0.1:9966. Read the introduction for controls and keybindings. Enjoy!


Contributing
====

See the CONTRIBUTING file


License
====

MIT License
