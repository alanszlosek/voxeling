import { mat4, vec3 } from 'gl-matrix';

// Return points for WebGL use
let shapes = {
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
        },
        unitTriangle: function() {
            var points = [
                // Back face
                0, 0, 0,
                1, 0, 0,
                1, 1, 0,

                0, 1, 0,
                0, 0, 0,
                0, 1, 0
            ];
            var texcoord = [
                // Back face
                0, 0,
                1, 0,
                1, 1, 
                0, 0,
                1, 0,
                1, 1
            ];
            var normals = [
                0, 0, -1,
                0, 0, -1,
                0, 0, -1,
                0, 0, 1,
                0, 0, 1,
                0, 0, 1
            ];

            return {
                vertices: new Float32Array(points),
                texcoords: texcoord,
                normals: new Float32Array(normals),
                view: mat4.create(),
                rotation: vec3.fromValues(0, 0, 0),
                rotateAround: vec3.fromValues(0, 0, 0),
                render: function(dt) {}
            };
        }
    },
    three: {
        multiple: function(sizes, positions, uvCoordinates) {
            var boxes;
        },
        // Being able to pass divideBy helps us specify whole number values,
        // especially with UV maps
        // Idea taken from avatar module
        rectangle: function(width, height, depth, uvCoordinates, divideBy) {
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
                normals: new Float32Array(normals),
                view: mat4.create(),
                rotation: vec3.fromValues(0, 0, 0),
                rotateAround: vec3.fromValues(0, 0, 0),
                render: function(dt) {}
            };
        },
        rectangle2: function(low, width, height, depth, textureX, textureY) {
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


        },

        rectangle3: function(width, height, depth, uv) {
            var w = width / 2;
            var h = height / 2;
            var d = depth / 2;
            let centerPosition = [0,0,0];

            let x1 = centerPosition[0] - w;
            let x2 = centerPosition[0] + w;
            let y1 = centerPosition[1] - h;
            let y2 = centerPosition[1] + h;
            let z1 = centerPosition[2] - d;
            let z2 = centerPosition[2] + d;

            var points = [
                // Back face
                x2, y1, z1,
                x1, y1, z1,
                x1, y2, z1,
                x2, y1, z1,
                x1, y2, z1,
                x2, y2, z1,

                // Front face
                x1, y1, z2,
                x2, y1, z2,
                x2, y2, z2,
                x1, y1, z2,
                x2, y2, z2,
                x1, y2, z2,
                

                 // Top
                x1, y2, z2,
                x2, y2, z2,
                x2, y2, z1,
                x1, y2, z2,
                x2, y2, z1,
                x1, y2, z1,
                

                // Bottom
                x1, y1, z1,
                x2, y1, z1,
                x2, y1, z2,
                x1, y1, z1,
                x2, y1, z2,
                x1, y1, z2,

                // Left
                x1, y1, z1,
                x1, y1, z2,
                x1, y2, z2,
                x1, y1, z1,
                x1, y2, z2,
                x1, y2, z1,
                

                // Right
                x2, y1, z2,
                x2, y1, z1,
                x2, y2, z1,
                x2, y1, z2,
                x2, y2, z1,
                x2, y2, z2,
            ];


            let u1 = uv[0];
            let u2 = uv[2];
            let v1 = uv[1];
            let v2 = uv[3];
            var texcoord = new Float32Array(72);
            texcoord.set([u1,v1, u2,v1, u2,v2, u1,v1, u2,v2, u1,v2], 0);
            // Now duplicate for 5 other faces
            texcoord.copyWithin(12, 0, 12);
            texcoord.copyWithin(24, 0, 12);
            texcoord.copyWithin(36, 0, 12);
            texcoord.copyWithin(48, 0, 12);
            texcoord.copyWithin(60, 0, 12);

            var normals = [
                // back
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                0.0,  0.0, -1.0,
                // front
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                0.0,  0.0,  1.0,
                // top
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                0.0,  1.0,  0.0,
                // bottom
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                0.0, -1.0,  0.0,
                // left
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                -1.0,  0.0,  0.0,
                // right
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0,
                1.0,  0.0,  0.0
            ];

            return {
                vertices: new Float32Array(points),
                texcoords: texcoord,
                normals: new Float32Array(normals)
            };
        }
    }
};

export default shapes;
