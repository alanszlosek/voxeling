var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var WebGL = require('./lib/webgl');
var Movable = require('./lib/movable');
var Camera = require('./lib/camera');
var Lines = require('./lib/lines');
var Shapes = require('./lib/shapes');
var Model = require('./lib/model');

var pool = require('./lib/object-pool');

var mesh = require('./lib/player-mesh');

var canvas = document.getElementById('herewego');
var webgl

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
webgl = new WebGL(canvas);

// stops physics and input handling from running early
var player = new Movable(webgl.gl);
var camera = new Camera(canvas, player);
var lines = new Lines(webgl.gl);


var modelPosition = new Movable(webgl.gl);
var model = new Model(
	webgl.gl, 
    mesh,
	//Shapes.square([0, 0, 0]),
	modelPosition
);
modelPosition.translate([0, 0, 0]);
modelPosition.rotateY(0.4);


player.translate([0, 1, 10]);

/*
camera.nextView();
camera.nextView();
*/

// add cube wireframe
lines.fill( Shapes.wire.mesh([-32,0,-32], 96, 96) )

webgl.start();
webgl.onRender(function() {
	// what's the proper name for this matrix?
	// get inverse matrix from camera and pass to render() on other objects?
	var matrix = camera.inverse;

	// player
	// highlight/select
	// players.render()
	lines.render(matrix);
	model.draw(matrix);
});

// non-frame ticks
setInterval(function() {
	camera.updateProjection();
}, 1000 / 60);


var adjustment = 1;

$('.controls')
    .on('click', 'button#addX', function(e) {
        modelPosition.translate([adjustment, 0, 0]);
    })
    .on('click', 'button#subX', function(e) {
        modelPosition.translate([-adjustment, 0, 0]);
    })

    .on('click', 'button#addY', function(e) {
        modelPosition.translate([0, adjustment, 0]);
    })
    .on('click', 'button#subY', function(e) {
        modelPosition.translate([0, -adjustment, 0]);
    })

    .on('click', 'button#addZ', function(e) {
        modelPosition.translate([0, 0, adjustment]);
    })
    .on('click', 'button#subZ', function(e) {
        modelPosition.translate([0, 0, -adjustment]);
    })
    ;