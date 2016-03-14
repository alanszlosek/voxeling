var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var inherits = require('inherits');

var Movable = require('./movable');
var scratch = require('./scratch');

function Camera(canvas, follow) {
    Movable.call(this);

    this.canvas = canvas;
    this.matrix = mat4.create();
    this.projection = mat4.create();
    this.inverse = mat4.create();
    this.follow = follow;
    this.view = 0;
    this.shoulderOffset = [ 0.4, 2, 2 ];
    this.thirdPersonOffset = [ 0, 2, 4 ];

    this.canvasResized();
}

inherits(Camera, Movable);

Camera.prototype.canvasResized = function() {
    // TODO: this shouldn't be part of the camera, i don't think
    // Adjusts coordinates for the screen's aspect ration
    mat4.perspective(this.projection, Math.PI / 4, this.canvas.clientWidth / this.canvas.clientHeight, .1, 1e3);
};

Camera.prototype.updateProjection = function() {
    var offset;
    switch (this.view) {
        // Over shoulder
        case 1:
            offset = this.shoulderOffset;
            //vec3.transformQuat(this.tempVector, offset, this.follow.getRotationQuat());
            // transform this offset, according to yaw
            //vec3.add(this.position, this.follow.getPosition(), this.tempVector);
            break;

        // Birds-eye
        case 2:
            offset = this.thirdPersonOffset;
            //vec3.transformQuat(this.tempVector, offset, this.follow.getRotationQuat());
            // transform this offset, according to yaw
            //vec3.add(this.position, this.follow.getPosition(), this.tempVector);
            break;

        // First-person
        default:
            offset = this.follow.getEyeOffset();
            break;
    }

    // Rotate eye offset into tempVector, which we'll then add to player position
    quat.rotateY(scratch.quat, scratch.identityQuat, this.follow.getYaw());
    vec3.transformQuat(scratch.vec3, offset, scratch.quat);
    vec3.add(this.position, this.follow.getPosition(), scratch.vec3);

    mat4.fromRotationTranslation(this.matrix, this.follow.getRotationQuat(), this.position);
    mat4.invert(this.inverse, this.matrix);
    mat4.multiply(this.inverse, this.projection, this.inverse);

    return this.inverse;
};

Camera.prototype.nextView = function() {
    this.view++;
    if (this.view > 2) {
        this.view = 0;
    }
};

module.exports = Camera;