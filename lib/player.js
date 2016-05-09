var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var inherits = require('inherits');
var Movable = require('./movable');
var Shapes = require('./shapes');
var Model = require('./model');

function Player(gl, shader, texture) {
    var self = this;
    Movable.call(this);
    this.eyeOffset = vec3.fromValues(0, 1.25, -0.175);
    this.eyePosition = vec3.create();

    var uvCoordinates = {
        head: [
            //x  y   w   h
            24,  16,  8,  8, // back
             8,  16,  8,  8, // front
             8,  24,  8,  8, // top
            16,  24,  8,  8, // bottom
            16,  16,  8,  8, // left
             0,  16,  8,  8 // right
        ],
        body: [
            32,  0,  8, 12, // back
            20,  0,  8, 12, // front
            20, 12,  8,  4, // top
            28, 12,  8,  4, // bottom
            28,  0,  4, 12, // left
            32,  0, -4, 12  // right
        ],
        rightArm: [
            52,  0,  4, 12, // back
            44,  0,  4, 12, // front
            44, 12,  4,  4, // top
            48, 12,  4,  4, // bottom
            48,  0,  4, 12, // left
            40,  0,  4, 12 // right
        ],

        leftArm: [
            44,  0,  4, 12, // back
            52,  0,  4, 12, // front
            44, 12,  4,  4, // top
            48, 12,  4,  4, // bottom
            40,  0,  4, 12, // left
            48,  0,  4, 12 // right
        ],

        rightLeg: [
            12,  0,  4, 12, // back
             4,  0,  4, 12,
            12, 12, -4,  4, // top
             8, 12, -4,  4,
             8,  0,  4, 12, // left
             0,  0,  4, 12 // right
        ],
        leftLeg: [
            12,  0,  4, 12, // back
             4,  0,  4, 12,
            12, 12, -4,  4, // top
             8, 12, -4,  4,
             8,  0,  4, 12, // left
             0,  0,  4, 12 // right
        ]
    };
    var meshes=[];
    var shape;
    var armRotation = 0.6662;
    var walkAnimationSpeed = 40;


    shape = Shapes.three.rectangle(0.33, 0.35, 0.33, uvCoordinates.head, 64);
    shape.part = 0;
    mat4.translate(shape.view, shape.view, [0, 1.12, 0]);
    meshes.push(shape);

    // 4, 12, 8
    // out of 32
    shape = Shapes.three.rectangle(0.33, 0.5, 0.2, uvCoordinates.body, 64);
    shape.part = 1;
    mat4.translate(shape.view, shape.view, [0, 0.68, 0]);
    meshes.push(shape);

    shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.leftArm, 64);
    shape.part = 2;
    shape.render = function(ts) {
        if (self.isMoving) {
            this.rotation[0] = Math.cos(0.6662 * (ts/walkAnimationSpeed));
        } else {
            this.rotation[0] = 0;
        }
    };
    shape.rotateAround[1] = 0.25;
    mat4.rotateZ(shape.view, shape.view, -0.1);
    mat4.translate(shape.view, shape.view, [-0.33, 0.62, 0]);
    meshes.push(shape);

    shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.rightArm, 64);
    shape.part = 2;
    shape.render = function(ts) {
        if (self.isMoving) {
            this.rotation[0] = -Math.cos(0.6662 * (ts/walkAnimationSpeed));
        } else {
            this.rotation[0] = 0;
        }
        
    };
    shape.rotateAround[1] = 0.25;
    mat4.rotateZ(shape.view, shape.view, 0.1);
    mat4.translate(shape.view, shape.view, [0.33, 0.62, 0]);
    meshes.push(shape);

    shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.leftLeg, 64);
    shape.part = 3;
    shape.render = function(ts) {
        if (self.isMoving) {
            this.rotation[0] = -Math.cos(0.6662 * (ts/walkAnimationSpeed));
        } else {
            this.rotation[0] = 0;
        }
        
    };
    shape.rotateAround[1] = 0.25;
    mat4.translate(shape.view, shape.view, [-0.09, 0.2, 0]);
    meshes.push(shape);

    shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.rightLeg, 64);
    shape.part = 3;
    shape.render = function(ts) {
        if (self.isMoving) {
            this.rotation[0] = Math.cos(0.6662 * (ts/walkAnimationSpeed));
        } else {
            this.rotation[0] = 0;
        }
        
    };
    shape.rotateAround[1] = 0.25;
    mat4.translate(shape.view, shape.view, [0.09, 0.2, 0]);
    meshes.push(shape);

    this.model = new Model(gl, shader, meshes, texture, this);
}

inherits(Player, Movable);

Player.prototype.translate = function(vector) {
    vec3.add(this.position, this.position, vector);
    vec3.add(this.eyePosition, this.position, this.eyeOffset);
};
Player.prototype.setTranslation = function(x, y, z) {
    vec3.copy(this.position, arguments);
    vec3.add(this.eyePosition, this.position, this.eyeOffset);
};

Player.prototype.getEyeOffset = function() {
    return this.eyeOffset;
};

Player.prototype.getEyePosition = function() {
    return this.eyePosition;
};

Player.prototype.setTexture = function(texture) {
    this.model.setTexture(texture);
}

Player.prototype.render = function(projection, ts) {
    this.model.render(projection, ts);
};

module.exports = Player;
