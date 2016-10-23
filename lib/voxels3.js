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
var debug = true;

function Voxels(gl, shader, textures, releaseMeshCallback) {
    var self = this;
    this.gl = gl;
	this.shader = shader;
    this.textures = textures;
    this.releaseMeshCallback = releaseMeshCallback;
    this.buffersByTexture = {};

    this.currentMeshes = {};
    this.meshPriority = [];
    this.onlyTheseMeshes = {};

    this.pending = false;

    // Prepare buffers every second?
    setInterval(
        function() {
            if (self.pending) {
                self.prepareMeshBuffers();

                self.pending = false;
            }
        },
        500
    );
};

Voxels.prototype.showMesh = function(chunkId, mesh) {
    if (chunkId in this.onlyTheseMeshes) {
        this.currentMeshes[ chunkId ] = mesh;
        this.pending = true;
    }
    if (debug) {
        console.log('Voxels.showMesh ', chunkId);
    }
    return;

    this.voxels.addVoxelMesh(chunkID, mesh);
    this.currentMeshes[ chunkID ] = mesh;
};

Voxels.prototype.meshesToShow = function(meshPriority, onlyTheseMeshes) {
    var self = this;
    this.meshPriority = meshPriority;
    this.onlyTheseMeshes = onlyTheseMeshes;

    // Remove meshes we don't need any more
    var chunkIds = Object.keys(self.currentMeshes);
    for (var i = 0; i < chunkIds.length; i++) {
        var chunkId = chunkIds[i];
        if (chunkId in onlyTheseMeshes) {
            // If it's nearby don't remove, we want it to be visible
            continue;
        }
        var mesh = self.currentMeshes[ chunkId ];

        self.releaseMeshCallback(mesh);
        delete self.currentMeshes[ chunkId ];
    }

    this.pending = true;
};


Voxels.prototype.prepareMeshBuffers = function() {
    var self = this;
    var start = Date.now();
    var gl = this.gl;


    // Tally up the bytes we need to allocate for each texture's buffer tuple
    var floatsByTexture = {};
    // Queue up texture-specific data so we can push it into GL buffers later
    var attributesByTexture = {};
    for (var chunkId in self.currentMeshes) {
        var mesh = self.currentMeshes[ chunkId ];
        for (var textureValue in mesh) {
            var attributes = mesh[textureValue];

            if (textureValue in floatsByTexture) {
                floatsByTexture[ textureValue ].position += attributes.position.offset;
                floatsByTexture[ textureValue ].texcoord += attributes.texcoord.offset,
                floatsByTexture[ textureValue ].normal += attributes.normal.offset;

                attributesByTexture[ textureValue ].push(attributes);

            } else {
                floatsByTexture[ textureValue ] = {
                    position: attributes.position.offset,
                    texcoord: attributes.texcoord.offset,
                    normal: attributes.normal.offset
                };

                attributesByTexture[ textureValue ] = [
                    attributes
                ];
            }
        }
    }

    // Create 3 GL buffers for each texture and allocate the necessary space
    var buffersByTexture = {};
    for (var textureValue in floatsByTexture) {
        var floats = floatsByTexture[ textureValue ];

        var offsets = {
            position: 0,
            texcoord: 0,
            normal: 0
        };

        var buffers = {
            position: gl.createBuffer(),
            texcoord: gl.createBuffer(),
            normal: gl.createBuffer(),
            tuples: 0
        };

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, floats.position * 4, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
        gl.bufferData(gl.ARRAY_BUFFER, floats.texcoord * 4, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
        gl.bufferData(gl.ARRAY_BUFFER, floats.normal * 4, gl.STATIC_DRAW);

        var attributeQueue = attributesByTexture[ textureValue ];
        for (var i = 0; i < attributeQueue.length; i++) {
            var attributes = attributeQueue[i];

            var positions = new Float32Array(attributes.position.buffer, 0, attributes.position.offset);
            var texcoords = new Float32Array(attributes.texcoord.buffer, 0, attributes.texcoord.offset);
            var normals = new Float32Array(attributes.normal.buffer, 0, attributes.normal.offset);

            // Fill buffers
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
            gl.bufferSubData(gl.ARRAY_BUFFER, offsets.position, positions);
            // yes, array will be larger than offset, but we don't care
            offsets.position += attributes.position.offset * 4;

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
            gl.bufferSubData(gl.ARRAY_BUFFER, offsets.normal, normals);
            offsets.normal += attributes.normal.offset * 4;

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
            gl.bufferSubData(gl.ARRAY_BUFFER, offsets.texcoord, texcoords);
            offsets.texcoord += attributes.texcoord.offset * 4;

            buffers.tuples += attributes.position.offset;
        }

        buffers.tuples /= 3;

        buffersByTexture[ textureValue ] =  buffers;
    }
    this.buffersByTexture = buffersByTexture;

    timer.log('Voxels.prepareMeshBuffers', Date.now() - start);
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

    for (var textureValue in this.buffersByTexture) {
        var bufferBundle = this.buffersByTexture[ textureValue ];
        if (bufferBundle.tuples == 0) {
            continue;
        }

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

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
        gl.enableVertexAttribArray(this.shader.attributes.position);
        gl.vertexAttribPointer(this.shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
        gl.enableVertexAttribArray(this.shader.attributes.texcoord);
        gl.vertexAttribPointer(this.shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.normal);
        gl.enableVertexAttribArray(this.shader.attributes.normal);
        gl.vertexAttribPointer(this.shader.attributes.normal, 3, gl.FLOAT, false, 0, 0);

        gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
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
