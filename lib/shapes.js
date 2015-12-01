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
                texcoord: null
            };
        }
    },
    three: {
        rectangle: function(low, width, height, depth, textureX, textureY) {
            var points = [];
            var normals = [];
            var texcoord = [];

            var startX = low[0];
            var startY = low[1];
            var startZ = low[2];

            textureX = textureX || 0;
            textureY = textureY || 0;

            // COUNTER CLOCKWISE
            // back of character
            points.push(
                startX, startY, startZ + depth, // A
                startX + width, startY, startZ + depth, // B
                startX + width, startY + height, startZ + depth, // C

                startX, startY, startZ + depth, // A
                startX + width, startY + height, startZ + depth, // C
                startX, startY + height, startZ + depth
            );
            normals.push(
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0
            );
            texcoord.push(
                textureX, textureY,
                textureX + width, textureY,
                textureX + width, textureY + height,

                textureX, textureY,
                textureX + width, textureY + height,
                textureX, textureY + height
            );

            // front
            points.push(
                startX + width, startY, startZ, // A
                startX, startY, startZ, // B
                startX, startY + height, startZ, // C

                startX + width, startY, startZ, // A
                startX, startY + height, startZ, // C
                startX + width, startY + height, startZ // D
            );
            normals.push(
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0
            );
            texcoord.push(
                textureX, textureY,
                textureX + width, textureY,
                textureX + width, textureY + height,

                textureX, textureY,
                textureX + width, textureY + height,
                textureX, textureY + height
            );

            // left
            points.push(
                startX, startY, startZ, // A
                startX, startY, startZ + depth, // B
                startX, startY + height, startZ + depth, // C

                startX, startY, startZ, // A
                startX, startY + height, startZ + depth, // C
                startX, startY + height, startZ
            );
            normals.push(
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0
            );
            texcoord.push(
                textureX, textureY,
                textureX + depth, textureY,
                textureX + depth, textureY + height,

                textureX, textureY,
                textureX + depth, textureY + height,
                textureX, textureY + height
            );

            // right
            points.push(
                startX + width, startY, startZ + depth, // A
                startX + width, startY, startZ, // B
                startX + width, startY + height, startZ, // C

                startX + width, startY, startZ + depth, // A
                startX + width, startY + height, startZ, // C
                startX + width, startY + height, startZ + depth
            );
            normals.push(
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0
            );
            texcoord.push(
                textureX, textureY,
                textureX + depth, textureY,
                textureX + depth, textureY + height,

                textureX, textureY,
                textureX + depth, textureY + height,
                textureX, textureY + height
            );

            //top
            points.push(
                startX, startY + height, startZ + depth, // A
                startX + width, startY + height, startZ + depth, // B
                startX + width, startY + height, startZ, // C

                startX, startY + height, startZ + depth, // A
                startX + width, startY + height, startZ, // C
                startX, startY + height, startZ
            );
            normals.push(
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0
            );
            texcoord.push(
                textureX, textureY,
                textureX + width, textureY,
                textureX + width, textureY + depth,

                textureX, textureY,
                textureX + width, textureY + depth,
                textureX, textureY + depth
            );

            // bottom
            points.push(
                startX, startY, startZ, // A
                startX + width, startY, startZ, // B
                startX + width, startY, startZ + depth, // C

                startX, startY, startZ, // A
                startX + width, startY, startZ + depth, // C
                startX, startY, startZ + depth
            );
            normals.push(
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0
            );
            texcoord.push(
                textureX, textureY,
                textureX + width, textureY,
                textureX + width, textureY + depth,

                textureX, textureY,
                textureX + width, textureY + depth,
                textureX, textureY + depth
            );

            /*
            var faces = [];
            var to = points.length/3;
            for (var i = 0; i < to; i++) {
                faces.push(i);
            }
            */

            return {
                vertices: points,
                //faces: faces,
                texcoords: texcoord,
                normals: normals,
                rotation: [1, 1, 1],
                scale: 1.0
            }


        }
    }
};