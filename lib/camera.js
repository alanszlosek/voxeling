var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

var inherits = require('inherits');

var Movable = require('./movable');

function Camera(canvas, follow) {
    Movable.call(this);

    this.canvas = canvas;
    this.matrix = mat4.create();
    this.projection = mat4.create();
    this.inverse = mat4.create();
    this.tempQuat = quat.create();
    this.follow = follow;
    this.view = 0;

    // start in first-person
    this.tempVector = vec3.create();
    this.canvasResized();
}

inherits(Camera, Movable);

Camera.prototype.canvasResized = function() {
    // TODO: this shouldn't be part of the camera, i don't think
    // Adjusts coordinates for the screen's aspect ration
    mat4.perspective(this.projection, Math.PI / 4, this.canvas.clientWidth / this.canvas.clientHeight, .1, 1e3);
};

Camera.prototype.updateProjection = function() {
    if (this.view == 1) {
        var offset = [ 0, .3, 1.2 ];
        vec3.transformQuat(this.tempVector, offset, this.follow.getYaw());
        // transform this offset, according to yaw
        vec3.add(this.position, this.follow.getPosition(), this.tempVector);
        quat.copy(this.yaw, this.follow.getYaw());
        quat.copy(this.pitch, this.follow.getPitch());
        quat.multiply(this.tempQuat, this.yaw, this.pitch);

    } else if (this.view == 2) {
        var offset = [ 0, .6, 2 ];
        vec3.transformQuat(this.tempVector, offset, this.follow.getYaw());
        // transform this offset, according to yaw
        vec3.add(this.position, this.follow.getPosition(), this.tempVector);
        quat.copy(this.yaw, this.follow.getYaw());
        quat.copy(this.pitch, this.follow.getPitch());
        quat.multiply(this.tempQuat, this.yaw, this.pitch);

    } else {
        // For now, copy translation and rotation from object we're following
        quat.copy(this.yaw, this.follow.getYaw());
        quat.copy(this.pitch, this.follow.getPitch());
        vec3.copy(this.position, this.follow.getPosition());
        quat.multiply(this.tempQuat, this.yaw, this.pitch);
    }

    mat4.fromRotationTranslation(this.matrix, this.tempQuat, this.position);
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