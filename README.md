voxeling
====

Want to use docker? See `INSTALL-DOCKER.md`.

Want to run outside of a container? See `INSTALL.md`.

## The Latest News

Refactoring into ES Modules is done. Current branch is "main", check "master" for the old code.

We have a new set of textures that I'm free to distribute. Some were created by a graphic designer (the good ones), others were created by me to finish the job (the not-so-good ones). Previously I recommended some [bdcraft textures](http://bdcraft.net/purebdcraft-minetest) which I wasn't free to distribute.

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
* World state can be saved to files, mysql or mongodb


# What I'm working on

## Currently

* Dragon model
* Physics+collision detection re-work in preparation for NPC animals
* Optimizations, always and forever

## Perhaps in the Future 

* Point light sources and shadow mapping

# Technical Features

* Client and Server architecture
* Simple physics engine for player movements
* My own "rectangle merge" meshing algorithm
* Sample world generators
* Websocket connection for chat messages, player positions, world changes
* Chunk data is stored and transferred with gzip compression
* Relatively flat architecture means it's easy to get a WebGL handle and the inverse camera matrix for drawing
* All IO and chunk meshing is done in a web worker, which keeps the framerate very high
* Directional lighting
* Day and night cycle (still needs some love)

See it in action in the demo (Google Chrome or Firefox): https://voxeling.greaterscope.com

Or follow the installation instructions below to run it locally.


# Installation

See INSTALL.md.

Contributing
====

See the CONTRIBUTING file


License
====

MIT License
