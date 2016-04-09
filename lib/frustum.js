var glm = require('./gl-matrix'),
    vec3 = glm.vec3;
var lines = require('./lines');
var timer = require('./timer');

var Frustum = function(verticalFieldOfView, ratio, nearDistance, farDistance) {
    var self = this;

    this.nearHeight = Math.tan(verticalFieldOfView / 2) * nearDistance;
    this.nearWidth = this.nearHeight * ratio;

    this.farHeight = Math.tan(verticalFieldOfView / 2) * farDistance;
    this.farWidth = this.farHeight * ratio;

    console.log('near width', this.nearWidth, 'far width', this.farWidth);
    console.log('near height', this.nearHeight, 'far height', this.farHeight);

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

    /*
    this.normals = [
        // near
        vec3.create(),
        // far
        vec3.create(),
        // left
        vec3.create(),
        // top
        vec3.create(),
        // right
        vec3.create(),
        // bottom
        vec3.create()
    ];
    this.normals2 = [
        // near
        vec3.create(),
        // far
        vec3.create(),
        // left
        vec3.create(),
        // top
        vec3.create(),
        // right
        vec3.create(),
        // bottom
        vec3.create()
    ];
    var a = vec3.create();
    var b = vec3.create();
    // near
    vec3.subtract(a, this.coordinates[0], this.coordinates[1]);
    vec3.subtract(b, this.coordinates[1], this.coordinates[2]);
    vec3.cross(this.normals[0], a, b);
    // far
    vec3.subtract(a, this.coordinates[5], this.coordinates[4]);
    vec3.subtract(b, this.coordinates[4], this.coordinates[7]);
    vec3.cross(this.normals[1], a, b);
    // left
    vec3.subtract(a, this.coordinates[3], this.coordinates[0]);
    vec3.subtract(b, this.coordinates[0], this.coordinates[1]);
    vec3.cross(this.normals[2], a, b);
    // top
    vec3.subtract(a, this.coordinates[3], this.coordinates[2]);
    vec3.subtract(b, this.coordinates[2], this.coordinates[6]);
    vec3.cross(this.normals[3], a, b);
    // right
    vec3.subtract(a, this.coordinates[1], this.coordinates[5]);
    vec3.subtract(b, this.coordinates[5], this.coordinates[6]);
    vec3.cross(this.normals[4], a, b);
    // bottom
    vec3.subtract(a, this.coordinates[4], this.coordinates[5]);
    vec3.subtract(b, this.coordinates[5], this.coordinates[1]);
    vec3.cross(this.normals[5], a, b);
    */


    setInterval(
        function() {
            console.log('frustum', self.points);
        },
        5000
    );
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
    // Rotate frustum plane normals, too
    /*
    for (var i = 0; i < 6; i++) {
        vec3.transformQuat(this.normals2[i], this.normals[i], rotationQuat);
    }
    */

    timer.log("frustum.update", Date.now() - start);
};

var pointInsideAABB = function(point, low) {
    return (
        (low[0] <= point[0] && point[0] <= (low[0] + 32))
        &&
        (low[1] <= point[1] && point[1] <= (low[1] + 32))
        &&
        (low[2] <= point[2] && point[2] <= (low[2] + 32))
    );
};
var pointInsideOOB = function(point, low, high) {
    return (
        (low[0] <= point[0] && point[0] <= high[0])
        &&
        (low[1] <= point[1] && point[1] <= high[1])
        &&
        (low[2] <= point[2] && point[2] <= high[2])
    );
    /*
    ||
    (
        (low[0] <= point[0] && point[0] <= high[0])
        &&
        (low[1] <= point[1] && point[1] <= high[1])
        &&
        (low[2] <= point[2] && point[2] <= high[2])
    )
    ;
    */
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
var overlap = function(a, b) {
    return (
        (a[0] <= b[0] && b[0] <= a[1])
        ||
        (a[0] <= b[1] && b[1] <= a[1])
        ||
        (b[0] <= a[0] && a[0] <= b[1])
        ||
        (b[0] <= a[1] && a[1] <= b[1])
    );
};

var separatingAxisTheorum = function(low, points) {

    // AABB axes
    var aabbAxes = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
    ];
    var chunkProjections = [
        [low[0], low[0] + 32],
        [low[1], low[1] + 32],
        [low[2], low[2] + 32]
    ];

    for (var i = 0; i < aabbAxes.length; i++) {
        var axis = aabbAxes[i];
        var chunkProjection = chunkProjections[i];
        // Project the frustum onto the axis
        var projection = project(axis, points);
        // do the projections overlap?
        if (!overlap(chunkProjection, projection)) {
            //console.log('no overlap', low, chunkProjection, projection);
            // then we can guarantee that the shapes do not overlap
            return false;
        }
    }
    return true;
};


// Check whether chunk is within view frustum
Frustum.prototype.visible = function(chunkID) {
    var position = chunkID.split('|').map(function(value) {
        return Number(value);
    });

    if (separatingAxisTheorum(position, this.points)) {
        return true;
    }
    return false;

    for (var z = 0; z < 8; z++) {
        var point = this.points[z];
        if (pointInsideAABB(point, position)) {
            return true;
        }
    }
    return false;

};

/*
Frustum.prototype.render = function(projection) {
    this.lines.render(projection);
};
*/

module.exports = Frustum;