/*
WebGL stuff that pertains only to voxels
*/
var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var scratch = require('./scratch');
var timer = require('./timer');

function Voxels(gl, shader, textures) {
    this.gl = gl;
	this.shader = shader;
    this.textures = textures;
    // new buffers
    this.buffersByChunk = {};
};

Voxels.prototype.addVoxelMesh = function(id, mesh) {
    var start = Date.now();
    var gl = this.gl;
    var obj = {
        position: gl.createBuffer(),
        texcoord: gl.createBuffer(),
        normal: gl.createBuffer(),
        textures: [],
        tuples: []
    };
    var lengths = {
        position: 0,
        texcoord: 0,
        normal: 0
    };
    var offsets = {
        position: 0,
        texcoord: 0,
        normal: 0
    };

    for (var textureValue in mesh) {
        var attributes = mesh[textureValue];
        lengths.position += attributes.position.offset;
        lengths.texcoord += attributes.texcoord.offset;
        lengths.normal += attributes.normal.offset;
    }

    if (lengths.position == 0) {
        // Empty chunk
        return;
    }

    // allocate necessary space
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.position);
    gl.bufferData(gl.ARRAY_BUFFER, lengths.position * 4, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.texcoord);
    gl.bufferData(gl.ARRAY_BUFFER, lengths.texcoord * 4, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, obj.normal);
    gl.bufferData(gl.ARRAY_BUFFER, lengths.normal * 4, gl.STATIC_DRAW);

    for (var textureValue in mesh) {
        var attributes = mesh[textureValue];

        var positions = new Float32Array(attributes.position.buffer, 0, attributes.position.offset);
        var texcoords = new Float32Array(attributes.texcoord.buffer, 0, attributes.texcoord.offset);
        var normals = new Float32Array(attributes.normal.buffer, 0, attributes.normal.offset);

        // Fill buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.position);
        gl.bufferSubData(gl.ARRAY_BUFFER, offsets.position, positions);
        // yes, array will be larger than offset, but we don't care
        offsets.position += attributes.position.offset * 4;

        gl.bindBuffer(gl.ARRAY_BUFFER, obj.normal);
        gl.bufferSubData(gl.ARRAY_BUFFER, offsets.normal, normals);
        offsets.normal += attributes.normal.offset * 4;

        gl.bindBuffer(gl.ARRAY_BUFFER, obj.texcoord);
        gl.bufferSubData(gl.ARRAY_BUFFER, offsets.texcoord, texcoords);
        offsets.texcoord += attributes.texcoord.offset * 4;

        obj.textures.push(textureValue);
        obj.tuples.push(attributes.position.offset / 3);
    }
    this.buffersByChunk[id] = obj;
    timer.log('Voxels.addVoxelMesh', Date.now() - start);
};

Voxels.prototype.removeChunkMesh = function(chunkID) {
    var obj;
    if (chunkID in this.buffersByChunk) {
        obj = this.buffersByChunk[chunkID];
        this.gl.deleteBuffer(obj.position);
        this.gl.deleteBuffer(obj.texcoord);
        this.gl.deleteBuffer(obj.normal);
        delete this.buffersByChunk[chunkID];
    }
};


var chunksDrawn = 0;
Voxels.prototype.render = function(projection, ts, frustum, ambientLight, directionalLight) {
    var start = Date.now();
    var gl = this.gl;

    gl.useProgram(this.shader.program);
    gl.uniformMatrix4fv(this.shader.uniforms.projection, false, projection);
    gl.uniform3fv(this.shader.uniforms.ambientLightColor, ambientLight);
    gl.uniform3fv(this.shader.uniforms.directionalLightColor, directionalLight.color);
    gl.uniform3fv(this.shader.uniforms.directionalLightPosition, directionalLight.position);

    // so we can put a number on the benefit of frustum culling
    chunksDrawn = 0;

    for (var chunkID in this.buffersByChunk) {
        var bufferBundle = this.buffersByChunk[chunkID];

        // frustum culling: skip chunks that aren't within our view
        if (!frustum.visible(chunkID)) {
            continue;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
        gl.enableVertexAttribArray(this.shader.attributes.position);
        gl.vertexAttribPointer(this.shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
        gl.enableVertexAttribArray(this.shader.attributes.texcoord);
        gl.vertexAttribPointer(this.shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.normal);
        gl.enableVertexAttribArray(this.shader.attributes.normal);
        gl.vertexAttribPointer(this.shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);

        var offset = 0;
        for (var i = 0; i < bufferBundle.textures.length; i++) {
            var textureValue = bufferBundle.textures[i];
            var tuples = bufferBundle.tuples[i];

            if (textureValue == 6) {
                // poor man's water animation
                gl.uniform1f(this.shader.uniforms.textureOffset, ts / 10000);

            } else if (textureValue < 100) {
                // Don't do face culling when drawing textures with opacity
                gl.enable(gl.CULL_FACE);
                gl.uniform1f(this.shader.uniforms.textureOffset, 0.00);
                
            } else {
                gl.disable(gl.CULL_FACE);
                gl.uniform1f(this.shader.uniforms.textureOffset, 0.00);
                //gl.uniform1f(this.shaderUniforms.textureOffset, ts / 10000);
            }
            // do the texture stuff ourselves ... too convoluted otherwise
            gl.activeTexture(gl.TEXTURE0);

            // set which of the 32 handles we want this bound to
            gl.bindTexture(gl.TEXTURE_2D, this.textures.byValue[textureValue].glTexture);

            // bind the texture to this handle
            gl.uniform1i(this.shader.uniforms.texture, 0);
            gl.drawArrays(gl.TRIANGLES, offset, tuples);
            offset += tuples;
        }
        chunksDrawn++;
    }
    timer.log('Voxels.render', Date.now() - start);
};

setInterval(
    function() {
        console.log('Chunks drawn', chunksDrawn);
    },
    2000
);

module.exports = Voxels;
