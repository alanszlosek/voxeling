var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var inherits = require('inherits');
var Movable = require('./movable');
var Shapes = require('./shapes');
var Model = require('./model');

function Player(gl, textures, textureName) {
    Movable.call(this);
    this.eyeOffset = vec3.fromValues(0, 1.25, 0);
    this.eyePosition = vec3.create();
    textureName = textureName || 'grass';

    var parts = [
        // left leg
        Shapes.three.rectangle([-0.21, 0, 0], 0.2, 0.45, 0.2),
        // right leg
        Shapes.three.rectangle([0.01, 0, 0], 0.2, 0.45, 0.2),

        // torso
        Shapes.three.rectangle([-0.15, 0.5, 0], 0.3, 0.4, 0.3),

        // left arm
        Shapes.three.rectangle([-0.28, 0.77, 0.1], 0.12, 0.12, -0.4),
        // right arm
        Shapes.three.rectangle([0.16, 0.77, 0.1], 0.12, 0.12, -0.4),

        // head
        Shapes.three.rectangle([-0.15, 0.9, 0], 0.3, 0.3, 0.3),
    ];
    var mesh = {
        vertices: [],
        normals: [],
        texcoords: [],
        rotation: [1, 1, 1],
        // scale isn't used yet
        scale: 0.9
    };

    for (var i = 0; i < parts.length; i++) {
        mesh.vertices = mesh.vertices.concat(parts[i].vertices);
        mesh.normals = mesh.normals.concat(parts[i].normals);
        mesh.texcoords = mesh.texcoords.concat(parts[i].texcoords);
    }

    this.me = new Model(
        gl, 
        mesh,
        textures.byName[textureName],
        this
    );
}

inherits(Player, Movable);

Player.prototype.translate = function(vector) {
    vec3.add(this.position, this.position, vector);
    vec3.add(this.eyePosition, this.position, [0, 1.25, 0]);
};
Player.prototype.setTranslation = function(vector) {
    vec3.copy(this.position, vector);
    vec3.add(this.eyePosition, this.position, [0, 1.25, 0]);
};

Player.prototype.getEyeOffset = function() {
    return this.eyeOffset;
};

Player.prototype.getEyePosition = function() {
    return this.eyePosition;
};

Player.prototype.render = function(projection) {
    this.me.render(projection);
};

module.exports = Player;