voxeling-engine
====

Inspired by voxel-engine, a pure WebGL voxel engine with very few dependencies.

More info: http://voxeling.tumblr.com/

Of course, this is still a work in progress. Soon I hope to host a demo for anyone to try.


Features
====

* Multiplayer! Although, we don't have any character models yet
* Block creation and destruction
* Jumping and flying
* First and third person camera views
* Building materials and material picker dialog
* Gamepad support (80% complete)
* Adjustable draw distance
* World changes are persisted to disk
* Relatively flat architecture means it's easy to get a WebGL handle and the inverse camera matrix for drawing

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

See it in action ...


Installation
====

```
cd /path/to/voxeling-engine
npm install

# create folder for world chunks and edit config.js
node server.js
# in another terminal
./client.sh
```

Now, point your browser to http://127.0.0.1:9966. Read the introduction and enjoy!


Up Next
====

* Character models
* Move meshing to web worker thread
* Directional lighting

License
====

MIT License