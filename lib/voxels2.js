/*
WebGL stuff that pertains only to voxels

NEW PLAN

- keep a pool of buffer bundles
- when a chunk changes, remove it from the current bundle, appending it to the end of another bundle that hasn't reached the max yet
    - not yet sure what the max should be
- for each bundle
    - chunkIds contained within
    - offset
    - length
    - texture values
        - offset
        - length


BENCHMARKS

old voxels.js render()
max: 9ms
count: 2970 render() calls
average: 2.9ms

new voxels2.js render()
max: 6ms
count: 2975 render() calls
average: 1.8ms
*/
var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;
var scratch = require('./scratch');
var timer = require('./timer');


function Voxels(gl, shader, textures) {
    var self = this;
    this.gl = gl;
    this.shader = shader;
    this.textures = textures;

    this.buffersByChunk = {};
    // Master list of all buffers
    this.buffers = [];

    /*
    setInterval(function() {
        console.log('buffers', self.buffers.length);
    }, 1000);
    */
};

Voxels.prototype.getBufferBundle = function() {
    var gl = this.gl;
    var obj;
    // Enough space to hold 10 chunks' worth of tuples
    /*
    - Worst case is a voxel every-other spot (16 x 16 x 16)
    - Six points per side
    - six sides

    For normals and positions
    - 3 float32s per point (4 bytes per float32)

    For texcoords
    - 2 float32s per point

    = roughly 1.8MB buffer for a single chunk

    = roughly 10MB for up to 6 chunks
    */
    var one = 16 * 16 * 16 * 6 * 6;
    var chunks = 6;
    var tuples = one * chunks;

    for (var i = 0; i < this.buffers.length; i++) {
        var buffer = this.buffers[i];
        if (buffer.tuples < one * (chunks - 1)) {
            obj = buffer;
            break;
        }
    }

    if (!obj) {
        /*
        Need to know:

        * where chunk is in buffer, and how many tuples
        */
        obj = {
            chunks: {},
            position: gl.createBuffer(),
            texcoord: gl.createBuffer(),
            normal: gl.createBuffer(),
            // How many tuples this buffer has currently
            tuples: 0
        };

        // Think we need to multiple size by 4 since we're dealing with Float32 values
        // Some of our Growables were re-allocated to 4096, so let's try 4096 for a chunk, and assume we'd like to store 10 chunks worth
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.position);
        gl.bufferData(gl.ARRAY_BUFFER, tuples * 3 * 4, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.texcoord);
        gl.bufferData(gl.ARRAY_BUFFER, tuples * 2 * 4, gl.DYNAMIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.normal);
        gl.bufferData(gl.ARRAY_BUFFER, tuples * 3 * 4, gl.DYNAMIC_DRAW);

        this.buffers.push(obj);
    }
    return obj;
};

Voxels.prototype.addVoxelMesh = function(id, mesh) {
    var start = Date.now();
    var gl = this.gl;
    var obj;
    var textures = {};

    if (id in this.buffersByChunk) {
        // Remove chunk from bundle
        delete this.buffersByChunk[id].chunks[id];
    }

    obj = this.getBufferBundle();

    for (var textureValue in mesh) {
        var attributes = mesh[textureValue];

        var positions = new Float32Array(attributes.position.buffer, 0, attributes.position.offset);
        var texcoords = new Float32Array(attributes.texcoord.buffer, 0, attributes.texcoord.offset);
        var normals = new Float32Array(attributes.normal.buffer, 0, attributes.normal.offset);

        var tuples = attributes.position.offset / 3;

        // Fill buffers
        gl.bindBuffer(gl.ARRAY_BUFFER, obj.position);
        gl.bufferSubData(gl.ARRAY_BUFFER, obj.tuples * 3 * 4, positions);

        gl.bindBuffer(gl.ARRAY_BUFFER, obj.normal);
        gl.bufferSubData(gl.ARRAY_BUFFER, obj.tuples * 3 * 4, normals);

        gl.bindBuffer(gl.ARRAY_BUFFER, obj.texcoord);
        gl.bufferSubData(gl.ARRAY_BUFFER, obj.tuples * 2 * 4, texcoords);

        textures[textureValue] = {
            offset: obj.tuples,
            tuples: tuples
        };
        obj.tuples += tuples;
    }
    obj.chunks[id] = textures;

    this.buffersByChunk[id] = obj;

    timer.log('Voxels.addVoxelMesh', Date.now() - start);
};

Voxels.prototype.removeChunkMesh = function(chunkId) {
    if (chunkId in this.buffersByChunk) {
        var buffer = this.buffersByChunk[chunkId];
        delete buffer.chunks[chunkId];

        if (Object.keys(buffer.chunks).length == 0) {
            // Remove from full buffers, if there, add to lowBuffers
            buffer.tuples = 0;
        }
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

    for (var i = 0; i < this.buffers.length; i++) {
        var bufferBundle = this.buffers[i];

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
        gl.enableVertexAttribArray(this.shader.attributes.position);
        gl.vertexAttribPointer(this.shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
        gl.enableVertexAttribArray(this.shader.attributes.texcoord);
        gl.vertexAttribPointer(this.shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.normal);
        gl.enableVertexAttribArray(this.shader.attributes.normal);
        gl.vertexAttribPointer(this.shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);

        for (var chunkId in bufferBundle.chunks) {
            var chunk;

            // frustum culling: skip chunks that aren't within our view
            if (!frustum.visible(chunkId)) {
                continue;
            }

            chunk = bufferBundle.chunks[chunkId]

            for (var textureValue in chunk) {
                var textureInfo = chunk[textureValue];
                var offset = textureInfo.offset;
                var tuples = textureInfo.tuples;

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
            }
            chunksDrawn++;
        }
    }

    timer.log('Voxels.render', Date.now() - start);
};

/*
setInterval(
    function() {
        console.log('Chunks drawn', chunksDrawn);
    },
    2000
);
*/

module.exports = Voxels;
