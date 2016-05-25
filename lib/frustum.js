var glm = require('./gl-matrix'),
    vec3 = glm.vec3;
var lines = require('./lines');
var timer = require('./timer');
var pool = require('./object-pool');

var Frustum = function(verticalFieldOfView, ratio, nearDistance, farDistance) {
    var self = this;

    this.nearHeight = Math.tan(verticalFieldOfView / 2) * nearDistance;
    this.nearWidth = this.nearHeight * ratio;

    this.farHeight = Math.tan(verticalFieldOfView / 2) * farDistance;
    this.farWidth = this.farHeight * ratio;

    this.coordinates = [
        // near bottom left
        vec3.fromValues(
            -this.nearWidth,
            -this.nearHeight,
            -nearDistance
        ),
        // near bottom right
        vec3.fromValues(
            this.nearWidth,
            -this.nearHeight,
            -nearDistance
        ),
        // near top right
        vec3.fromValues(
            this.nearWidth,
            this.nearHeight,
            -nearDistance
        ),
        // near top left
        vec3.fromValues(
            -this.nearWidth,
            this.nearHeight,
            -nearDistance
        ),

        // far bottom left
        vec3.fromValues(
            -this.farWidth,
            -this.farHeight,
            -farDistance
        ),
        // far bottom right
        vec3.fromValues(
            this.farWidth,
            -this.farHeight,
            -farDistance
        ),
        // far top right
        vec3.fromValues(
            this.farWidth,
            this.farHeight,
            -farDistance
        ),
        // far top left
        vec3.fromValues(
            -this.farWidth,
            this.farHeight,
            -farDistance
        )
    ];
    // We rotate the above this.coordinates into this.points
    this.points = [
        vec3.create(),
        vec3.create(),
        vec3.create(),
        vec3.create(),

        vec3.create(),
        vec3.create(),
        vec3.create(),
        vec3.create()
    ];

    // Cache of generated SAT projections for chunks
    this.satProjections = {};
};

Frustum.prototype.update = function(position, rotationQuat) {
    var len = 8;
    var start = Date.now();
    // Rotation frustum
    for (var i = 0; i < len; i++) {
        //vec3.add(this.points[i], this.coordinates[i], position);
        //vec3.transformQuat(this.points[i], this.points[i], rotationQuat);
        vec3.transformQuat(this.points[i], this.coordinates[i], rotationQuat);
        vec3.add(this.points[i], this.points[i], position);
    }

    timer.log("frustum.update", Date.now() - start);
};


var project = function(axis, points) {
    var min = vec3.dot(axis, points[0]);
    var max = min;
    for (var i = 1; i < points.length; i++) {
        // NOTE: the axis must be normalized to get accurate projections
        var p = vec3.dot(axis, points[i]);
        if (p < min) {
            min = p;
        } else if (p > max) {
            max = p;
        }
    }
    return [min, max];
};
var overlap = function(a, b0, b1) {
    return (
        (a[0] <= b0 && b0 <= a[1])
        ||
        (a[0] <= b1 && b1 <= a[1])
    );
};

var separatingAxisTheorum = function(chunkProjections, points) {

    // AABB axes
    var aabbAxes = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];

    for (var i = 0; i < aabbAxes.length; i++) {
        var axis = aabbAxes[i];
        var ii = i*2;
        // Project the frustum onto the axis
        var projection = project(axis, points);
        // do the projections overlap?
        if (!overlap(projection, chunkProjections[ii], chunkProjections[ii+1])) {
            //console.log('no overlap', low, chunkProjection, projection);
            // then we can guarantee that the shapes do not overlap
            return false;
        }
    }
    return true;
};


// Check whether chunk is within view frustum
Frustum.prototype.visible = function(chunkID) {
    // Calculate satProjection
    var projection;
    if (chunkID in this.satProjections) {
        projection = this.satProjections[chunkID];
    } else {
        var position = chunkID.split('|').map(function(value) {
            return Number(value);
        });
        projection = pool.malloc('array', 6);
        projection[0] = position[0];
        projection[1] = position[0] + 32;
        projection[2] = position[1];
        projection[3] = position[1] + 32;
        projection[4] = position[2];
        projection[5] = position[2] + 32;
        this.satProjections[chunkID] = projection;
    }
    

    if (separatingAxisTheorum(projection, this.points)) {
        return true;
    }
    return false;
};

Frustum.prototype.chunkVisible = function(chunkID, position) {
    // Calculate satProjection
    var projection;
    projection = pool.malloc('array', 6);
    projection[0] = position[0];
    projection[1] = position[0] + 32;
    projection[2] = position[1];
    projection[3] = position[1] + 32;
    projection[4] = position[2];
    projection[5] = position[2] + 32;
    this.satProjections[chunkID] = projection;

    if (separatingAxisTheorum(projection, this.points)) {
        return true;
    }
    return false;
};

module.exports = Frustum;