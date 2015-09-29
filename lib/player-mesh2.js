var glm = require('gl-matrix'), vec3 = glm.vec3, vec4 = glm.vec4, mat4 = glm.mat4;

var shapes = require('./shapes');

var rotate = mat4.create();

var translate = mat4.create();

var scale = mat4.create();

//mat4.rotateZ(rotate, rotate, Math.PI/2)
mat4.rotateY(rotate, rotate, Math.PI / 2);

mat4.scale(scale, scale, [ 2, 2, 2 ]);

var triangle = shapes.triangle([ 0, 0, 0 ]);

//mat4.scale(scale, scale, [0.5, 0.5, 0.5])
module.exports = {
    // adjustment matrices
    rotate: rotate,
    translate: translate,
    scale: scale,
    vertices: triangle.vertices,
    faces: triangle.faces
};