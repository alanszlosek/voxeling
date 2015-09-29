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
var ClientGenerator = require('./lib/generators/client');
var Coordinator = require('voxel-coordinates');
var Voxels = require('./lib/voxels');
var Game = require('./lib/game');

//var Meshing = require('../lib/meshers/non-blocked')
var mesher = require('./lib/meshers/horizontal-merge');
var chunkSize = config.chunkSize;
var chunkCache = config.chunkCache;
var generator = new ClientGenerator(chunkCache, chunkSize);
var coordinates = new Coordinator(chunkSize);

//var client = new VoxelingClient('ws://127.0.0.1:10005', config, generator);
var client = new VoxelingClient('ws://ws.tenten.us', config, generator);

// TODO: use dependency injection, not this
//client.game = game
var scene;

// UI DIALOG SETUP
var fillMaterials = function(textures) {
    var container = document.getElementById('textureContainer');
    var html = '';
    for (var i = 0; i < textures.setup.length; i++) {
        var index = i + 1;
        var material = textures.setup[i];
        var src;
        if ('sides' in material) {
            src = textures.byValue[material.sides[0]].src;
        } else {
            src = material.src;
        }
        html += '<div data-id="' + index + '"><img src="' + src + '" crossorigin="anonymous" />' + '<span>' + material.name + '</span></div>';
    }
    container.innerHTML = html;
    $(container).on('click', function(e) {
        console.log(e);
        var $el = $(e.target);
        var $div = $el.closest('div');
        var index = Number($div.data('id'));
        //self.game.currentMaterial = index
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
    for (var i = 0; i < textures.setup.length; i++) {
        var index = i + 1;
        var material = textures.setup[i];
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
    textures = new Textures(webgl.gl);
    mesher.config(config.chunkSize, textures, coordinates);

    textures.load(config.textures, function() {
        // stops physics and input handling from running early
        var ready = false;
        var player = client.player = new Player(webgl.gl);
        var voxels = new Voxels(webgl.gl, textures, coordinates);
        var game = new Game(config, voxels, generator, mesher, coordinates, player);
        var camera = new Camera(canvas, player);
        var physics = new Physics(player, inputHandler.state, game);
        var lines = new Lines(webgl.gl);

        // add cube wireframe
        //lines.fill( Shapes.wire.cube([0,0,0], [1,1,1]) )
        //lines.fill( Shapes.wire.mesh([-32,0,-32], 96, 96) )

        var st = new Stats();
        st.domElement.style.position = 'absolute';
        st.domElement.style.bottom = '0px';
        document.body.appendChild(st.domElement);

        player.translate(config.initialPosition);

        webgl.onRender(function() {
            // get inverse matrix from camera and pass to render() on other objects?
            var projection = camera.inverse;

            // player
            // highlight/select
            // players.render()
            voxels.render(projection);
            lines.render(projection);
            player.render(projection);
            st.update();
        });

        // give generator the connection so it can request chunks. UGLY
        generator.setEmitter(client.connection);

        // Temporarily override draw distance settings, so we can get up and running quickly
        var horiz = config.horizontalDistance;
        var vert = config.verticalDistance;
        config.horizontalDistance = 1;
        config.verticalDistance = 1;
        game.removeFarChunks([ 0, 0, 0 ]);
        config.horizontalDistance = horiz;
        config.verticalDistance = vert;

        client.on('chunks', function() {
            if (ready) {
                return;
            }
            ready = true;
            // start, once we've got our first chunks
            webgl.start();
        });

        var currentMaterial = 1;
        var currentVoxel = null;
        var currentVoxelNormal = [ 0, 0, 0 ];
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
            value = localStorage.getItem('name').trim();
            if (!value || value.length == 0) {
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
        });

        inputHandler.on('from.start', function() {
            // Get name from input and store in localStorage
            var element = document.getElementById('username');
            var value = element.value.trim();
            if (value.length == 0) {
                value = randomName();
            }
            localStorage.setItem('name', value);

            element = document.getElementById('drawDistance');
            value = parseInt(element.value);
            if (value < 0) {
                value = 1;
            }
            localStorage.setItem('drawDistance', value);

            config.horizontalDistance = config.verticalDistance = value;
            config.horizontalRemoveDistance = config.verticalRemoveDistance = value + 1;
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

        inputHandler.on('fire', function() {
            if (currentVoxel) {
                var details = game.setBlock(currentVoxel[0], currentVoxel[1], currentVoxel[2], 0);
                // relay to server - get chunk id and index
                // details contains an array: [chunkID, voxelIndex, newValue]
                client.connection.emit('chunkVoxelIndexValue', details);
            }
        });

        inputHandler.on('firealt', function() {
            // TODO: clean this up so we use the object pool for these arrays
            if (currentVoxel) {
                var details = game.setBlock(
                    currentVoxel[0] + currentVoxelNormal[0],
                    currentVoxel[1] + currentVoxelNormal[1],
                    currentVoxel[2] + currentVoxelNormal[2],
                    currentMaterial
                );
                // relay to server - get chunk id and index
                // details contains an array: [chunkID, voxelIndex, newValue]
                client.connection.emit('chunkVoxelIndexValue', details);
            }
        });

        inputHandler.on('currentMaterial', function(c) {
            currentMaterial = c;
        });

        inputHandler.on('chat', function(message) {
            console.log('Sending ' + message);
            var out = {
                user: localStorage.getItem('name'),
                text: message
            };
            client.connection.emit('chat', out);
        });

        inputHandler.transition('start');


        // This needs cleanup, and encapsulation, but it works
        var voxelHit = [ 0, 0, 0 ];
        var distance = 10;
        var direction = vec3.create();
        var pointer = function() {
            var hit;
            direction[0] = direction[1] = 0;
            direction[2] = -1;
            vec3.transformQuat(direction, direction, camera.getPitch());
            vec3.transformQuat(direction, direction, camera.getYaw());
            hit = raycast(game, player.getPosition(), direction, distance, voxelHit, currentVoxelNormal);
            if (hit > 0) {
                voxelHit[0] = Math.floor(voxelHit[0]);
                voxelHit[1] = Math.floor(voxelHit[1]);
                voxelHit[2] = Math.floor(voxelHit[2]);
                var hi = [ voxelHit[0] + 1, voxelHit[1] + 1, voxelHit[2] + 1 ];
                lines.fill(Shapes.wire.cube(voxelHit, hi));
                lines.skip(false);
                currentVoxel = voxelHit;
            } else {
                // clear
                lines.skip(true);
                currentVoxel = null;
            }
        };


        // non-frame ticks
        setInterval(function() {
            if (ready) {
                inputHandler.tick();
                // physics will somehow update player position, and thus, the camera
                physics.tick();
            }
            camera.updateProjection();
            game.tick();
            //players.tick()
            //other.tick()
            pointer();
        }, 1000 / 60);
    });
});
