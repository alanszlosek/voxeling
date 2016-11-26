var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var raycast = require('voxel-raycast');

var debug = false;
// ticks per second
var tps = 60;
// this gets added to, or subtracted, based on deltaAcceleration


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

    this.currentVelocity = vec3.create();
    this.rotatedMovementVector = vec3.create();
    this.rotationQuat = quat.create();
    this.previousVelocity = vec3.create();

}

Physics.prototype.tick = function() {
    this.movable.isMoving = this.controlState.forward || this.controlState.backward;

    // don't tick based on delta milliseconds ... lets always assume our tick rate:
    // much less math, and if we have a pause, the character won't lurch forward
    if (this.controlState.forward == 1) {
        this.currentVelocity[2] += -accelerations.walk;
        this.currentVelocity[2] = Math.max(this.currentVelocity[2], -velocities.maxWalk);
    } else if (this.controlState.forward > 0) {
        this.currentVelocity[2] = -velocities.maxWalk * this.controlState.forward;
    } else if (this.controlState.backward == 1) {
        this.currentVelocity[2] += accelerations.walk;
        this.currentVelocity[2] = Math.min(this.currentVelocity[2], velocities.maxWalk);
    } else if (this.controlState.backward > 0) {
        this.currentVelocity[2] = velocities.maxWalk * this.controlState.backward;
    } else {
        // Slowdown
        if (this.currentVelocity[2] > 0) {
            this.currentVelocity[2] -= accelerations.slowdown;
            if (this.currentVelocity[2] < 0) {
                this.currentVelocity[2] = 0.00;
            }
        } else if (this.currentVelocity[2] < 0) {
            this.currentVelocity[2] += accelerations.slowdown;
            if (this.currentVelocity[2] > 0) {
                this.currentVelocity[2] = 0.00;
            }
        }
    }
    if (this.controlState.left == 1) {
        // keyboard, accelerate gradually
        this.currentVelocity[0] += -accelerations.walk;
        this.currentVelocity[0] = Math.max(this.currentVelocity[0], -velocities.maxWalk);
    } else if (this.controlState.left > 0) {
        // gamepad, no acceleration, use stick percentage
        this.currentVelocity[0] = -velocities.maxWalk * this.controlState.left;
    } else if (this.controlState.right == 1) {
        this.currentVelocity[0] += accelerations.walk;
        this.currentVelocity[0] = Math.min(this.currentVelocity[0], velocities.maxWalk);
    } else if (this.controlState.right > 0) {
        this.currentVelocity[0] = velocities.maxWalk * this.controlState.right;
    } else {
        // Slowdown
        if (this.currentVelocity[0] > 0) {
            this.currentVelocity[0] -= accelerations.slowdown;
            if (this.currentVelocity[0] < 0) {
                this.currentVelocity[0] = 0.00;
            }
        } else if (this.currentVelocity[0] < 0) {
            this.currentVelocity[0] += accelerations.slowdown;
            if (this.currentVelocity[0] > 0) {
                this.currentVelocity[0] = 0.00;
            }
        }
    }
    
    // flying and jumping should fall slowly
    if (this.controlState.jump && this.currentVelocity[1] == 0) {
        // only allow jumping if we're on the ground
        slowFall = true;
        this.currentVelocity[1] = velocities.jump;
    } else if (this.controlState.fly) {
        slowFall = true;
        // dont exceed maximum upward velocity
        this.currentVelocity[1] += accelerations.fly;
        if (this.currentVelocity[1] > 0) {
            this.currentVelocity[1] = Math.min(this.currentVelocity[1], velocities.maxFly);
        }
    } else {
        if (slowFall &&this.currentVelocity[1] < 0) {
            this.currentVelocity[1] += accelerations.partialGravity;
        } else {
            this.currentVelocity[1] += accelerations.gravity;
        }
    }
    this.handleCollision(this.currentVelocity);
};

Physics.prototype.handleCollision = function(movementVector) {
    var self = this;
    var currentPosition = this.movable.getPosition();
    var testPosition = vec3.create();
    var direction = vec3.create();
    var direction2 = vec3.create();
    var hit = vec3.create();
    var normals = vec3.create();

    var boundsMap = {
        p0: 'front',
        n0: 'back',
        p1: 'top',
        n1: 'bottom',
        p2: 'right',
        n2: 'left'
    };

    
    quat.identity(this.rotationQuat);
    quat.rotateY(this.rotationQuat, this.rotationQuat, self.movable.getYaw());
    vec3.transformQuat(direction, movementVector, this.rotationQuat);


    // Try to step up, but only if we're on the ground
    if (this.controlState.forward && this.previousVelocity[1] == 0.00) {
        vec3.copy(testPosition, currentPosition);
        testPosition[1] += 0.8;
        var collision = raycast(self.game, testPosition, direction, 0.5, hit, normals);
        
        testPosition[1] += 0.2;

        if (
            collision
            &&
            self.game.getBlock(testPosition[0], testPosition[1], testPosition[2]) == 0
        ) {
            currentPosition[1] += 1.2;

            this.movable.updateBounds(currentPosition);
            vec3.copy(direction2, direction);

            // Did we have any significant collisions? If so, roll back the Y-axis change
            if (this.haggle(this.movable.bounds.all, currentPosition, direction2)) {
                currentPosition[1] -= 1.2;
            } else {
                vec3.copy(this.previousVelocity, direction2);
                self.movable.translate(direction2);
                return;
            }
        }
    }

    this.movable.updateBounds(currentPosition);
    this.haggle(this.movable.bounds.all, currentPosition, direction);
    vec3.copy(this.previousVelocity, direction);
    self.movable.translate(direction);
};

// Haggle for a stable, non-colliding position
// Result of this is that direction vec3 gets adjusted in the process
Physics.prototype.haggle = function(bounds, start, direction) {
    var self = this;
    var collided = false;
    var len = vec3.length(direction);
    var hit = vec3.create();
    var normals = vec3.create();

    for (var i = 0; i < bounds.length; i++) {
        var start = bounds[i];
        var adjusted = false;

        // If we've already adjusted the direction to 0 (like when we're up against a wall), skip further dection
        if (len == 0) {
            break;
        }
        var collision = raycast(self.game, start, direction, len, hit, normals);

        // Back off direction up to collision point along collision surface normals
        for (var axis = 0; axis < 3; axis++) {
            if (normals[axis] < 0.00 || 0.00 < normals[axis]) {
                adjusted = true;
                // Snap to voxel boundary upon collision
                if (normals[axis] > 0) {
                    direction[axis] = Math.ceil(hit[axis] - start[axis]);
                } else {
                    direction[axis] = Math.floor(hit[axis] - start[axis]);
                }

               this.currentVelocity[axis] = 0.00;
            }
        }
        if (adjusted) {
            collided = true;
            len = vec3.length(direction);
        }
    }
    return collided;
};

module.exports = Physics;