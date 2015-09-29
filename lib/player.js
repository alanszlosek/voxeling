var glm = require('gl-matrix'), vec3 = glm.vec3, vec4 = glm.vec4, mat4 = glm.mat4;

var inherits = require('inherits');
var Movable = require('./movable');
var Lines = require('./lines');
var Shapes = require('./shapes');

function Player(gl) {
    Movable.call(this);
    this.me = new Lines(gl, [ 0, 0, 255, 1 ]);
}

inherits(Player, Movable);

Player.prototype.translate = function(vector) {
    vec3.add(this.position, this.position, vector);

    // heh, this is kind of a bounding box
    var position = this.getPosition();
    var start = [
        position[0] - 0.3,
        position[1] - 1.5,
        position[2] - 0.3
    ];
    var end = [
        position[0] + 0.3,
        position[1] + 0.1,
        position[2] + 0.3
    ];
    this.me.fill(Shapes.wire.cube(start, end));
};

Player.prototype.render = function(projection) {
    this.me.render(projection);
};

module.exports = Player;