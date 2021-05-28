import * as glm from 'gl-matrix';

// place to house commonly used matrices and vectors
let scratch = {
    identityVec3:  glm.vec3.create(),
    identityMat4: glm.mat4.create(),
    identityQuat: glm.quat.create(),

    zeroVec3: glm.vec3.fromValues(0,0,0),

// scratch mat4. can use this as the destination for calulations
    mat4: glm.mat4.create(),
    mat4_0: glm.mat4.create(),
    mat4_1: glm.mat4.create(),

    quat: glm.quat.create(),
    quat_0: glm.quat.create(),

    vec3: glm.vec3.create(),
    vec3_0: glm.vec3.create(),
    vec3_1: glm.vec3.create(),
    vec3_2: glm.vec3.create(),

    f64vec3_0: new Float64Array(3),
    f64vec3_1: new Float64Array(3),
    f64vec3_2: new Float64Array(3),
    f32vec3_0: new Float32Array(3),
    f32vec3_1: new Float32Array(3),
    f32ved3_2: new Float32Array(3),
    i32vec3_0: new Int32Array(3),
    i32vec3_1: new Int32Array(3),
    i32vec3_2: new Int32Array(3),

    vec4: glm.vec4.create()
};

export default scratch;
