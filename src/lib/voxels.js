/*
WebGL stuff that pertains only to voxels
*/
var timer = require('./timer');
var debug = false;

function Voxels(gl, shader, textures, releaseMeshCallback) {
    var self = this;
    this.gl = gl;
    this.shader = shader;
    this.textures = textures;
    this.releaseMeshCallback = releaseMeshCallback;
    this.nearBuffersByTexture = {};
    this.farBuffersByTexture = {};

    // We re-buffer nearby meshes more frequently than far meshes
    this.nearMeshes = {};
    this.farMeshes = {};
    this.meshDistances = {};

    this.nearPending = false;
    this.farPending = false;

    this.farDistance = 2;

    // Schedule prepareMeshBuffers()
    setInterval(
        function() {
            if (self.nearPending) {
                self.prepareMeshBuffers(true);
                self.nearPending = false;
            }
        },
        100
    );
    setInterval(
        function() {
            if (self.farPending) {
                self.prepareMeshBuffers(false);
                self.farPending = false;
            }
        },
        1000
    );
};

Voxels.prototype.showMesh = function(chunkId, mesh) {
    if (chunkId in this.meshDistances) {
        var distance = this.meshDistances[ chunkId ];
        if (distance < this.farDistance) {
            this.nearMeshes[ chunkId ] = mesh;
            this.nearPending = true;
            if (chunkId in this.farMeshes) {
                delete this.farMeshes[ chunkId ];
                this.farPending = true;
            }
        } else {
            this.farMeshes[ chunkId ] = mesh;
            this.farPending = true;
            if (chunkId in this.nearMeshes) {
                delete this.nearMeshes[ chunkId ];
                this.nearPending = true;
            }
        }
    }
    if (debug) {
        console.log('Voxels.showMesh ', chunkId);
    }
};

// Due to player's current position, we only need to show these meshes
Voxels.prototype.meshesToShow = function(meshDistances) {
    var self = this;
    this.meshDistances = meshDistances;

    // Clean up nearby meshes
    var chunkIds = Object.keys(self.nearMeshes);
    for (var i = 0; i < chunkIds.length; i++) {
        var chunkId = chunkIds[i];
        // meshDistances contains the meshes we want to draw
        if (chunkId in meshDistances) {
            // If it's no longer nearby, remove it from this.nearMeshes
            if (meshDistances[ chunkId ] < this.farDistance) {
            } else {
                self.farMeshes[ chunkId ] = self.nearMeshes[ chunkId ];
                delete self.nearMeshes[ chunkId ];
            }
            continue;
        }
        // We're not drawing this mesh anymore
        var mesh = self.nearMeshes[ chunkId ];
        self.releaseMeshCallback(mesh);
        delete self.nearMeshes[ chunkId ];
    }

    var chunkIds = Object.keys(self.farMeshes);
    for (var i = 0; i < chunkIds.length; i++) {
        var chunkId = chunkIds[i];
        // meshDistances contains the meshes we want to draw
        if (chunkId in meshDistances) {
            // If it's nearby instead of far, remove it from this.farMeshes
            if (meshDistances[ chunkId ] < this.farDistance) {
                self.nearMeshes[ chunkId ] = self.farMeshes[ chunkId ];
                delete self.farMeshes[ chunkId ];
            }
            continue;
        }
        // We're not drawing this mesh anymore
        var mesh = self.farMeshes[ chunkId ];
        self.releaseMeshCallback(mesh);
        delete self.farMeshes[ chunkId ];
    }

    // This that once we change regions we should re-fill all GL buffers
    this.prepareMeshBuffers(true);
    this.prepareMeshBuffers(false);
    this.nearPending = this.farPending = false;
};


Voxels.prototype.prepareMeshBuffers = function(near) {
    var self = this;
    var start = Date.now();
    var gl = this.gl;
    var currentBuffersByTexture;
    var currentMeshes;

    if (near) {
        currentBuffersByTexture = this.nearBuffersByTexture;
        currentMeshes = this.nearMeshes;
    } else {
        currentBuffersByTexture = this.farBuffersByTexture;
        currentMeshes = this.farMeshes;
    }

    // Tally up the bytes we need to allocate for each texture's buffer tuple
    var bytesByTexture = {};
    // Queue up texture-specific data so we can push it into GL buffers later
    var attributesByTexture = {};
    for (var chunkId in currentMeshes) {
        var mesh = currentMeshes[ chunkId ];
        for (var textureValue in mesh) {
            var attributes = mesh[textureValue];

            if (textureValue in bytesByTexture) {
                bytesByTexture[ textureValue ].position += attributes.position.offsetBytes;
                bytesByTexture[ textureValue ].texcoord += attributes.texcoord.offsetBytes;
                // Normal bytes is always same as position

                attributesByTexture[ textureValue ].push(attributes);

            } else {
                bytesByTexture[ textureValue ] = {
                    position: attributes.position.offsetBytes,
                    texcoord: attributes.texcoord.offsetBytes
                };

                attributesByTexture[ textureValue ] = [
                    attributes
                ];
            }
        }
    }

    // Delete buffers we don't need right now
    // Eventually maybe do something different
    for (var textureValue in currentBuffersByTexture) {
        var bufferBundle = currentBuffersByTexture[ textureValue ];
        bufferBundle.tuples = 0;
    }

    // Create 3 GL buffers for each texture and allocate the necessary space
    var buffersByTexture = {};
    for (var textureValue in bytesByTexture) {
        var bytes = bytesByTexture[ textureValue ];

        var offsets = {
            position: 0,
            texcoord: 0
        };

        var buffers;
        if (textureValue in currentBuffersByTexture) {
            var newLength;
            buffers = currentBuffersByTexture[ textureValue ];
            buffers.tuples = 0;
            // Destroy and re-create as double if not large enough
            if (buffers.positionBytes < bytes.position) {
                newLength = buffers.positionBytes * 2;
                while (newLength < bytes.position) {
                    newLength *= 2;
                }
                gl.deleteBuffer(buffers.position);
                buffers.position = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
                gl.bufferData(gl.ARRAY_BUFFER, newLength, gl.STATIC_DRAW);
                
                gl.deleteBuffer(buffers.normal);
                buffers.normal = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
                gl.bufferData(gl.ARRAY_BUFFER, newLength, gl.STATIC_DRAW);
                
                buffers.positionBytes = newLength;
            }
            if (buffers.texcoordBytes < bytes.texcoord) {
                newLength = buffers.texcoordBytes * 2;
                while (newLength < bytes.texcoord) {
                    newLength *= 2;
                }
                gl.deleteBuffer(buffers.texcoord);
                buffers.texcoord = gl.createBuffer();
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
                gl.bufferData(gl.ARRAY_BUFFER, newLength, gl.STATIC_DRAW);
                
                buffers.texcoordBytes = newLength;
            }
        } else {
            // Destroy and create if not large enough, otherwise re-use
            buffers = {
                position: gl.createBuffer(),
                texcoord: gl.createBuffer(),
                normal: gl.createBuffer(),
                tuples: 0,
                positionBytes: bytes.position,
                texcoordBytes: bytes.texcoord
            };
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
            gl.bufferData(gl.ARRAY_BUFFER, bytes.position, gl.STATIC_DRAW);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
            gl.bufferData(gl.ARRAY_BUFFER, bytes.position, gl.STATIC_DRAW);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
            gl.bufferData(gl.ARRAY_BUFFER, bytes.texcoord, gl.STATIC_DRAW);
        }

        var attributeQueue = attributesByTexture[ textureValue ];
        for (var i = 0; i < attributeQueue.length; i++) {
            var attributes = attributeQueue[i];

            var positions = new Float32Array(attributes.position.buffer, 0, attributes.position.offset);
            var texcoords = new Float32Array(attributes.texcoord.buffer, 0, attributes.texcoord.offset);
            var normals = new Float32Array(attributes.normal.buffer, 0, attributes.normal.offset);

            // Fill buffers
            
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
            gl.bufferSubData(gl.ARRAY_BUFFER, offsets.position, positions);
            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
            gl.bufferSubData(gl.ARRAY_BUFFER, offsets.position, normals);
            offsets.position += attributes.position.offsetBytes;

            gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
            gl.bufferSubData(gl.ARRAY_BUFFER, offsets.texcoord, texcoords);
            offsets.texcoord += attributes.texcoord.offsetBytes;

            buffers.tuples += attributes.position.tuples;
        }

        buffersByTexture[ textureValue ] =  buffers;
    }
    // This will replace nearBuffersByTexture or farBuffersByTexture
    if (near) {
        this.nearBuffersByTexture = buffersByTexture;
    } else {
        this.farBuffersByTexture = buffersByTexture;
    }

    timer.log('Voxels.prepareMeshBuffers', Date.now() - start);
};


Voxels.prototype.render = function(projection, ts, ambientLight, directionalLight) {
    var start = Date.now();
    var gl = this.gl;

    gl.useProgram(this.shader.program);
    gl.uniformMatrix4fv(this.shader.uniforms.projection, false, projection);
    gl.uniform3fv(this.shader.uniforms.ambientLightColor, ambientLight);
    gl.uniform3fv(this.shader.uniforms.directionalLightColor, directionalLight.color);
    gl.uniform3fv(this.shader.uniforms.directionalLightPosition, directionalLight.position);

    for (var textureValue in this.nearBuffersByTexture) {
        var bufferBundle = this.nearBuffersByTexture[ textureValue ];
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

    for (var textureValue in this.farBuffersByTexture) {
        var bufferBundle = this.farBuffersByTexture[ textureValue ];
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


module.exports = Voxels;
