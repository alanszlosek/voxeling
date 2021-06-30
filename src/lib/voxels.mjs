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


class GlBuf {
    constructor(id, near, defaultSize) {
        this.defaultSize = defaultSize || 16384;
        this.id = id;
        this.near = near;

        this.glBuffer = null;
        // so we can delete old glBuffer after all copies are done
        this.glBuffer_delete = null;
        this.byteLength = 0;
        this.tuples = 0;

        this.shuffle = false;
        // intent: to provide a manifest of which chunks are in this AtlasBuffer and where
        this.chunks = {
            //chunkId: [offset, size]
            /*
            chunkId: {
                glBuffer: null,
                offset: 0,
                byteLength: 0
            }
            */
        };
        // intent: to hold mesh data to be copied into to this AtlasBuffer
        this._fill = {
            /*
            chunkId: [Float32Array]
            */
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
    getLocation(chunkId) {
        return this.chunks[chunkId];
    }
    fill(chunkId, data) {
        this._fill[chunkId] = data;
        // if size is different, shuffle
        if (chunkId in this.chunks) {
            let chunk = this.chunks[chunkId];
            
            if (data.byteLength != chunk.byteLength) {
                //this.debug('filling with diff sized data, need to shuffle')
                this.shuffle = true;
            }
        }
    }
    copyFrom(chunkId, location) {
        this._copyFrom[chunkId] = location;
        this.shuffle = true;
    }

    _bytesNeeded() {
        let bytesNeeded = 0;
        for (let chunkId in this.chunks) {
            // if chunk is also in _fill, it might have a new size
            // so count it in that loop below
            if (chunkId in this._fill) {
                continue;
            }
            let chunk = this.chunks[chunkId];
            bytesNeeded += chunk.byteLength;
        }
        for (let chunkId in this._copyFrom) {
            // if chunk is in _copyFrom and chunks, it's being moved to new glBuffer
            // within this AtlasBuffer ... don't double-count it
            if (chunkId in this.chunks) {
                continue;
            }
            let chunk = this._copyFrom[chunkId];
            bytesNeeded += chunk.byteLength;
        }
        for (let chunkId in this._fill) {
            let chunk = this._fill[chunkId];
            bytesNeeded += chunk.byteLength;
        }

        return bytesNeeded;
    }

    _newGlBuffer = function(gl, bytesNeeded) {
        if (this.glBuffer) {
            this.glBuffer_delete = this.glBuffer;
        }
        // minimum is 16k
        if (this.byteLength == 0) {
            this.byteLength = this.defaultSize;
        }
        let newByteLength = this.byteLength;
        while (newByteLength < bytesNeeded) {
            newByteLength *= 2;
        }

        this.debug('creating new GL buffer for ' + newByteLength + ' bytes. ' + this._info());

        this.glBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
        // TODO: convert this to webgl2 format
        gl.bufferData(gl.ARRAY_BUFFER, newByteLength, gl.DYNAMIC_DRAW);
        this.byteLength = newByteLength;
        this.offset = 0; // doubles as "used bytes"
    };

    debug(msg) {
        console.log(msg);
    }

    _info() {
        return [this.id, this.near].join(',');
    }
    info() {
        console.log(this.chunks, this._copyFrom, this._fill, this._info());
    }

    update(gl) {
        let self = this;
        // calculate bytes needed for each glBuffer
        let bytesNeeded = this._bytesNeeded();

        //this.debug();

        // TODO: do we need to move?

        // if removing lots during regionChange, we need to shuffle to new buffer even though
        // size requirements may be less

        // determine whether we need to ferry to larger glBuffers
        if (bytesNeeded > this.byteLength || this.shuffle) {
            this._newGlBuffer(gl, bytesNeeded);
            this.shuffle = true;
        }
        
        // enqueue copy operations for move to new glBuffers
        if (this.shuffle) {
            let sz = Object.keys(this.chunks).length;
            if (sz > 0) {
                this.debug('shuffling ' + sz + ' chunks to new GL buffer ' + this._info());
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
                    glBuffer: this.glBuffer_delete,
                    offset: chunk.offset,
                    byteLength: chunk.byteLength
                };
            }
            // clear manifest - OH NO
            this.chunks = {};
        }

        //this.debug(this._copyFrom, this._fill, this.info());

        let newManifest = function() {
            return {
                glBuffer: null,
                offset: 0,
                byteLength: 0
            };
        }

        if (Object.keys(this._copyFrom).length > 0) {
            this.debug('copying between glBuffers ' + this._info());
        }
        for (let chunkId in this._copyFrom) {
            let manifest = newManifest();
            let source = this._copyFrom[chunkId];

            this.chunks[chunkId] = manifest;

            gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);
            gl.bindBuffer(gl.COPY_READ_BUFFER, source.glBuffer);
            // TODO: errors here
            if (this.byteLength < (this.offset  + source.byteLength)) {
                this.debug('likely copyBufferSubData overflow ' + self._info());
            }
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.ARRAY_BUFFER, source.offset, this.offset, source.byteLength);

            manifest.glBuffer = this.glBuffer;
            manifest.offset = this.offset;
            manifest.byteLength = source.byteLength;
            
            this.offset += source.byteLength;
        }

        if (Object.keys(this._fill).length > 0) {
            this.debug('filling glBuffers ' + this._info());
        }
        for (let chunkId in this._fill) {
            let source = this._fill[chunkId];
            let manifest;
            let inPlace = false;

            // compare fill size against manifest. If same can reuse. 
            if (chunkId in this.chunks) {
                manifest = this.chunks[chunkId];
                inPlace = manifest.byteLength == source.byteLength;
            } else {
                manifest = newManifest();
            }

            this.chunks[chunkId] = manifest;

            gl.bindBuffer(gl.ARRAY_BUFFER, this.glBuffer);

            let f = new Float32Array(source);
            // bufferSubData wants length in items, not bytes
            if (inPlace) {
                if (this.byteLength < (manifest.offset  + source.byteLength)) {
                    this.debug('likely bufferSubData overflow ' + self._info());
                }
                this.debug('COPYING DATA TO SAME SPOT IN BUFFER');
                gl.bufferSubData(gl.ARRAY_BUFFER, manifest.offset, f, 0, f.length);

            } else {
                if (this.byteLength < (this.offset  + source.byteLength)) {
                    this.debug('likely bufferSubData overflow ' + self._info());
                }
                gl.bufferSubData(gl.ARRAY_BUFFER, this.offset, f, 0, f.length);

                manifest.glBuffer = this.glBuffer;
                manifest.offset = this.offset;
                manifest.byteLength = f.byteLength;
                
                this.offset += f.byteLength;
            }
        }

        this.tuples = this.offset / 12;
        this._copyFrom = {};
        this._fill = {};
        this.shuffle = false;
    }
    cleanup(gl) {
        // delete glBuffer if necessary
        if (this.glBuffer_delete) {
            gl.deleteBuffer( this.glBuffer_delete );
            this.glBuffer_delete = null;
        }
    }
}


class AtlasBuffer {
    constructor(id, near, defaultSize) {
        this.defaultSize = defaultSize || 16384;
        this.id = id;
        this.near = near;

        this.position = new GlBuf(id, near, defaultSize);
        this.texcoord = new GlBuf(id, near, defaultSize);
    }
    delete(chunkId) {
        this.position.delete(chunkId);
        this.texcoord.delete(chunkId);
    }
    getLocations(chunkId) {
        return {
            position: this.position.getLocation(chunkId),
            texcoord: this.texcoord.getLocation(chunkId)
        };
    }
    fill(chunkId, data) {
        this.position.fill(chunkId, data.position);
        this.texcoord.fill(chunkId, data.texcoord);
    }
    copyFrom(chunkId, location) {
        this.position.copyFrom(chunkId, location.position);
        this.texcoord.copyFrom(chunkId, location.texcoord);
    }
    info() {
        return [this.id, this.near].join(',');
    }

    debug() {
        console.log(this.chunks, this._copyFrom, this._fill, this.info());
    }

    update(gl) {
        this.position.update(gl);
        this.texcoord.update(gl);
    }

    cleanup(gl) {
        this.position.cleanup(gl);
        this.texcoord.cleanup(gl);
    }
    buffers() {
        return {
            position: {
                glBuffer: this.position.glBuffer,
                offset: this.position.offset
            },
            texcoord: {
                glBuffer: this.texcoord.glBuffer,
                offset: this.texcoord.offset
            },
        }
    }
    handles() {
        return {
            position: this.position.glBuffer,
            texcoord: this.texcoord.glBuffer,
            tuples: this.position.tuples,
            sampler: this.id
        };
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

        this.currentBufferSet = 0;
        this.buffers1 = [];
        this.buffers2 = [];
        this.renderBuffers1 = [];
        this.renderBuffers2 = [];

        this.nearCutoff = 0;
        this.pending = false;

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

        this.textureAtlasStart = 3;
        this.textureAtlasEnd = this.textureAtlasStart + this.game.textureOffsets['numAtlases'];

        // TODO: for now i've hardcoded texture atlas numbers
        // we group chunk mesh data by texture atlas/sampler integer
        for (let i = this.textureAtlasStart; i < this.textureAtlasEnd; i++) {
            this.buffers1[i] = new AtlasBuffer(i, true);
            this.buffers2[i] = new AtlasBuffer(i, false);
        }
    }

    // intent: to help Voxels direct chunks to AtlasBuffers
    _newChunkInfo(chunkId, mesh) {
        return {
            chunkId: chunkId,
            near: this.visibleChunks[chunkId] < this.farDistance,
            bufferSet: this.currentBufferSet,
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
        this.pending = true;
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

    debug(msg) {
        //console.log(msg);
    }
    update() {
        let self = this;
        let gl = this.gl;
        let toDelete = {};
        for (let chunkId in this.chunks) {
            let chunk = this.chunks[ chunkId ];
            if (!(chunkId in this.visibleChunks)) {
                // remove this chunk from all buffers
                this.debug('removing chunk from buffers');
                chunk.buffers.forEach(function(buffer, i) {
                    // delete from manifest
                    buffer.delete(chunkId);
                });
                // enqueue chunk to be removed from our manifest
                toDelete[chunkId] = chunk;

            } else if (chunk.mesh) { // we have new data to draw
                // check existing buffers
                this.debug('new mesh ' + chunkId);
                chunk.buffers.forEach(function(buffer, i) {
                    self.debug('checking whether to remove from old buffers');
                    if (!chunk.mesh[i]) {
                        // new data doesn't use this texture atlas
                        buffer.delete(chunkId);
                    }
                });
                let bufs = chunk.bufferSet == 0 ? this.buffers1 : this.buffers2;
                let chunkBuffers = [];
                chunk.mesh.forEach(function(bufferData, i) {
                    bufs[i].fill(chunkId, bufferData);
                    // keep pointer to which AtlasBuffers this chunk is going to be in
                    chunkBuffers[i] = bufs[i];
                });
                chunk.buffers = chunkBuffers;

                // clear mesh data since we've enqueued it
                chunk.mesh = null;

            }
        }

        // TODO: try to reduce looping we do below

        this.buffers1.forEach(function(buffer, id) {
            buffer.update(gl);
        });
        this.buffers2.forEach(function(buffer, id) {
            buffer.update(gl);
        });

        // now do deletes and get render handles
        let renderBuffers = [];
        this.buffers1.forEach(function(buffer, id) {
            buffer.cleanup(gl);
            renderBuffers[id] = buffer.handles();
        });
        this.renderBuffers1 = renderBuffers;

        renderBuffers = [];
        this.buffers2.forEach(function(buffer, id) {
            buffer.cleanup(gl);
            renderBuffers[id] = buffer.handles();
        });
        this.renderBuffers2 = renderBuffers;


        // we've removed them from AtlasBuffer instances,
        // now remove no-longer-visible chunks from our manifest
        for (let chunkId in toDelete) {
            delete this.chunks[chunkId];
        }
        this.pending = false;

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

        this.currentBufferSet = this.currentBufferSet == 0 ? 1 : 0;
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
            if (this.pending) {
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


        for (let i = this.textureAtlasStart; i < this.textureAtlasEnd; i++) {
            var bufferBundle = this.renderBuffers1[ i ];
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

        for (let i = this.textureAtlasStart; i < this.textureAtlasEnd; i++) {
            var bufferBundle = this.renderBuffers2[ i ];
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

export { Voxels, AtlasBuffer };
