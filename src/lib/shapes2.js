var glm = require('gl-matrix'),
    mat4 = glm.mat4,
    vec3 = glm.vec3;
// NOTE: clean up indentation. uglify-js does lots of compressing.

// Return points for WebGL use
var shapes = module.exports = {
    wire: {
        triangle: function() {},
        cube: function(fromPoint, toPoint) {
            var dims = [
              toPoint[0] - fromPoint[0],
              toPoint[1] - fromPoint[1],
              toPoint[2] - fromPoint[2]
            ];
            // 
            var points = new Float32Array([
                // lower face's outline
                fromPoint[0], fromPoint[1], fromPoint[2],
                fromPoint[0] + dims[0], fromPoint[1], fromPoint[2],

                fromPoint[0] + dims[0], fromPoint[1], fromPoint[2],
                fromPoint[0] + dims[0], fromPoint[1] + dims[1], fromPoint[2],

                fromPoint[0] + dims[0], fromPoint[1] + dims[1], fromPoint[2],
                fromPoint[0], fromPoint[1] + dims[1], fromPoint[2],

                fromPoint[0], fromPoint[1] + dims[1], fromPoint[2],
                fromPoint[0], fromPoint[1], fromPoint[2],

                // higher face's outine
                toPoint[0], toPoint[1], toPoint[2],
                toPoint[0] - dims[0], toPoint[1], toPoint[2],

                toPoint[0] - dims[0], toPoint[1], toPoint[2],
                toPoint[0] - dims[0], toPoint[1] - dims[1], toPoint[2],

                toPoint[0] - dims[0], toPoint[1] - dims[1], toPoint[2],
                toPoint[0], toPoint[1] - dims[1], toPoint[2],

                toPoint[0], toPoint[1] - dims[1], toPoint[2],
                toPoint[0], toPoint[1], toPoint[2],

                // connectors
                fromPoint[0], fromPoint[1], fromPoint[2],
                toPoint[0] - dims[0], toPoint[1] - dims[1], toPoint[2],

                fromPoint[0] + dims[0], fromPoint[1], fromPoint[2],
                toPoint[0], toPoint[1] - dims[1], toPoint[2],

                fromPoint[0] + dims[0], fromPoint[1] + dims[1], fromPoint[2],
                toPoint[0], toPoint[1], toPoint[2],

                fromPoint[0], fromPoint[1] + dims[1], fromPoint[2],
                toPoint[0] - dims[0], toPoint[1], toPoint[2]
            ]);
            return points;
        },
        mesh: function(fromPoint, width, depth) {
            var points = [];
            var w = width - 1;
            var d = depth - 1;
            for (var i = 1; i < w; i++) {
                points.push(fromPoint[0] + i, fromPoint[1], fromPoint[2]);
                points.push(fromPoint[0] + i, fromPoint[1], fromPoint[2] + depth);
            }
            for (var j = 1; j < d; j++) {
                points.push(fromPoint[0], fromPoint[1], fromPoint[2] + j);
                points.push(fromPoint[0] + width, fromPoint[1], fromPoint[2] + j);
            }
            return new Float32Array(points);
        }
    },
    // A flat triangle
    triangle: function(offset) {
        var points = [ 0, 0, 0, 1, 0, 0, 1, 1, 0 ];
        for (var i = 0; i < points.length; i += 3) {
            points[i] += offset[0];
            points[i + 1] += offset[1];
            points[i + 2] += offset[2];
        }
        return {
            vertices: points,
            faces: [ 0, 1, 2 ],
            texcoord: [ 0, 0, 1, 0, 1, 1 ]
        };
    },
    // A flat square - two triangles
    square: function(offset) {
        var points = [
            0, 0, 0,
            0, 1, 0,
            1, 1, 0,
            1, 0, 0
        ];
        for (var i = 0; i < points.length; i += 3) {
            points[i] += offset[0];
            points[i + 1] += offset[1];
            points[i + 2] += offset[2];
        }
        return {
            vertices: points,
            faces: [
                0, 3, 2,
                0, 2, 1
            ],
            texcoord: [ 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0 ]
        };
    },
    two: {
        // start coordinates and end coordinates
        rectangle: function(start, end) {
            var points = [];
            /*
                0, 0, 0,
                0, 1, 0,
                2, 1, 0,
                0, 0, 0,
                2, 1, 0,
                2, 0, 0
            ];
            */

            /*
            Damn, thought I could bake proper rotation into this, with simple addition.
            Not going to work.
            */

            // hmm, it's easy to think about this in 2 dimensions, but hard in 3
            // easy to choose whether to pull from start or end in 2 dims, but hard in 3
            points.push(start[0], start[1], start[2]);
            points.push(end[0], start[1], end[2]);
            points.push(end[0], end[1], end[2]);

            points.push(start[0], start[1], start[2]);
            points.push(end[0], end[1], end[2]);
            points.push(start[0], end[1], end[2]);

            return {
                position: points,
                texcoord: null,
                normals: null
            };
        }
    },
    three: {
        // Being able to pass divideBy helps us specify whole number values,
        // especially with UV maps
        // Idea taken from avatar module
        rectangle: function(width, height, depth, uvCoordinates, divideBy, texture) {
            var w = width / 2;
            var h = height / 2;
            var d = depth / 2;
            divideBy = divideBy || 1;

            var points = [
                // Back face
                -w, -h,  d,
                 w, -h,  d,
                 w,  h,  d,

                -w, -h,  d,
                 w,  h,  d,
                -w,  h,  d,

                // Front face
                 w, -h, -d,
                -w, -h, -d,
                -w,  h, -d,

                 w, -h, -d,
                -w,  h, -d,
                 w,  h, -d,

                 // Top
                -w,  h,  d,
                 w,  h,  d,
                 w,  h, -d,

                -w,  h,  d,
                 w,  h, -d,
                -w,  h, -d,

                // Bottom
                -w, -h, -d,
                 w, -h, -d,
                 w, -h,  d,

                -w, -h, -d,
                 w, -h,  d,
                -w, -h,  d,

                // Left
                -w, -h, -d,
                -w, -h,  d,
                -w,  h,  d,

                -w, -h, -d,
                -w,  h,  d,
                -w,  h, -d,

                // Right
                 w, -h,  d,
                 w, -h, -d,
                 w,  h, -d,

                 w, -h,  d,
                 w,  h, -d,
                 w,  h,  d

            ];

            /*
            var indices = new Uint16Array([
                // TODO: FIX THESE FOR PROPER ROTATION
                // Back
                0, 1, 2,
                0, 2, 3,
                // Front
                5, 4, 7,
                5, 7, 6,
                // Top
                3, 2, 6,
                3, 6, 7,
                // Bottom
                4, 5, 1,
                4, 1, 0,
                // Left
                4, 0, 3,
                4, 3, 7,
                // Right
                1, 5, 6,
                1, 6, 2
            ]);
            */

            var texcoord = new Float32Array((points.length / 3) * 2);
            var j = 0;
            for (var i = 0; i < uvCoordinates.length; i += 4) {
                var x = uvCoordinates[i] / divideBy;
                var y = uvCoordinates[i + 1] / divideBy;
                var x2 = x + (uvCoordinates[i + 2] / divideBy);
                var y2 = y + (uvCoordinates[i + 3] / divideBy);

                texcoord[j] = x
                texcoord[j + 1] = y;

                texcoord[j + 2] = x2;
                texcoord[j + 3] = y;

                texcoord[j + 4] = x2;
                texcoord[j + 5] = y2;


                texcoord[j + 6] = x;
                texcoord[j + 7] = y;

                texcoord[j + 8] = x2;
                texcoord[j + 9] = y2;

                texcoord[j + 10] = x;
                texcoord[j + 11] = y2;

                j += 12;
            }


            var normals = [];
            // back
            normals.push(
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0
            );
            // front
            normals.push(
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0
            );
            //top
            normals.push(
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0
            );
            // bottom
            normals.push(
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0
            );
            // left
            normals.push(
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0
            );
            // right
            normals.push(
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0
            );

            return {
                vertices: new Float32Array(points),
                //indices: indices,
                //faces: faces,
                texcoords: texcoord,
                normals: normals,
                texture: texture
            };
        }
    }
};