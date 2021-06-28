import { Renderable } from './entities/renderable.mjs';
import uuid from 'hat';
import { tickables } from './entities/renderable.mjs';

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


/*
- currentChunksInBuffer
- desiredChunksInBuffer
- shuffle between group's buffer1 and buffer2
    - after we calculate desired
    - after deciding which to add, which to delete
- copy into group's buffer1 or buffer2
- how to handle chunks/meshes that need updating?
    - we should NOT copy them to the other buffer during shuffling
    - but copy in from RAM afterwards

*/



class AtlasBuffer {
    constructor(id, near) {
        this.id = id;
        this.near = near;

        this.glBuffers = {
            position: {
                glBuffer: null,
                // so we can delete old glBuffer after all copies are done
                glBuffer_delete: null,
                byteSize: 0,
                offset: 0
            },
            texcoord: {
                glBuffer: null,
                glBuffer_delete: null,
                byteSize: 0,
                offset: 0
            }
        };
        this._glBufferHandles = {
            position: null,
            texcoord: null,
            tuples: 0,
            sampler: id
        };
        this.tuples = 0;

        this.shuffle = false;
        // intent: to provide a manifest of which chunks are in this AtlasBuffer and where
        this.chunks = {
            //chunkId: [offset, size]
            /*
            chunkId: {
                position: {
                    glBuffer: null,
                    offset: 0,
                    byteLength: 0
                },
                texcoord: {
                    glBuffer: null,
                    offset: 0,
                    byteLength: 0
                }
            }
            */
        };
        // intent: to hold mesh data to be copied into to this AtlasBuffer
        this._fill = {
            /*
            chunkId: {
                position: [Float32Array]
            }
            */
            //chunkId: [data, size]
        };
        // intent: to point to data in another AtlasBuffer that should be copied into this one
        this._copyFrom = {
            // structure of this mirrors this.chunks, see above
        };
    }
    delete(chunkId) {
        delete this.chunks[chunkId];
        this.shuffle = true;
    }
    getLocations(chunkId) {
        return this.chunks[chunkId];
    }
    fill(chunkId, data) {
        this._fill[chunkId] = data;
    }
    copyFrom(chunkId, location) {
        this._copyFrom[chunkId] = location;
        this.shuffle = true;
    }

    _newGlBuffer = function(gl, buf, bytesNeeded) {
        if (buf.glBuffer) {
            buf.glBuffer_delete = buf.glBuffer;
        }
        // minimum is 16k
        if (buf.byteSize == 0) {
            buf.byteSize = 16384;
        } else {
            console.log('here');
        }
        let newByteSize = buf.byteSize * 2;
        while (newByteSize < bytesNeeded) {
            newByteSize *= 2;
        }

        buf.glBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.glBuffer);
        // TODO: convert this to webgl2 format
        gl.bufferData(gl.ARRAY_BUFFER, newByteSize, gl.DYNAMIC_DRAW);
        buf.byteSize = newByteSize;
        buf.offset = 0; // doubles as "used bytes"
    };

    // TODO: this needs to consider fill, copyFrom, etc
    _bytesNeeded() {
        let positionBytesNeeded = 0;
        let texcoordBytesNeeded = 0;
        for (let chunkId in this.chunks) {
            // if chunk is also in _fill, it might have a new size
            // so count it in that loop below
            if (chunkId in this._fill) {
                continue;
            }
            let chunk = this.chunks[chunkId];
            positionBytesNeeded += chunk.position.byteLength;
            texcoordBytesNeeded += chunk.texcoord.byteLength;
        }
        for (let chunkId in this._copyFrom) {
            // if chunk is in _copyFrom and chunks, it's being moved to new glBuffer
            // within this AtlasBuffer ... don't double-count it
            if (chunkId in this.chunks) {
                continue;
            }
            let chunk = this._copyFrom[chunkId];
            positionBytesNeeded += chunk.position.byteLength;
            texcoordBytesNeeded += chunk.texcoord.byteLength;
        }
        for (let chunkId in this._fill) {
            let chunk = this._fill[chunkId];
            positionBytesNeeded += chunk.position.byteLength;
            texcoordBytesNeeded += chunk.texcoord.byteLength;
        }

        return {
            position: positionBytesNeeded,
            texcoord: texcoordBytesNeeded
        };
    }

    info() {
        return [this.id, this.near].join(',');
    }

    update(gl) {
        let self = this;
        // calculate bytes needed for each glBuffer
        let bytesNeeded = this._bytesNeeded();

        // TODO: do we need to move?

        // determine whether we need to ferry to larger glBuffers
        if (bytesNeeded.position > this.glBuffers.position.byteSize) {
            console.log('create new GL buffer ' + this.info());
            this._newGlBuffer(gl, this.glBuffers.position, bytesNeeded.position);
            this._newGlBuffer(gl, this.glBuffers.texcoord, bytesNeeded.texcoord);
            this._glBufferHandles.position = this.glBuffers.position.glBuffer;
            this._glBufferHandles.texcoord = this.glBuffers.texcoord.glBuffer;
            this.shuffle = true;
        } else {
            // do we need to reset offsets for any other reason?
            // or do anything else if we're not moving to a new glBuffer?
        }
        
        // enqueue copy operations for move to new glBuffers
        if (this.shuffle) {
            let sz = Object.keys(this.chunks).length;
            if (sz > 0) {
                console.log('shuffling ' + sz + ' chunks to new GL buffer ' + this.info());
            }
            for (let chunkId in this.chunks) {
                let chunk = this.chunks[chunkId];
                // skip if in fill
                if (chunkId in this._fill) {
                    // if size diff, reset manifest so we append
                    continue;
                }
                // copy from old glBuffer
                this._copyFrom[chunkId] = {
                    position: {
                        glBuffer: this.glBuffers.position.glBuffer_delete,
                        offset: chunk.position.offset,
                        byteLength: chunk.position.byteLength
                    },
                    texcoord: {
                        glBuffer: this.glBuffers.texcoord.glBuffer_delete,
                        offset: chunk.texcoord.offset,
                        byteLength: chunk.texcoord.byteLength
                    }
                };
            }
            // clear manifest
            this.chunks = {};
        } else {
            // reset offsets?
        }

        let newManifest = function() {
            return {
                position: {
                    glBuffer: null,
                    offset: 0,
                    byteLength: 0
                },
                texcoord: {
                    glBuffer: null,
                    offset: 0,
                    byteLength: 0
                }
            };
        }

        // copy between glBuffers using manifests
        let copyFromTo = function(source, target, manifestToUpdate) {
            gl.bindBuffer(gl.ARRAY_BUFFER, target.glBuffer);
            gl.bindBuffer(gl.COPY_READ_BUFFER, source.glBuffer);
            // TODO: errors here
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.ARRAY_BUFFER, source.offset, target.offset, source.byteLength);

            manifestToUpdate.glBuffer = target.glBuffer;
            manifestToUpdate.offset = target.offset;
            manifestToUpdate.byteLength = source.byteLength;
            
            target.offset += source.byteLength;
        }
        if (Object.keys(this._copyFrom).length > 0) {
            console.log('copying between glBuffers ' + this.info());
        }
        for (let chunkId in this._copyFrom) {
            let manifest = newManifest();
            let atlasBufferManifest = this._copyFrom[chunkId];

            copyFromTo(atlasBufferManifest.position, this.glBuffers.position, manifest.position);
            copyFromTo(atlasBufferManifest.texcoord, this.glBuffers.texcoord, manifest.texcoord);
            this.chunks[chunkId] = manifest;
        }


        // TODO: how do i process toFill and populate chunks?
        let fillBuffer = function(source, target, manifestToUpdate, inPlace) {
            gl.bindBuffer(gl.ARRAY_BUFFER, target.glBuffer);

            let f = new Float32Array(source);
            // bufferSubData wants length in items, not bytes
            if (inPlace) {
                console.log('COPYING DATA TO SAME SPOT IN BUFFER');
                gl.bufferSubData(gl.ARRAY_BUFFER, manifestToUpdate.offset, f, 0, f.length);

            } else {
                gl.bufferSubData(gl.ARRAY_BUFFER, target.offset, f, 0, f.length);

                manifestToUpdate.glBuffer = target.glBuffer;
                manifestToUpdate.offset = target.offset;
                manifestToUpdate.byteLength = f.byteLength;
                
                target.offset += f.byteLength;
            }
        }
        if (Object.keys(this._fill).length > 0) {
            console.log('filling glBuffers ' + this.info());
        }
        for (let chunkId in this._fill) {
            let chunk = this._fill[chunkId];
            let manifest;
            let inPlace = false;

            // compare fill size against manifest. If same can reuse. 
            if (chunkId in this.chunks) {
                manifest = this.chunks[chunkId];
                inPlace = manifest.position.byteLength == chunk.position.byteLength;
            } else {
                manifest = newManifest();
            }

            fillBuffer(chunk.position, this.glBuffers.position, manifest.position, inPlace);
            fillBuffer(chunk.texcoord, this.glBuffers.texcoord, manifest.texcoord, inPlace);
            this.chunks[chunkId] = manifest;
        }

        this.tuples = this._glBufferHandles.tuples = this.glBuffers.position.offset / 12;
        this._copyFrom = {};
        this._fill = {};
        this.shuffle = false;
    }

    cleanup(gl) {
        // delete glBuffer if necessary
        if (this.glBuffers.position.glBuffer_delete) {
            gl.deleteBuffer( this.glBuffers.position.glBuffer_delete );
            this.glBuffers.position.glBuffer_delete = null;
        }
        if (this.glBuffers.texcoord.glBuffer_delete) {
            gl.deleteBuffer( this.glBuffers.texcoord.glBuffer_delete );
            this.glBuffers.texcoord.glBuffer_delete = null;
        }
    }
    handles() {
        return this._glBufferHandles;
    }
}


class Voxels extends Renderable {
    constructor(game, textureOffsets) {
        super();
        this.game = game;
        
        this.textures = game.textureAtlas;
        this.textureOffsets = textureOffsets;
        this.farDistance = 2;
        this.hazeDistance = 90.0;

        this.chunks = {
            /*
            chunkId: {
                buffers: _newChunkInfo()
            }
            */
        };
        this.visibleChunks = {};
        this.nearBuffers = [];
        this.farBuffers = [];
        this.nearRenderBuffers = [];
        this.farRenderBuffers = [];

        this.nearCutoff = 0;
        this.nearPending = false;

    }
    init() {
        let self = this;
        let game = this.game;
        this.gl = game.userInterface.webgl.gl;
        this.shader = game.userInterface.webgl.shaders.projectionPosition;
        this.ambientLight = game.sky.ambientLightColor;
        this.directionalLight = game.sky.directionalLight;

        this.nearTimestamp = 0;
        this.farTimestamp = 0;

        // TODO: for now i've hardcoded texture atlas numbers
        // we group chunk mesh data by texture atlas/sampler integer
        for (let i = 3; i < 10 + 3; i++) {
            this.nearBuffers[i] = new AtlasBuffer(i, true);
            this.farBuffers[i] = new AtlasBuffer(i, false);
        }
    }

    // intent: to help Voxels direct chunks to AtlasBuffers
    _newChunkInfo(chunkId, mesh) {
        return {
            chunkId: chunkId,
            near: this.visibleChunks[chunkId] < this.farDistance,
            mesh: mesh,
            buffers: [
                //points to item in nearBuffers or farBuffers
                // _newAtlasBuffer()
            ]
        };
    }

    showChunk(chunkId, mesh) {
        if (!(chunkId in this.visibleChunks)) {
            return;
        }
        /*
        for (let i = 0; i < 13; i++) {
            if (i != 3 && mesh[i]) {
                delete mesh[i];
            }
        }
        */
        // TODO dont squash existing manifest
        if (chunkId in this.chunks) {
            this.chunks[chunkId].mesh = mesh;
        } else {
            this.chunks[chunkId] = this._newChunkInfo(chunkId, mesh);
        }
        this.nearPending = true;
    }
    chunksToShow(chunks) {
        /*
        chunks = {
            '0|0|0': 0,
            '-32|0|-32': 1,
            '-32|0|32': 1,
            '32|0|-32': 1,
            
            '32|0|32': 1
        };
    */


        this.visibleChunks = chunks;

    }
    update() {
        let gl = this.gl;
        let toDelete = {};
        for (let chunkId in this.chunks) {
            let chunk = this.chunks[ chunkId ];
            if (!(chunkId in this.visibleChunks)) {
                // remove this chunk from all buffers
                console.log('removing chunk from buffers');
                chunk.buffers.forEach(function(buffer, i) {
                    // delete from manifest
                    buffer.delete(chunkId);
                });
                // enqueue chunk to be removed from our manifest
                toDelete[chunkId] = chunk;

            } else if (chunk.mesh) { // we have new data to draw
                // check existing buffers
                console.log('new mesh ' + chunkId);
                chunk.buffers.forEach(function(buffer, i) {
                    console.log('checking whether to remove from old buffers');
                    if (!chunk.data[i]) {
                        // new data doesn't use this texture atlas
                        buffer.delete(chunkId);
                    } else {
                        if (chunk.near == buffer.near) {
                            // we'll set fill below
                        } else {
                            // different region, need to delete so we can copy in to new region
                            buffer.delete(chunkId);
                        }
                    }
                });
                let bufs = chunk.near ? this.nearBuffers : this.farBuffers;
                let chunkBuffers = [];
                chunk.mesh.forEach(function(bufferData, i) {
                    bufs[i].fill(chunkId, bufferData);
                    // keep pointer to which AtlasBuffers this chunk is going to be in
                    chunkBuffers[i] = bufs[i];
                });
                chunk.buffers = chunkBuffers;

                // clear mesh data since we've enqueued it
                chunk.mesh = null;

            } else {
                // do we need to move to new region?
                let near = this.visibleChunks[chunkId] < this.farDistance;
                if (chunk.near == near) {
                    // chunk still visible within same region, nothing to do?

                } else {
                    console.log('chunk moved near/far');
                    // chunk has moved near/far
                    let target = near ? this.farBuffers : this.nearBuffers;
                    let chunkBuffers = [];
                    chunk.buffers.forEach(function(buffer, i) {
                        target[i].copyFrom(chunkId, buffer.getLocations(chunkId));
                        buffer.delete(chunkId);
                        chunkBuffers[i] = target[i];
                    });
                    chunk.buffers = chunkBuffers;
                }
            }
        }

        // TODO: try to reduce looping we do below

        this.nearBuffers.forEach(function(buffer, id) {
            buffer.update(gl);
        });
        this.farBuffers.forEach(function(buffer, id) {
            buffer.update(gl);
        });

        // now do deletes and get render handles
        let renderBuffers = [];
        this.nearBuffers.forEach(function(buffer, id) {
            buffer.cleanup(gl);
            renderBuffers[id] = buffer._glBufferHandles;
        });
        this.nearRenderBuffers = renderBuffers;

        renderBuffers = [];
        this.farBuffers.forEach(function(buffer, id) {
            buffer.cleanup(gl);
            renderBuffers[id] = buffer._glBufferHandles;
        });
        this.farRenderBuffers = renderBuffers;


        // we've removed them from AtlasBuffer instances,
        // now remove no-longer-visible chunks from our manifest
        for (let chunkId in toDelete) {
            delete this.chunks[chunkId];
        }
        this.nearPending = false;

        /*
        - loop over buffers
            - do we need to shuffle?
            - if need to shuffle
                - calculate size needs
                - if need new buffer
                    - set glBuffer_delete to old buffer
                        - we'll delete after all buffer copies are done
                    - make new buffer
                - enqueue all current items as copyFrom
                    - skipping those in fill
            - for chunk in fill:
                - update global chunks manifest with buffer, offset, size

            - for chunk in copyFrom
                - copy into current buffer
                - for each buffer this chunk is part of
                    - update global chunks manifest with glBuffer, offset, size
            - reset shuffle, fill, copyFrom


        - loop over buffers
            - if has glBuffer_delete
                - delete it
            - update render buffer helper with current glBuffer

        - loop over chunksToRemove
            - delete from global chunks manifest
        */
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



    tick(ts) {
        if (ts > this.nearCutoff) {
            this.nearCutoff = ts + 50;
            if (this.nearPending) {
                this.update();
            }
        }
        /*
        if (ts > this.farCutoff) {
            this.farCutoff = ts + 200;
            if (this.farPending) {
                this.updateFar();
            }
        }
        */
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
        //gl.uniform1i(shader.uniforms.texture, 3); // all voxel textures are in the same

        gl.enable(gl.CULL_FACE);

        // TODO: measure time within render body per second, so we can see how much render changes help
        // TODO: refactor this to render once per texture atlas, isntead of per-texture
        // TODO: need to flag textures in config that have "cutouts" or alpha, and move them to a dedicated texture atlas
        // so we can disable face culling when rendering that atlas


        for (let i = 0; i < 13; i++) {
            var bufferBundle = this.nearRenderBuffers[ i ];
            if (!bufferBundle || bufferBundle.tuples == 0) {
                continue;
            }
            // dont do faces with transparency yet

            // set normals
            // TODO: this might be the source of the weird GPU stuff i was seeing
            //gl.uniform3fv(shader.uniforms.normal, normals[bufferGroupId]);
            gl.uniform1i(shader.uniforms.sampler, bufferBundle.sampler);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
            gl.enableVertexAttribArray(shader.attributes.position);
            gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
            gl.enableVertexAttribArray(shader.attributes.texcoord);
            gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
        }

        for (let i = 0; i < 13; i++) {
            var bufferBundle = this.farRenderBuffers[ i ];
            if (!bufferBundle) {
                continue;
            }
            if (bufferBundle.tuples == 0) {
                continue;
            }

            gl.uniform1i(shader.uniforms.sampler, bufferBundle.sampler);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
            gl.enableVertexAttribArray(shader.attributes.position);
            gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
            gl.enableVertexAttribArray(shader.attributes.texcoord);
            gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
        }

        // now render near meshes with transparency
        /*
        for (let bufferGroupId = 120; bufferGroupId < 240; bufferGroupId++) {
            var bufferBundle = this.nearRenderBuffersByGroup[ bufferGroupId ];
            if (bufferBundle.tuples == 0) {
                continue;
            }

            // set normals
            gl.uniform1i(shader.uniforms.sampler, bufferBundle.sampler);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.position);
            gl.enableVertexAttribArray(shader.attributes.position);
            gl.vertexAttribPointer(shader.attributes.position, 3, gl.FLOAT, false, 0, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, bufferBundle.texcoord);
            gl.enableVertexAttribArray(shader.attributes.texcoord);
            gl.vertexAttribPointer(shader.attributes.texcoord, 2, gl.FLOAT, false, 0, 0);

            gl.drawArrays(gl.TRIANGLES, 0, bufferBundle.tuples);
        }
        */

        //console.log('Voxels.render ms', Date.now() - start);
    }
}

export { Voxels };
