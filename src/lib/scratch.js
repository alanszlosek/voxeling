var glm = require('gl-matrix');

// place to house commonly used matrices and vectors
module.exports = {
    identityVec3: glm.vec3.create(),
    identityMat4: glm.mat4.create(),
    identityQuat: glm.quat.create(),

    // scratch mat4. can use this as the destination for calulations
    mat4: glm.mat4.create(),
    mat4_0: glm.mat4.create(),
    mat4_1: glm.mat4.create(),
    
    quat: glm.quat.create(),
    quat_0: glm.quat.create(),

    vec3: glm.vec3.create(),
    vec3_0: glm.vec3.create()

};