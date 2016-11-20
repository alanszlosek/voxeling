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

//var mesh = require('./lib/player-mesh');

var canvas = document.getElementById('herewego');
var webgl

canvas.width = canvas.clientWidth;
canvas.height = canvas.clientHeight;
webgl = new WebGL(canvas);

// stops physics and input handling from running early
var player = new Movable(webgl.gl);
var camera = new Camera(canvas, player);
var lines = new Lines(webgl.gl);

/*
var mesh = {
    vertices: [
        0, 0, 0,
        1, 0, 0,
        1, 1, 0
    ],
    faces: [
        0, 1, 2
    ]
};
*/
var parts = [
    // left leg
    Shapes.three.rectangle([-0.35, 0, -0.15], 0.2, 0.5, 0.2),
    // right leg
    Shapes.three.rectangle([0.15, 0, -0.15], 0.2, 0.5, 0.2),

    // torso
    Shapes.three.rectangle([-0.2, 0.5, -0.2], 0.4, 0.5, 0.4),

    // left arm
    Shapes.three.rectangle([-0.5, 0.9, -0.5], 0.2, 0.2, 0.5),
    // right arm
    Shapes.three.rectangle([0.3, 0.9, -0.5], 0.2, 0.2, 0.5),

    // head
    Shapes.three.rectangle([-0.15, 1.1, -0.15], 0.3, 0.3, 0.3),
];
var mesh = {
    vertices: [],
    faces: [],
    texcoord: null,
    rotation: [1, 1, 1],
    scale: 1.0
};

for (var i = 0; i < parts.length; i++) {
    mesh.vertices = mesh.vertices.concat(parts[i].vertices);
}
var to = mesh.vertices.length/3;
for (var i = 0; i < to; i++) {
    mesh.faces.push(i);
}

var modelPosition = new Movable(webgl.gl);
var model = new Model(
	webgl.gl, 
    mesh,
	//Shapes.square([0, 0, 0]),
	modelPosition
);
modelPosition.translate([0, 0, 0]);
modelPosition.rotateY(0.0);


player.translate([0, 0.5, 2]);

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

var $controls = $('.controls');

$controls.find('.position')
    .on('change', 'input', function(e) {
        var translation = [
            $('#positionX').val(),
            $('#positionY').val(),
            $('#positionZ').val()

        ];
        modelPosition.setTranslation(translation);
    });
$controls.find('.rotation')
    .on('change', 'input', function(e) {
        var rotation = [
            $('#rotationX').val(),
            $('#rotationY').val(),
            $('#rotationZ').val()

        ];
        modelPosition.setRotation(rotation);
    });
$controls.find('.scale')
    .on('change', 'input', function(e) {
        var scale = $('#scale').val();
        
    });

$controls.find('#fetch').on('click', function(e) {
    var url = $('#url').val();

    $.getJSON(url, function(json) {
        
    });
    
});