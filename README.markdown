voxeling
====

Inspired by voxel-engine, this is a multiplayer sandbox (like Minecraft creation mode) implemented in pure WebGL with very few dependencies. Very much a work in progress.

Demo (Google Chrome only): http://voxeling.greaterscope.com

More info: http://voxeling.tumblr.com/

Textures provided by https://github.com/deathcap/ProgrammerArt and https://github.com/phionabrie
Player skins from https://github.com/maxogden/voxel-client and https://github.com/deathcap/avatar


Features
====

* Multiplayer, with maxogden, substack and viking skins
* Block creation and destruction
* Jumping and flying
* First-person, over-shoulder, third person camera views (these need some love, though)
* Building materials and material picker dialog
* Gamepad support (80% complete)
* Adjustable draw distance (adjust it according to your GPU speed and memory)
* World changes are persisted to disk
* Relatively flat architecture means it's easy to get a WebGL handle and the inverse camera matrix for drawing
* All IO and chunk meshing is done in a web worker, which keeps the framerate very high
* Directional lighting
* Ability to persist chunks to disk or mysql (you'll need to install mysql npm module)


What I'm working on
====

* Use gzip when storing chunk data in mysql
* Fix other server-side generators to match server-terraced API
* Fix camera movement in over-shoulder and third-person views


What's Included
====

* Client and Server (ported bits from my voxel-client and voxel-server forks)
* Simple physics engine for player movements
* Meshing algorithms
* Sample world generators
* Improved websocket emitter - disconnects are handled gracefully
* Object pool to reduce memory allocations and garbage-collection pauses
* voxel-highlight replacement, but more work is needed
* Simple run-length encoder/decoder (voxel-crunch did bitwise ops, and was buggy across node versions)

See it in action in the demo (Google Chrome only): http://voxeling.greaterscope.com

Or follow the installation instructions below to run it locally.


Installation
====

In terminal 1:

```
cd /path/to/voxeling-engine
npm install

# create folder for world chunks
mkdir -p chunks/your-world

# copy the default config and customize
cp config-example.js config.js
vim config.js

# generate web-worker JavaScript
./worker.sh

# start server
node server.js
```

In terminal 2:

```
# start the client
./client.sh
```

Now, point your browser to http://127.0.0.1:9966. Read the introduction and enjoy!



License
====

MIT License
