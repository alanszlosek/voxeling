import { Renderable } from './entities/renderable.mjs';

let debug = false;
/*
WebGL stuff that pertains only to voxels
*/

// prepare normals
let normals = [
    Float32Array.from([0, 1.0, 0]), // top
    Float32Array.from([0, 0, -1.0]), // back
    Float32Array.from([0, 0, 1.0]), // front
    Float32Array.from([-1.0, 0, 0]), // left
    Float32Array.from([1.0, 0, 0]), // right
    Float32Array.from([0, -1.0, 0]), // bottom
    // duplicate for transparent faces
    Float32Array.from([0, 1.0, 0]), // top
    Float32Array.from([0, 0, -1.0]), // back
    Float32Array.from([0, 0, 1.0]), // front
    Float32Array.from([-1.0, 0, 0]), // left
    Float32Array.from([1.0, 0, 0]), // right
    Float32Array.from([0, -1.0, 0]) // bottom
];




class Voxels extends Renderable {
    constructor(game, textureOffsets) {
        super();
        this.game = game;
        
        this.textures = game.textureAtlas;
        this.textureOffsets = textureOffsets;
        this.nearBuffersByGroup = {};
        this.farBuffersByGroup = {};

        // We re-buffer nearby meshes more frequently than far meshes
        this.nearMeshes = {};
        this.farMeshes = {};
        this.meshDistances = {};

        this.nearPending = false;
        this.farPending = false;

        this.farDistance = 2;

        this.hazeDistance = 90.0;
    }

    init() {
        let self = this;
        let game = this.game;
        this.gl = game.userInterface.webgl.gl;
        this.shader = game.userInterface.webgl.shaders.projectionPosition;
        this.ambientLight = game.sky.ambientLightColor;
        this.directionalLight = game.sky.directionalLight;

        //this.gl.activeTexture(this.gl.TEXTURE0);
        // set which of the 32 handles we want this bound to
        //this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures.byValue[0]);

       this.nearTimestamp = 0;
       this.farTimestamp = 0;
    }


    showMesh(chunkId, mesh) {
        if (chunkId in this.meshDistances) {
            if (debug) {
                console.log('Voxels.showMesh: ' + chunkId);
            }
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
        } else {
            if (debug) {
                console.log('Voxels.showMesh shipping:' + chunkId);
            }
        }
    }

    // Due to player's current position, we only need to show these meshes
    meshesToShow(meshDistances) {
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
            self.releaseMesh(mesh);
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
            self.releaseMesh(mesh);
            delete self.farMeshes[ chunkId ];
        }

        // This that once we change regions we should re-fill all GL buffers
        this.prepareMeshBuffers(true);
        this.prepareMeshBuffers(false);
        this.nearPending = this.farPending = false;
    }

    releaseMesh(mesh) {
        // Release old mesh
        var transferList = [];
        for (var bundleGroupId in mesh) {
            var bundleGroup = mesh[bundleGroupId];
            // Go past the Growable, to the underlying ArrayBuffer
            transferList.push(bundleGroup.position.buffer);
            transferList.push(bundleGroup.texcoord.buffer);
        }
        // specially list the ArrayBuffer object we want to transfer
        this.game.clientWorkerHandle.worker.postMessage(
            ['freeMesh', mesh],
            transferList
        );
    }


    prepareMeshBuffers(near) {
        let self = this;
        let start = Date.now();
        let gl = this.gl;
        let currentBuffersByGroup;
        let currentMeshes;

        let largestBuffer = 0;

        if (near) {
            currentBuffersByGroup = this.nearBuffersByGroup;
            currentMeshes = this.nearMeshes;
            console.log('perparing near');
        } else {
            currentBuffersByGroup = this.farBuffersByGroup;
            currentMeshes = this.farMeshes;
            console.log('perparing far');
        }

        // Tally up the bytes we need to allocate for each texture's buffer tuple
        let bytesByGroup = {};
        // Queue up texture-specific data so we can push it into GL buffers later
        let attributesByGroup = {};
        for (let chunkId in currentMeshes) {
            let mesh = currentMeshes[ chunkId ];
            for (let bufferGroupId in mesh) {
                let bufferGroup = mesh[bufferGroupId];

                if (bufferGroupId in bytesByGroup) {
                    bytesByGroup[ bufferGroupId ].position += bufferGroup.position.offsetBytes;
                    bytesByGroup[ bufferGroupId ].texcoord += bufferGroup.texcoord.offsetBytes;

                    attributesByGroup[ bufferGroupId ].push(bufferGroup);

                } else {
                    bytesByGroup[ bufferGroupId ] = {
                        position: bufferGroup.position.offsetBytes,
                        texcoord: bufferGroup.texcoord.offsetBytes
                    };

                    attributesByGroup[ bufferGroupId ] = [
                        bufferGroup
                    ];
                }
            }
        }

        // Delete buffers we don't need right now
        // Eventually maybe do something different
        /*
        for (let bufferGroupId in currentBuffersByGroup) {
            let bufferGroup = currentBuffersByGroup[ bufferGroupId ];
            bufferGroup.tuples = 0;
        }
        */

        // Create 3 GL buffers for each texture and allocate the necessary space
        let buffersByGroup = {};
        for (let bufferGroupId in bytesByGroup) {
            let bytes = bytesByGroup[ bufferGroupId ];

            let offsets = {
                position: 0,
                texcoord: 0
            };

            let buffers;
            if (bufferGroupId in currentBuffersByGroup) {
                let newLength;
                buffers = currentBuffersByGroup[ bufferGroupId ];
                buffers.tuples = 0;
                // Destroy and re-create as double if not large enough
                if (buffers.positionBytes < bytes.position) {
                    
                    newLength = buffers.positionBytes * 2;
                    while (newLength < bytes.position) {
                        newLength *= 2;
                    }
                    console.log('Reallocating gl buffer of size: ' + newLength);
                    gl.deleteBuffer(buffers.position);
                    buffers.position = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
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
                //largestBuffer = Math.max(largestBuffer, buffers.positionBytes, buffers.texcoordBytes);

            } else {
                var blen = 32000000;
                // Destroy and create if not large enough, otherwise re-use
                buffers = {
                    position: gl.createBuffer(),
                    texcoord: gl.createBuffer(),
                    tuples: 0,
                    positionBytes: bytes.position,
                    texcoordBytes: bytes.texcoord
                    //textureUnit: this.textureOffsets['textureToTextureUnit'][ textureValue ]
                };
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
                gl.bufferData(gl.ARRAY_BUFFER, bytes.position, gl.STATIC_DRAW);
                                
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
                gl.bufferData(gl.ARRAY_BUFFER, bytes.texcoord, gl.STATIC_DRAW);

                //largestBuffer = Math.max(largestBuffer, bytes.position, bytes.texcoord);
            }

            var attributeQueue = attributesByGroup[ bufferGroupId ];
            for (var i = 0; i < attributeQueue.length; i++) {
                var attributes = attributeQueue[i];

                var positions = new Float32Array(attributes.position.buffer, 0, attributes.position.offset);
                var texcoords = new Float32Array(attributes.texcoord.buffer, 0, attributes.texcoord.offset);

                // Fill buffers
                
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
                gl.bufferSubData(gl.ARRAY_BUFFER, offsets.position, positions);
                offsets.position += attributes.position.offsetBytes;
                
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
                gl.bufferSubData(gl.ARRAY_BUFFER, offsets.texcoord, texcoords);
                offsets.texcoord += attributes.texcoord.offsetBytes;

                buffers.tuples += attributes.position.tuples;
            }

            buffersByGroup[ bufferGroupId ] =  buffers;
        }

        // This will replace nearBuffersByGroup or farBuffersByGroup
        if (near) {
            this.nearBuffersByGroup = buffersByGroup;
        } else {
            this.farBuffersByGroup = buffersByGroup;
        }

        //timer.slog('Voxels.prepareMeshBuffers ' + blen, Date.now() - start); //, largestBuffer);
    }

    tick(ts) {
        if (ts - this.nearTimestamp >= 100.0) {
            this.nearTimestamp = ts;
            if (this.nearPending) {
                this.prepareMeshBuffers(true);
                this.nearPending = false;
            }
        }
        if (ts - this.farTimestamp >= 1000.0) {
            this.farTimestamp = ts;
            if (this.farPending) {
                this.prepareMeshBuffers(false);
                this.farPending = false;
            }
        }

    }


    render(ts) {
        var start = Date.now();
        var gl = this.gl;
        let ambientLight = this.ambientLight;
        let directionalLight = this.directionalLight;

        let shader = this.game.userInterface.webgl.shaders.projectionPosition

        gl.useProgram(shader.program);
        gl.uniformMatrix4fv(shader.uniforms.projection, false, this.game.camera.projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.view, false, this.game.camera.viewMatrix);

        //gl.uniform3fv(shader.uniforms.ambientLightColor, ambientLight);
        //gl.uniform3fv(shader.uniforms.directionalLightColor, directionalLight.color);
        //gl.uniform3fv(shader.uniforms.directionalLightPosition, directionalLight.position);
        //gl.uniform1f(shader.uniforms.hazeDistance, this.hazeDistance);
        gl.uniform1i(shader.uniforms.texture, 3); // all voxel textures are in the same

        gl.enable(gl.CULL_FACE);

        // TODO: measure time within render body per second, so we can see how much render changes help
        // TODO: refactor this to render once per texture atlas, isntead of per-texture
        // TODO: need to flag textures in config that have "cutouts" or alpha, and move them to a dedicated texture atlas
        // so we can disable face culling when rendering that atlas


        for (var bufferGroupId in this.nearBuffersByGroup) {
            var bufferBundle = this.nearBuffersByGroup[ bufferGroupId ];
            if (bufferBundle.tuples == 0) {
                continue;
            }
            // dont do faces with transparency yet
            if (bufferGroupId != '0' && bufferGroupId != '1' && bufferGroupId != '2' && bufferGroupId != '3' && bufferGroupId != '4' && bufferGroupId != '5') {
                continue;
            }

            // set normals
            gl.uniform3fv(shader.uniforms.normal, normals[bufferGroupId]);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
            gl.enableVertexAttribArray(shader.attributes.position);
            gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
            gl.enableVertexAttribArray(shader.attributes.texcoord);
            gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
        }

        for (var bufferGroupId in this.farBuffersByGroup) {
            var bufferBundle = this.farBuffersByGroup[ bufferGroupId ];
            if (bufferBundle.tuples == 0) {
                continue;
            }

            gl.uniform3fv(shader.uniforms.normal, normals[bufferGroupId]);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
            gl.enableVertexAttribArray(shader.attributes.position);
            gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
            gl.enableVertexAttribArray(shader.attributes.texcoord);
            gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
        }

        // now render near meshes with transparency
        for (var bufferGroupId in this.nearBuffersByGroup) {
            var bufferBundle = this.nearBuffersByGroup[ bufferGroupId ];
            if (bufferBundle.tuples == 0) {
                continue;
            }
            // only do faces with transparency
            if (bufferGroupId == '0' || bufferGroupId == '1' || bufferGroupId == '2' || bufferGroupId == '3' || bufferGroupId == '4' || bufferGroupId == '5') {
                continue;
            }

            // set normals
            gl.uniform3fv(shader.uniforms.normal, normals[bufferGroupId]);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
            gl.enableVertexAttribArray(shader.attributes.position);
            gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
            gl.enableVertexAttribArray(shader.attributes.texcoord);
            gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
        }

        //timer.slog('Voxels.render', Date.now() - start);
    }
}

export { Voxels };
