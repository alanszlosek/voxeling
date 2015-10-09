var glm = require('gl-matrix'), vec3 = glm.vec3, mat4 = glm.mat4, quat = glm.quat;

var Movable = function() {
    this.yaw = quat.create();
    this.pitch = quat.create();
    this.pitchAngle = 0;
    this.position = vec3.create();
    this.bounds = {
        bottomFrontLeft: [ 0, 0, 0 ],
        bottomFrontRight: [ 0, 0, 0 ],
        bottomBackLeft: [ 0, 0, 0 ],
        bottomBackRight: [ 0, 0, 0 ],
        middleFrontLeft: [ 0, 0, 0 ],
        middleFrontRight: [ 0, 0, 0 ],
        middleBackLeft: [ 0, 0, 0 ],
        middleBackRight: [ 0, 0, 0 ],
        topFrontLeft: [ 0, 0, 0 ],
        topFrontRight: [ 0, 0, 0 ],
        topBackLeft: [ 0, 0, 0 ],
        topBackRight: [ 0, 0, 0 ],
        all: null
    };
    this.bounds.all = [ this.bounds.bottomFrontLeft, this.bounds.bottomFrontRight, this.bounds.bottomBackLeft, this.bounds.bottomBackRight, this.bounds.middleFrontLeft, this.bounds.middleFrontRight, this.bounds.middleBackLeft, this.bounds.middleBackRight, this.bounds.topFrontLeft, this.bounds.topFrontRight, this.bounds.topBackLeft, this.bounds.topBackRight ];
};

Movable.prototype.translate = function(vector) {
    vec3.add(this.position, this.position, vector);
};

Movable.prototype.rotateY = function(radians) {
    quat.rotateY(this.yaw, this.yaw, radians);
};

Movable.prototype.rotateX = function(radians) {
    // clamp absolute camera pitch, after applying pitch delta
    var result = this.pitchAngle + radians;

    if (result > 1.5) {
        radians -= (result - 1.5);
        quat.rotateX(this.pitch, this.pitch, radians);
        this.pitchAngle = 1.5;

    } else if (result < -1.5) {
        radians += (-1.5 - result);
        quat.rotateX(this.pitch, this.pitch, radians);
        this.pitchAngle = -1.5;

    } else {
        quat.rotateX(this.pitch, this.pitch, radians);
        this.pitchAngle += radians;
    }
};

Movable.prototype.getPosition = function() {
    return this.position;
};

Movable.prototype.getX = function() {
    return this.position[0];
};

Movable.prototype.getY = function() {
    return this.position[1];
};

Movable.prototype.getZ = function() {
    return this.position[2];
};

Movable.prototype.getPitch = function() {
    return this.pitch;
};

Movable.prototype.getYaw = function() {
    return this.yaw;
};

Movable.prototype.updateBounds = function(position) {
    var x = position[0], y = position[1] - 1.5, z = position[2];
    var width = .6;
    var height = 1.6;
    var w = width / 2;
    var h = height / 2;
    var bounds;
    // x0/y0/z0 - forward + left
    bounds = this.bounds.bottomFrontLeft;
    bounds[0] = x - w;
    bounds[1] = y;
    bounds[2] = z - w;
    // x0/y0/z1 - backward + left
    bounds = this.bounds.bottomBackLeft;
    bounds[0] = x - w;
    bounds[1] = y;
    bounds[2] = z + w;
    // x1/y0/z1 - backward + right
    bounds = this.bounds.bottomBackRight;
    bounds[0] = x + w;
    bounds[1] = y;
    bounds[2] = z + w;
    // x1/y0/z0 - forward + right
    bounds = this.bounds.bottomFrontRight;
    bounds[0] = x + w;
    bounds[1] = y;
    bounds[2] = z - w;
    bounds = this.bounds.middleFrontLeft;
    bounds[0] = x - w;
    bounds[1] = y + h;
    bounds[2] = z - w;
    bounds = this.bounds.middleBackLeft;
    bounds[0] = x - w;
    bounds[1] = y + h;
    bounds[2] = z + w;
    bounds = this.bounds.middleBackRight;
    bounds[0] = x + w;
    bounds[1] = y + h;
    bounds[2] = z + w;
    bounds = this.bounds.middleFrontRight;
    bounds[0] = x + w;
    bounds[1] = y + h;
    bounds[2] = z - w;
    bounds = this.bounds.topFrontLeft;
    bounds[0] = x - w;
    bounds[1] = y + height;
    bounds[2] = z - w;
    bounds = this.bounds.topBackLeft;
    bounds[0] = x - w;
    bounds[1] = y + height;
    bounds[2] = z + w;
    bounds = this.bounds.topBackRight;
    bounds[0] = x + w;
    bounds[1] = y + height;
    bounds[2] = z + w;
    bounds = this.bounds.topFrontRight;
    bounds[0] = x + w;
    bounds[1] = y + height;
    bounds[2] = z - w;
};

module.exports = Movable;