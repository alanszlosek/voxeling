voxeling
====

## The Latest News

Refactoring into ES Modules is done. Current branch is "main", check "master" for the old code.

We have a new set of textures that I'm free to distribute. Some were created by a graphic designer (the good ones), others were created by me to finish the job (the not-so-good ones). Previously I recommended using bdcraft (http://bdcraft.net/purebdcraft-minetest) which we didn't create and could not distribute. Now that we have our own I can streamline the setup and installation.

If you want to see what I'm working on, I occasionally make videos at [Relaxing With Code](https://www.youtube.com/channel/UCtuuC26V9NnEcdSKpIP15hw) on YouTube. Specifically in the [Voxeling playlist](https://www.youtube.com/playlist?list=PLGonE3T1sorRgdHNBGhpjUojdChc5CSD0).

## Introduction

Inspired by [voxel-engine](https://github.com/maxogden/voxel-engine) and [voxel.js](http://voxeljs.com), this is a multiplayer sandbox (like Minecraft creative mode) implemented in WebGL with very few dependencies. Very much a work in progress.

Demo: https://voxeling.greaterscope.com. Use Google Chrome (not Chromium) as it provides the smoothest experience, expecially on Linux.

Project blog: https://blog.alanszlosek.com/tags/voxeling/

Player skins from:

* https://github.com/maxogden/voxel-client
* https://github.com/deathcap/avatar


# Gameplay Features

* Multiplayer, with maxogden, substack and viking skins
* Block creation and destruction (batch operations via click-and-drag)
* Jumping and flying
* First-person, third person camera views
* Building materials and material picker dialog
* Gamepad support (90% complete)
* Adjustable draw distance (change it according to your GPU speed and memory)
* World state is saved to files or mysql (install mysql npm module)


# What I'm working on

## Currently

* Dragon model
* Physics+collision detection re-work in preparation for NPC animals
* Optimizations, always and forever

## Perhaps in the Future 

* Point light sources and shadow mapping

# Technical Features

* Client and Server (ported bits from my voxel-client and voxel-server forks)
* Simple physics engine for player movements
* My own "rectangle merge" meshing algorithm
* Sample world generators
* Websocket connection for chat messages, player positions, world changes
* Chunk data is fetched via AJAX and gzipped
* Object pool to reduce memory allocations and garbage-collection pauses
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
# Download textures from https://alanszlosek.com/voxeling/textures-20220227.zip
# Extract to www/textures/*.png

# Generate combined texture file (cuts down on WebGL bindTexture calls)
cd scripts
# This generates texture atlases (www/textures[0-9].png) and texture-offsets.js
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
# This uses esbuild to build into www/client.js and www/client-worker.js
./esb.sh

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
