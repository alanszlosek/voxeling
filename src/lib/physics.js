var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var raycast = require('voxel-raycast');

/*
- Need to make a bounding box for our character
- For each vector direction that we're moving (non-zero):
    - Check the two lines on the side of the face that faces the direction. if moving forward, check vertical lines on the left and right against nearby voxels
*/
var pos = function(data) {
    return data[0] + ', ' + data[1] + ', ' + data[2];
};

var t = "\t";
var debug = false;
// ticks per second
var tps = 60;
// this gets added to, or subtracted, based on deltaAcceleration
var currentVelocity = vec3.create();
var camera = mat4.create();
// positionVector
var voxel = 0;

// each is half of what we really want
var accelerations = {
    gravity: -2 / tps,
    // To make jumping less disorienting, fall slower from height of jump
    partialGravity: -0.4 / tps,
    // 9.8 units/blocks per second, per tick
    walk: 1.5 / tps,
    slowdown: 2 / tps,
    fly: 4 / tps
};

var velocities = {
    maxWalk: 9 / tps,
    jump: 20 / tps,
    maxFly: 15 / tps
};
var slowFall = false;

// need to pass in start position
function Physics(movable, controlState, game) {
    this.controlState = controlState;
    this.movable = movable;
    this.game = game;
    // temp variables
    this.rotatedMovementVector = vec3.create();
    this.rotationQuat = quat.create();
    this.newPosition = vec3.create();
    this.direction = vec3.create();
    this.adjustedDirection = vec3.create();
}

Physics.prototype.tick = function() {
    this.movable.isMoving = this.controlState.forward || this.controlState.backward;

    // don't tick based on delta milliseconds ... lets always assume our tick rate:
    // much less math, and if we have a pause, the character won't lurch forward
    if (this.controlState.forward == 1) {
        currentVelocity[2] += -accelerations.walk;
        currentVelocity[2] = Math.max(currentVelocity[2], -velocities.maxWalk);
    } else if (this.controlState.forward > 0) {
        currentVelocity[2] = -velocities.maxWalk * this.controlState.forward;
    } else if (this.controlState.backward == 1) {
        currentVelocity[2] += accelerations.walk;
        currentVelocity[2] = Math.min(currentVelocity[2], velocities.maxWalk);
    } else if (this.controlState.backward > 0) {
        currentVelocity[2] = velocities.maxWalk * this.controlState.backward;
    } else {
        // Slowdown
        if (currentVelocity[2] > 0) {
            currentVelocity[2] -= accelerations.slowdown;
            if (currentVelocity[2] < 0) {
                currentVelocity[2] = 0;
            }
        } else if (currentVelocity[2] < 0) {
            currentVelocity[2] += accelerations.slowdown;
            if (currentVelocity[2] > 0) {
                currentVelocity[2] = 0;
            }
        }
    }
    if (this.controlState.left == 1) {
        // keyboard, accelerate gradually
        currentVelocity[0] += -accelerations.walk;
        currentVelocity[0] = Math.max(currentVelocity[0], -velocities.maxWalk);
    } else if (this.controlState.left > 0) {
        // gamepad, no acceleration, use stick percentage
        currentVelocity[0] = -velocities.maxWalk * this.controlState.left;
    } else if (this.controlState.right == 1) {
        currentVelocity[0] += accelerations.walk;
        currentVelocity[0] = Math.min(currentVelocity[0], velocities.maxWalk);
    } else if (this.controlState.right > 0) {
        currentVelocity[0] = velocities.maxWalk * this.controlState.right;
    } else {
        // Slowdown
        if (currentVelocity[0] > 0) {
            currentVelocity[0] -= accelerations.slowdown;
            if (currentVelocity[0] < 0) {
                currentVelocity[0] = 0;
            }
        } else if (currentVelocity[0] < 0) {
            currentVelocity[0] += accelerations.slowdown;
            if (currentVelocity[0] > 0) {
                currentVelocity[0] = 0;
            }
        }
    }
    
    // flying and jumping should fall slowly
    if (this.controlState.jump && currentVelocity[1] == 0) {
        // only allow jumping if we're on the ground
        slowFall = true;
        currentVelocity[1] = velocities.jump;
    } else if (this.controlState.fly) {
        slowFall = true;
        // dont exceed maximum upward velocity
        currentVelocity[1] += accelerations.fly;
        if (currentVelocity[1] > 0) {
            currentVelocity[1] = Math.min(currentVelocity[1], velocities.maxFly);
        }
    } else {
        if (slowFall && currentVelocity[1] < 0) {
            currentVelocity[1] += accelerations.partialGravity;
        } else {
            currentVelocity[1] += accelerations.gravity;
        }
    }
    this.handleCollision(currentVelocity);
};

Physics.prototype.handleCollision = function(movementVector) {
    var self = this;
    var hit = [ 0, 0, 0 ], normals = [ 0, 0, 0 ];
    var len;
    var bounds = this.movable.bounds.all;
    var currentPosition = this.movable.getPosition();
    var direction = this.direction;
    var adjustment;
    var collision;

    var boundsMap = {
        p0: 'front',
        n0: 'back',
        p1: 'top',
        n1: 'bottom',
        p2: 'right',
        n2: 'left'
    };

    var log = function(num, start, direction, len, hit, normals, adjustment) {
        if (debug) {
            console.log('  start' + num + ':', pos(start));
            console.log('    direction: ', pos(direction));
            console.log('    len: ', len);
            console.log('    hit: ', pos(hit));
            console.log('    normals: ', pos(normals));
            console.log('    adjusted: ', adjustment);
        }
    };
    

    this.movable.updateBounds(currentPosition);

    quat.identity(this.rotationQuat);
    quat.rotateY(this.rotationQuat, this.rotationQuat, self.movable.getYaw());

    vec3.transformQuat(this.rotatedMovementVector, movementVector, this.rotationQuat);
    // newPosition holds updated object position
    vec3.add(this.newPosition, currentPosition, this.rotatedMovementVector);
    // use updated position to calculate direction vector
    vec3.subtract(direction, this.newPosition, currentPosition);
    // TODO: debug direction ... seems wrong, as some points aren't triggering a colllision as expected

    // Raycast for as many directions as we're moving in, from every bounding box point that faces those directions
    for (var axis = 0; axis < 3; axis++) {
        var val = direction[axis];
        if (val == 0) {
            continue;
        }
        len = Math.sqrt(Math.pow(direction[0], 2) + Math.pow(direction[1], 2) + Math.pow(direction[2], 2));

        // This isn't quite working right yet
        /*
        // We don't want to raycast from all bounding box points, just the ones that point where we're moving
        bounds = this.movable.bounds[
            boundsMap[
                (val > 0 ? 'p' : 'n') + axis
            ]
        ];
        */
        for (var i = 0; i < bounds.length; i++) {
            var start = bounds[i];
            raycast(self.game, start, direction, len, hit, normals);

            if (normals[axis] != 0) {
                adjustment = hit[axis] - start[axis];
                if (normals[axis] > 0) {
                    adjustment = Math.ceil(adjustment);
                } else {
                    adjustment = Math.floor(adjustment);
                }
                log(1, start, direction, len, hit, normals, adjustment);
                direction[axis] = adjustment;
                currentVelocity[axis] = 0;
                if (axis == 1) {
                    slowFall = false;
                }
                // Break out after a collision on one of the bounding box points
                break;
            }
        }
    }

    self.movable.translate(direction);
};

module.exports = Physics;