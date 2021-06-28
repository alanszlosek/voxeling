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


// We have an instance of this for each cube face ...
// Holds position and texcoord values for each face mesh
class BufGroup {
    constructor(gl, groupId, sampler) {
        this.gl = gl;
        this.id = groupId;
        this.sampler = sampler;
        this.positionBuf = new Buf(gl);
        this.texcoordBuf = new Buf(gl);
    }

    toShow(chunkId, bufferBundle) {
        // todo check these
        this.positionBuf.toShow(chunkId, bufferBundle.position.buffer, bufferBundle.position.offsetBytes);
        this.texcoordBuf.toShow(chunkId, bufferBundle.texcoord.buffer, bufferBundle.texcoord.offsetBytes);
    }
    toDelete(chunkId) {
        this.positionBuf.toDelete(chunkId);
        this.texcoordBuf.toDelete(chunkId);
    }
    toCopy(chunkId, sources) {
        this.positionBuf.toCopy(chunkId, sources.position);
        this.texcoordBuf.toCopy(chunkId, sources.texcoord);
    }
    getLocations(chunkId) {
        return {
            position: this.positionBuf.getLocation(chunkId),
            texcoord: this.texcoordBuf.getLocation(chunkId)
        };
    }

    update() {
        // update tuples number?
        let position = this.positionBuf.update();
        let texcoord = this.texcoordBuf.update();

        return {
            position: position.buffer,
            texcoord: texcoord.buffer,
            sampler: this.sampler,
            // 4 byte floats, 3 floats per tuple, i think?
            tuples: position.byteSize / 12
        };
    }
}

class Buf {
    constructor(gl) {
        this.gl = gl;
        // TODO: we might not need these currently as-is
        this.currentBuffer = this._newBuffer();
        this.nextBuffer = this._newBuffer();
        this._toCopy = {};
        this._toDelete = {};
        this._toShow = {};
        this.pendingToCopy = false;
        this.pendingToDelete = false;
        this.pendingToShow = false;
        
        this.chunks = {}; // chunkId -> [glbuffer, offset, length]
        // track sizes of chunks currently in the buffer
        this.chunkBytes = {};
        // if we need to make changes, put them here first
        // this should start out as a copy of chunkBytes
        this.pendingChunkBytes = {};
    }
    _newBuffer() {
        let gl = this.gl;
        let defaultSize = 16384;

        let buf = {
            buffer: gl.createBuffer(),
            byteSize: defaultSize,
            offset: 0
        };
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.buffer);
        gl.bufferData(gl.ARRAY_BUFFER, defaultSize, gl.DYNAMIC_DRAW);

        return buf;
    }
    toShow(chunkId, data, length) {
        this.pendingChunkBytes[ chunkId ] = length;
        this._toShow[ chunkId ] = data;   
        this.pendingToShow = true;
    }

    toDelete(chunkId) {
        this._toDelete[ chunkId ] = true;
        // preemptively remove from _toShow and _toCopy too?
        delete this.pendingChunkBytes[ chunkId ];
        this.pendingToDelete = true;
    }

    // source = [glBuffer, offset, byteLength]
    toCopy(chunkId, source) {



        this.pendingChunkBytes[chunkId] = source[2];
        this._toCopy[chunkId] = source;
        this.pendingToCopy = true;
    }

    // used to help copy data between gl buffers
    getLocation(chunkId) {
        return this.chunks[chunkId];
    }

    update() {
        if (!this.pendingToCopy && !this.pendingToDelete && !this.pendingToShow) {
            return;
        }
        let gl = this.gl;
        // copy data to the other gl buffer if pending copy or delete
        let copyToNextBuffer = this.pendingToCopy || this.pendingToDelete;
        let buffer = copyToNextBuffer ? this.nextBuffer : this.currentBuffer; // points to gl buffer container
        let bytesNeeded = 0;
        for (let chunkId in this.pendingChunkBytes) {
            bytesNeeded += this.pendingChunkBytes[chunkId];
        }

        //console.log('pendingToCopy and pendingToDelete', this.pendingToCopy, this.pendingToDelete);

        // Realloc if todelete or tocopy or too small
        if (bytesNeeded > buffer.byteSize) {
            // if we have to re-alloc, use nextBuffer buffer
            buffer = this.nextBuffer;
            if (buffer.buffer) {
                gl.deleteBuffer(buffer.buffer);
            }
            // copy data to other gl buffer if we had to re-alloc due to size
            copyToNextBuffer = true;

            let newByteSize = buffer.byteSize * 2;
            while (newByteSize < bytesNeeded) {
                newByteSize *= 2;
            }

            console.log('gl.createBuffer ' + newByteSize);

            // need to re-alloc
            buffer.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
            // TODO: convert this to webgl2 format
            gl.bufferData(gl.ARRAY_BUFFER, newByteSize, gl.DYNAMIC_DRAW);
            buffer.byteSize = newByteSize;
            buffer.offset = 0; // doubles as "used bytes"
        }

        // If we need to copy between our buffers, prepare the copy manifests
        if (copyToNextBuffer) {
            buffer.offset = 0;
            for (let chunkId in this.chunks) {
                // don't copy old data if we have new data for this chunk
                if (chunkId in this._toShow || chunkId in this._toDelete) {
                    continue;
                }
                this._toCopy[ chunkId ] = this.chunks[chunkId];
            }
            console.log('Will copy ' + Object.keys(this._toCopy).length + ' chunks to another buffer: ');
        }



        gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);
        // Copy data from other buffers
        for (let chunkId in this._toCopy) {
            let source = this._toCopy[chunkId];
            let size = source[2];

            if (!source[0]) {
                //console.log('toCopy: source buffer is null. chunk must be old');
                continue;
            }

            //console.log('toCopy: readOffset writeOffset size:', source[1], buffer.offset, size);

            gl.bindBuffer(gl.COPY_READ_BUFFER, source[0]);
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.ARRAY_BUFFER, source[1], buffer.offset, size);

            // might have issue here if another Buf has handle to this for copying data, but shouldn't
            this.chunks[chunkId] = [buffer.buffer, buffer.offset, size];
            buffer.offset += size;
        }
        // now copy in new data
        for (let chunkId in this._toShow) {
            let source = this._toShow[chunkId];
            let size = this.pendingChunkBytes[chunkId];

            if (chunkId in this._toDelete) {
                console.log('CHUNK IN toShow AND toDelete');
            }

            if (buffer.byteSize < buffer.offset + size) {
                console.log('oh boy');
            }

            // TODO: source should be float 32
            //console.log('toShow: copying in bytes: ' + source.length);
            // probably don't need to convert to float32 ... maybe just array view and leave size in bytes instead of div by 4
            let f = new Float32Array(source);
            gl.bufferSubData(gl.ARRAY_BUFFER, buffer.offset, f, 0, f.length);

            this.chunks[chunkId] = [buffer.buffer, buffer.offset, size];
            buffer.offset += size;
        }



        // copy pendingChunkBytes to chunkBytes
        for (let chunkId in this.pendingChunkBytes) {
            this.chunkBytes[chunkId] = this.pendingChunkBytes[chunkId];
        }

        // remove old chunks from all data structures
        for (let chunkId in this._toDelete) {
            console.log('toDelete: removing ' + chunkId);
            // set buffer to null in case it's present in _toCopy elsewhere
            if (chunkId in this.chunks) {
                this.chunks[chunkId][0] = null;
                delete this.chunks[chunkId];
            }
            delete this.chunkBytes[chunkId];
        }

        // swap currentBuffer and nextBuffer>
        if (buffer != this.currentBuffer) {
            //console.log('promoting nextBuffer');
            let temp = this.currentBuffer;
            this.currentBuffer = this.nextBuffer;
            this.nextBuffer = temp;
        }

        this._toCopy = {};
        this._toDelete = {};
        this._toShow = {};
        this.pendingToCopy = this.pendingToDelete = this.pendingToShow = false;

        return {
            buffer: this.currentBuffer.buffer,
            byteSize: this.currentBuffer.offset
        };
    }
}

class AtlasBuffer {
    constructor(id, near) {
        this.id = id;
        this.near = near;

        this.glBuffers = {
            position: {
                glBuffer: null,
                // so we can delete old glBuffer after all copies are done
                glBuffer_delete: null,
                byteSize: 0
            },
            texcoord: {
                glBuffer: null,
                glBuffer_delete: null,
                byteSize: 0
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
                    byteSize: 0
                },
                texcoord: {
                    glBuffer: null,
                    offset: 0,
                    byteSize: 0
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
            positionBytesNeeded += chunk.position.size;
            texcoordBytesNeeded += chunk.texcoord.size;
        }
        for (let chunkId in this._copyFrom) {
            // if chunk is in _copyFrom and chunks, it's being moved to new glBuffer
            // within this AtlasBuffer ... don't double-count it
            if (chunkId in this.chunks) {
                continue;
            }
            let chunk = this._fill[chunkId];
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

    update(gl) {
        let self = this;
        // calculate bytes needed for each glBuffer
        let bytesNeeded = this._bytesNeeded();

        // TODO: do we need to move?

        // determine whether we need to ferry to larger glBuffers
        if (bytesNeeded.position > this.glBuffers.position.byteSize) {
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
            for (let chunkId in this.chunks) {
                let chunk = this.chunks[chunkId];
                // skip if in fill
                if (chunkId in this._fill) {
                    continue;
                }
                // copy from old glBuffer
                this._copyFrom[chunkId] = {
                    position: {
                        glBuffer: this.glBuffers.position.glBuffer_delete,
                        offset: chunk.position.offset,
                        byteSize: chunk.position.byteSize
                    },
                    texcoord: {
                        glBuffer: this.glBuffers.texcoord.glBuffer_delete,
                        offset: chunk.texcoord.offset,
                        byteSize: chunk.texcoord.byteSize
                    }
                };
            }
        } else {
            // reset offsets?
        }

        let prepareManifest = function(chunkId) {
            if (chunkId in self.chunks) {
                return;
            }
            self.chunks[chunkId ] = {
                position: {
                    glBuffer: null,
                    offset: 0,
                    byteSize: 0
                },
                texcoord: {
                    glBuffer: null,
                    offset: 0,
                    byteSize: 0
                }
            };
        }

        // copy between glBuffers using manifests
        let copyFromTo = function(source, target, manifestToUpdate) {
            gl.bindBuffer(gl.ARRAY_BUFFER, target.glBuffer);
            gl.bindBuffer(gl.COPY_READ_BUFFER, source.glBuffer);
            // TODO: errors here
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.ARRAY_BUFFER, source.offset, target.offset, source.size);

            manifestToUpdate.glBuffer = target.glBuffer;
            manifestToUpdate.offset = target.offset;
            
            target.offset += source.size;
        }
        for (let chunkId in this._copyFrom) {
            prepareManifest(chunkId);
            let atlasBufferManifest = this._copyFrom[chunkId];

            copyFromTo(atlasBufferManifest.position, this.glBuffers.position, this.chunks[chunkId].position);
            copyFromTo(atlasBufferManifest.texcoord, this.glBuffers.texcoord, this.chunks[chunkId].texcoord);
        }


        // TODO: how do i process toFill and populate chunks?
        let fillBuffer = function(source, target, manifestToUpdate) {
            gl.bindBuffer(gl.ARRAY_BUFFER, target.glBuffer);

            let f = new Float32Array(source);
            // bufferSubData wants length in items, not bytes
            gl.bufferSubData(gl.ARRAY_BUFFER, target.offset, f, 0, f.length);

            manifestToUpdate.glBuffer = target.glBuffer;
            manifestToUpdate.offset = target.offset;
            manifestToUpdate.size = f.byteLength;
            
            target.offset += f.byteLength;
        }
        for (let chunkId in this._fill) {
            prepareManifest(chunkId);
            let chunk = this._fill[chunkId];

            // position and texcoord data
            fillBuffer(chunk.position, this.glBuffers.position, this.chunks[chunkId].position);
            fillBuffer(chunk.texcoord, this.glBuffers.texcoord, this.chunks[chunkId].texcoord);
        }

        this.tuples = this._glBufferHandles.tuples = this.glBuffers.position.offset / 12;
        this._copyFrom = {};
        this._fill = {};
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
        // TODO dont squash existing manifest
        if (chunkId in this.chunks) {
            this.chunks[chunkId].mesh = mesh;
        } else {
            this.chunks[chunkId] = this._newChunkInfo(chunkId, mesh);
        }
        this.nearPending = true;
    }
    chunksToShow(chunks) {
        this.visibleChunks = chunks;

    }
    update() {
        let gl = this.gl;
        let toDelete = {};
        for (let chunkId in this.chunks) {
            let chunk = this.chunks[ chunkId ];
            if (!(chunkId in this.visibleChunks)) {
                // remove this chunk from all buffers
                for (let buffer in chunk.buffers) {
                    // delete from manifest
                    buffer.delete(chunkId);
                }
                // enqueue chunk to be removed from our manifest
                toDelete[chunkId] = chunk;

            } else if (chunk.mesh) { // we have new data to draw
                // check existing buffers
                chunk.buffers.forEach(function(buffer, i) {
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
            if (!bufferBundle) {
                continue;
            }
            if (bufferBundle.tuples == 0) {
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

export { Voxels, Buf, BufGroup };
