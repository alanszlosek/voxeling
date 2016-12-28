var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var scratch = require('./scratch');

// Only contains the stuff we need for WebGL drawing

var Model = function(gl, shader, meshes, tick) {
    this.gl = gl;
    this.shader = shader;
    this.meshes = meshes;
    this._tick = tick || null;

    this.localMatrix = mat4.create();
    this.worldMatrix = mat4.create();

    this.initMeshes();

};
Model.prototype.initMeshes = function() {
    var gl = this.gl;
    var meshes = this.meshes;

    // This needs to work for all types and sizes of meshes

    for (var i = 0; i < meshes.length; i++) {
        var mesh = meshes[i];
        mesh.buffers = {
            vertices: gl.createBuffer(),
            //indices: gl.createBuffer(),
            normal: gl.createBuffer(),
            texcoord: gl.createBuffer()
        };

        // Fill with points that we'll translate per player
        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.vertices);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
        //gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.normal);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normals), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.texcoord);
        gl.bufferData(gl.ARRAY_BUFFER, mesh.texcoords, gl.STATIC_DRAW);

        mesh.tuples = 36;
    }
};

Model.prototype.setTexture = function(texture) {
    this.texture = texture;
};

Model.prototype.tick = function(parentWorldMatrix) {
    if (this._tick) {
        this._tick();
    }

    // Flip the order here?
    //mat4.multiply(this.worldMatrix, this.localMatrix, parentWorldMatrix);
    mat4.multiply(this.worldMatrix, parentWorldMatrix, this.localMatrix);
};

/*
Buffer attributes will likely just be:
{
    thickness: 1,
    points: []
}
*/
var tempQuat = scratch.quat;
var directionalLightVector = vec3.fromValues(0.85, 0.8, 0.75);
var tempVector = scratch.vec3;
var rotation1 = scratch.mat4_0;
var rotation2 = scratch.mat4_1;

Model.prototype.render = function(ts) {
    var gl = this.gl;
    //gl.clear(gl.COLOR_BUFFER_BIT);
    //gl.useProgram(this.shader.program);
    //gl.lineWidth(3);

    var meshes = this.meshes;

    // rotate light source
    /*
    quat.rotateY(tempQuat, scratch.identityQuat, this.movable.getYaw());
    vec3.transformQuat(tempVector, directionalLightVector, tempQuat);
    gl.uniform3fv(this.shader.uniforms.directionalLightVector, tempVector);
    */

    gl.uniformMatrix4fv(this.shader.uniforms.view, false, this.worldMatrix);

    for (var i = 0; i < meshes.length; i++) {
        var mesh = meshes[i];

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, mesh.texture.glTexture);
        // bind the texture to this handle
        gl.uniform1i(this.shader.uniforms.texture, 0);

        //gl.uniform1i(this.shaderUniforms.part, false, mesh.part);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.vertices);
        gl.enableVertexAttribArray(this.shader.attributes.position);
        gl.vertexAttribPointer(this.shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.normal);
        gl.enableVertexAttribArray(this.shader.attributes.normal);
        gl.vertexAttribPointer(this.shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffers.texcoord);
        gl.enableVertexAttribArray(this.shader.attributes.texcoord);
        gl.vertexAttribPointer(this.shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

        //gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.buffers.indices);
        //gl.drawElements(gl.TRIANGLES, mesh.tuples, gl.UNSIGNED_SHORT, 0);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.tuples);

    }
};

module.exports = Model;
