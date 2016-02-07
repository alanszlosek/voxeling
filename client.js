var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var randomName = require('sillyname');
var config = require('./config');
var raycast = require('voxel-raycast');
var WebGL = require('./lib/webgl');
var Camera = require('./lib/camera');
var InputHandler = require('./lib/client-input');
var Lines = require('./lib/lines');
var Shapes = require('./lib/shapes');
var Textures = require('./lib/textures');
var Player = require('./lib/player');

var Physics = require('./lib/physics');
var Stats = require('./lib/stats');
var VoxelingClient = require('./lib/client');
var Coordinates = require('./lib/coordinates');
var Voxels = require('./lib/voxels');
var Game = require('./lib/game');

//var Meshing = require('../lib/meshers/non-blocked')
var mesher = require('./lib/meshers/horizontal-merge');
var chunkSize = config.chunkSize;
var coordinates = new Coordinates(chunkSize);
var pool = require('./lib/object-pool');

var client = new VoxelingClient(config);

// TODO: use dependency injection, not this
//client.game = game
var scene;

// UI DIALOG SETUP
var fillMaterials = function(textures) {
    var container = document.getElementById('textureContainer');
    var html = '';
    for (var i = 0; i < textures.textureArray.length; i++) {
        var material = textures.textureArray[i];
        var src;
        if ('sides' in material) {
            src = textures.byValue[material.sides[0]].src;
        } else {
            src = material.src;
        }
        html += '<div data-texturevalue="' + material.value + '"><img src="' + src + '" crossorigin="anonymous" />' + '<span>' + material.name + '</span></div>';
    }
    container.innerHTML = html;
    $(container).on('click', function(e) {
        var $el = $(e.target);
        var $div = $el.closest('div');
        $(self.container).find('div').removeClass('selected');
        $div.addClass('selected');
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
};

var fillSettings = function(textures) {
    var container = document.getElementById('settings');
    var html = '';
    for (var i = 0; i < textures.textureArray.length; i++) {
        var index = i + 1;
        var material = textures.textureArray[i];
        if ('sides' in material) {
            continue;
        }
        html += '<input name="' + matrial.name + '" data-id="' + material.value + '" value="' + material.src + '" /> ' + material.name + '<br />';
    }
    container.innerHTML = html;
    $(container).on('blur', 'input', function(e) {
        var $el = $(this);
        var id = $el.data('id');
        textures.byValue[id].src = $el.val();
        // Now trigger reload ... need to modify the Textures object
        return false;
    });
};

// Funny, this gets triggered if the initial connection fails
client.on('close', function() {
    alert('Disconnected');
});

client.on('ready', function() {
    var canvas = document.getElementById('herewego');
    var inputHandler = new InputHandler(document.body, document.body);
    var webgl
    var textures

    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    webgl = new WebGL(canvas);
    textures = new Textures(config.textures);
    
    //mesher.config(config.chunkSize, textures, coordinates);

    // Wait until textures have fully loaded
    textures.load(webgl.gl, function() {
        // ready=false stops physics from running early
        var ready = false;
        var player = client.player = new Player(webgl.gl, textures);
        var players = {};
        var voxels = new Voxels(webgl.gl, textures, coordinates);
        var game = new Game(
            config, client.chunkCache, voxels, coordinates, player,
            // This is called by requestNearbyMissingChunks
            function(needChunks) {
                needChunks.unshift('needChunks');
                client.worker.postMessage(needChunks);
            },
            // This is called when the game is done with a chunk
            function(oldChunk) {
                var transferList = [];
                
                transferList.push( oldChunk.voxels );

                // We want to transfer mesh arrays
                for (var textureValue in oldChunk.mesh) {
                    var texture = oldChunk.mesh[textureValue];
                    // We don't have the Growable wrapper (only on the worker side),
                    // here we just have the ArrayBuffer
                    transferList.push(texture.position.buffer);
                    transferList.push(texture.texcoord.buffer);
                }

                client.worker.postMessage(['freeChunk', oldChunk], transferList);
            }
        );
        var camera = new Camera(canvas, player);
        var physics = new Physics(player, inputHandler.state, game);
        var lines = new Lines(webgl.gl);
        
        client.game = game;

        // add cube wireframe
        //lines.fill( Shapes.wire.cube([0,0,0], [1,1,1]) )
        //lines.fill( Shapes.wire.mesh([-32,0,-32], 96, 96) )

        var st = new Stats();
        st.domElement.style.position = 'absolute';
        st.domElement.style.bottom = '0px';
        document.body.appendChild(st.domElement);

        player.translate(config.initialPosition);

        webgl.onRender(function() {
            // what's the proper name for this matrix?
            // get inverse matrix from camera and pass to render() on other objects?
            var matrix = camera.inverse;

            // player
            // highlight/select
            // players.render()
            voxels.render(matrix);
            lines.render(matrix);
            player.render(matrix);
            st.update();


            for (var id in players) {
                var pl = players[id];
                pl.model.render(matrix);
            }
        });

        game.removeFarChunks([ 0, 0, 0 ]);
        webgl.start();

        client.on('players', function(others) {
            for (var id in others) {
                var updatedPlayerInfo = others[id];
                var player;
                if (id in players) {
                    player = players[id];
                } else {
                    players[id] = updatedPlayerInfo;
                    player = updatedPlayerInfo;
                    player.model = new Player(webgl.gl, textures, 'wood');
                }
                // player 
                player.model.setTranslation(updatedPlayerInfo.position);
                player.model.setRotation(updatedPlayerInfo.pitch, updatedPlayerInfo.yaw, 0);
            }
            // Compare players to others, remove old players
            for (var id in players) {
                if (!(id in others)) {
                    delete players[id];
                }
            }
        });

        // Material to build with. The material picker dialog changes this value
        var currentMaterial = 1;
        // Holds coordinates of the voxel being looked at
        var currentVoxel = null;
        var currentNormalVoxel = pool.malloc('array', 3);

        // When doing bulk create/destroy, holds the coordinates of the start of the selected region
        var selectStart = pool.malloc('array', 3);
        
        fillMaterials(textures);

        // Show coordinates
        var elCoordinates = document.getElementById('coordinates');
        setInterval(function() {
            elCoordinates.textContent = player.getPosition().map(Math.floor).join(',');
        }, 500);


        // INPUT HANDLER SETUP
        inputHandler.mouseDeltaCallback(function(delta) {
            // Can I do these at the same time? Maybe a new quat, rotated by vector, multiplied into existing?
            player.rotateY(-(delta.dx / 200));
            // Don't pitch player, just the camera
            player.rotateX(-(delta.dy / 200));
        });

        inputHandler.on('view', function() {
            camera.nextView();
        });

        inputHandler.on('to.start', function() {
            var element;
            var value;
            document.getElementById('overlay').className = 'introduction';

            // nickname
            element = document.getElementById('username');
            value = localStorage.getItem('name');
            if (!value || value.length == 0 || value.trim().length == 0) {
                value = randomName();
                localStorage.setItem('name', value);
            }
            element.value = value;

            // draw distance
            element = document.getElementById('drawDistance');
            value = localStorage.getItem('drawDistance');
            if (!value) {
                value = 2;
                localStorage.setItem('drawDistance', value);
            }
            element.value = value;
            config.horizontalDistance = config.verticalDistance = value;
            config.horizontalRemoveDistance = config.verticalRemoveDistance = value + 1;
        });

        inputHandler.on('drawDistance', function(drawDistance) {
            var value = parseInt(drawDistance);
            if (value < 0) {
                value = 1;
            }
            localStorage.setItem('drawDistance', value);

            config.horizontalDistance = config.verticalDistance = value;
            config.horizontalRemoveDistance = config.verticalRemoveDistance = value + 1;

            game.removeFarChunks(player.getPosition());
        });

        inputHandler.on('from.start', function() {
            // User has clicked the canvas to start playing. Let's activate physics now.
            ready = true;

            // Get name from input and store in localStorage
            var element = document.getElementById('username');
            var value = element.value.trim();
            if (value.length == 0) {
                value = randomName();
            }
            localStorage.setItem('name', value);
        });

        inputHandler.on('to.playing', function() {
            // hide intro
            var overlay = document.getElementById('overlay');
            overlay.className = '';
        });

        inputHandler.on('to.menu', function() {
            document.getElementById('overlay').className = 'textures';
        });

        inputHandler.on('from.menu', function() {
            document.getElementById('overlay').className = '';
        });


        // Creation / destruction
        var selecting = false;
        var low = pool.malloc('array', 3);
        var high = pool.malloc('array', 3);
        inputHandler.on('fire.down', function() {
            // Log current voxel we're pointing at
            if (currentVoxel) {
                selecting = true;
                selectStart[0] = currentVoxel[0];
                selectStart[1] = currentVoxel[1];
                selectStart[2] = currentVoxel[2];
            }
        });
        inputHandler.on('fire.up', function() {
            if (currentVoxel && selecting) {
                /*
                Regarding out:
                - keys are chunkIDs
                - each value is an array of pairs where subsequent elements are pairs:
                    - voxel index
                    - voxel value (texture number)
                */
                var out = {};
                var details;
                var chunkID;
                low[0] = Math.min(selectStart[0], currentVoxel[0]);
                low[1] = Math.min(selectStart[1], currentVoxel[1]);
                low[2] = Math.min(selectStart[2], currentVoxel[2]);
                high[0] = Math.max(selectStart[0], currentVoxel[0]);
                high[1] = Math.max(selectStart[1], currentVoxel[1]);
                high[2] = Math.max(selectStart[2], currentVoxel[2]);
                for (var i = low[0]; i <= high[0]; i++) {
                    for (var j = low[1]; j <= high[1]; j++) {
                        for (var k = low[2]; k <= high[2]; k++) {
                            if (inputHandler.state.alt) {
                                // details is an array: [voxelIndex, newValue, chunkID]
                                details = game.setBlock(i, j, k, currentMaterial);
                            } else {
                                // details is an array: [voxelIndex, newValue, chunkID]
                                details = game.setBlock(i, j, k, 0);
                            }
                            chunkID = details.pop();
                            if (chunkID in out) {
                                Array.prototype.push.apply(out[chunkID], details);
                            } else {
                                out[chunkID] = details;
                            }
                        }
                    }
                }
                // details contains an array: [chunkID, voxelIndex, newValue]
                client.worker.postMessage(['chunkVoxelIndexValue', out]);
                client.updateVoxelCache(out);
                out = {};
            }
            selecting = false;
        });

        inputHandler.on('firealt.down', function() {
            // Log current voxel we're pointing at
            if (currentVoxel) {
                selecting = true;
                selectStart[0] = currentNormalVoxel[0];
                selectStart[1] = currentNormalVoxel[1];
                selectStart[2] = currentNormalVoxel[2];
            }
        });
        inputHandler.on('firealt.up', function() {
            // TODO: clean this up so we use the object pool for these arrays
            if (currentVoxel && selecting) {
                /*
                Regarding out:
                - keys are chunkIDs
                - each value is an array of pairs where subsequent elements are pairs:
                    - voxel index
                    - voxel value (texture number)
                */
                var out = {};
                var details
                low[0] = Math.min(selectStart[0], currentNormalVoxel[0]);
                low[1] = Math.min(selectStart[1], currentNormalVoxel[1]);
                low[2] = Math.min(selectStart[2], currentNormalVoxel[2]);
                high[0] = Math.max(selectStart[0], currentNormalVoxel[0]);
                high[1] = Math.max(selectStart[1], currentNormalVoxel[1]);
                high[2] = Math.max(selectStart[2], currentNormalVoxel[2]);
                for (var i = low[0]; i <= high[0]; i++) {
                    for (var j = low[1]; j <= high[1]; j++) {
                        for (var k = low[2]; k <= high[2]; k++) {
                            // details is an array: [voxelIndex, newValue, chunkID]
                            details = game.setBlock(i, j, k, currentMaterial);
                            chunkID = details.pop();
                            if (chunkID in out) {
                                Array.prototype.push.apply(out[chunkID], details);
                            } else {
                                out[chunkID] = details;
                            }
                        }
                    }
                }
                client.worker.postMessage(['chunkVoxelIndexValue', out]);
                client.updateVoxelCache(out);
                out = {};
            }
            selecting = false;
        });

        inputHandler.on('currentMaterial', function(c) {
            currentMaterial = c;
        });

        inputHandler.on('chat', function(message) {
            var out = {
                user: localStorage.getItem('name'),
                text: message
            };
            client.worker.postMessage(['chat', out]);
        });

        inputHandler.transition('start');


        // This needs cleanup, and encapsulation, but it works
        var voxelHit = pool.malloc('array', 3);
        var voxelNormal = pool.malloc('array', 3);
        var distance = 10;
        var direction = vec3.create();
        var pointer = function() {
            var hit;
            direction[0] = direction[1] = 0;
            direction[2] = -1;
            vec3.transformQuat(direction, direction, player.getRotationQuat());
            hit = raycast(game, camera.getPosition(), direction, distance, voxelHit, voxelNormal);
            if (hit > 0) {
                voxelHit[0] = Math.floor(voxelHit[0]);
                voxelHit[1] = Math.floor(voxelHit[1]);
                voxelHit[2] = Math.floor(voxelHit[2]);

                // Give us access to the current voxel and the voxel at it's normal
                currentVoxel = voxelHit;
                currentNormalVoxel[0] = voxelHit[0] + voxelNormal[0];
                currentNormalVoxel[1] = voxelHit[1] + voxelNormal[1];
                currentNormalVoxel[2] = voxelHit[2] + voxelNormal[2];

                if (selecting) {
                    if (inputHandler.state.alt || inputHandler.state.firealt) {
                        low[0] = Math.min(selectStart[0], currentNormalVoxel[0]);
                        low[1] = Math.min(selectStart[1], currentNormalVoxel[1]);
                        low[2] = Math.min(selectStart[2], currentNormalVoxel[2]);
                        high[0] = Math.max(selectStart[0] + 1, currentNormalVoxel[0] + 1);
                        high[1] = Math.max(selectStart[1] + 1, currentNormalVoxel[1] + 1);
                        high[2] = Math.max(selectStart[2] + 1, currentNormalVoxel[2] + 1);
                    } else {
                        low[0] = Math.min(selectStart[0], currentVoxel[0]);
                        low[1] = Math.min(selectStart[1], currentVoxel[1]);
                        low[2] = Math.min(selectStart[2], currentVoxel[2]);
                        high[0] = Math.max(selectStart[0] + 1, currentVoxel[0] + 1);
                        high[1] = Math.max(selectStart[1] + 1, currentVoxel[1] + 1);
                        high[2] = Math.max(selectStart[2] + 1, currentVoxel[2] + 1);
                    }
                    lines.fill(Shapes.wire.cube(low, high));
                } else {
                    if (inputHandler.state.alt || inputHandler.state.firealt) {
                        high[0] = currentNormalVoxel[0] + 1;
                        high[1] = currentNormalVoxel[1] + 1;
                        high[2] = currentNormalVoxel[2] + 1;
                        lines.fill(Shapes.wire.cube(currentNormalVoxel, high));
                    } else {
                        high[0] = currentVoxel[0] + 1;
                        high[1] = currentVoxel[1] + 1;
                        high[2] = currentVoxel[2] + 1;
                        lines.fill(Shapes.wire.cube(currentVoxel, high));
                    }
                }
                lines.skip(false);
            } else {
                // clear
                lines.skip(true);
                currentVoxel = null;
            }
        };


        // non-frame ticks
        setInterval(function() {
            inputHandler.tick();
            // Wait until user clicks the canvas for the first time before we activate physics
            // Otherwise player may fall through the world before we get the the initial voxel data
            if (ready) {
                // physics will somehow update player position, and thus, the camera
                physics.tick();
            }
            camera.updateProjection();
            game.tick();

            //other.tick()
            pointer();
        }, 1000 / 60);
    });
});
