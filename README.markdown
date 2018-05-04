voxeling
====

Inspired by [voxel-engine](https://github.com/maxogden/voxel-engine) and [voxel.js](http://voxeljs.com), this is a multiplayer sandbox (like Minecraft creative mode) implemented in WebGL with very few dependencies. Very much a work in progress.

Demo: https://voxeling.greaterscope.com (Google Chrome and Firefox 46+)

Project blog: https://blog.alanszlosek.com/tags/voxeling/

Preferred texture set:

* http://bdcraft.net/purebdcraft-minetest

Past textures provided by:
* https://github.com/deathcap/ProgrammerArt
* https://github.com/phionabrie

Player skins from:

* https://github.com/maxogden/voxel-client
* https://github.com/deathcap/avatar


Gameplay Features
====

* Multiplayer, with maxogden, substack and viking skins
* Block creation and destruction (batch operations via click-and-drag)
* Jumping and flying
* First-person, over-shoulder, third person camera views (these need some love, though)
* Building materials and material picker dialog
* Gamepad support (80% complete)
* Adjustable draw distance (change it according to your GPU speed and memory)
* World state is saved to files or mysql (install mysql npm module)


What I'm working on
====

* Optimizations, always and forever
* Point light sources and shadow mapping


Technical Features 
====

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


Installation
====

In terminal 1:

```
# git clone the repo into voxeling folder
cd /path/to/voxeling
# Download textures from http://bdcraft.net/purebdcraft-minetest (256x256 version)
# Extract to www/testbdcraft

# Generate combined texture file (cuts down on WebGL bindTexture calls)
# You'll need PHP with gd/imagemagick. Once I get node version working, you won't need PHP
cd scripts
# This generates www/textures.png and texture-offsets.js
php textures.php

npm install

# create folder for world chunks
mkdir -p chunks/your-world

# copy the default config and customize
cp config-example.js config.js
vim config.js

# generate web-worker JavaScript
./scripts/worker.sh

# start server
./scripts/server.sh
```

In terminal 2:

```
cd /path/to/voxeling
# start the client
./scripts/client.sh
```

Now, point your browser to http://127.0.0.1:9966. Read the introduction for controls and keybindings. Enjoy!


Contributing
====

See the CONTRIBUTING file


License
====

MIT License
