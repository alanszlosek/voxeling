import { Renderable } from './entities/renderable.mjs';
import uuid from 'hat';

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


class Voxels extends Renderable {
    constructor(game, textureOffsets) {
        super();
        this.game = game;
        
        this.textures = game.textureAtlas;
        this.textureOffsets = textureOffsets;

        // helper for rendering so we don't have to traverse the nested data structures that help prepareMeshBuffers().
        // we point the position and texcoord pointers to the current buffers after we delete/create/fill/copy/etc
        // set init() for more details
        this.nearRenderBuffersByGroup = [];
        this.farRenderBuffersByGroup = [];
        this.nearChunksToShow = {};
        this.farChunksToShow = {};
        this.pendingNearBufGroups = {};
        this.pendingFarBufGroups = {};
        this.nearChunkToGroups = {};
        this.farChunkToGroups = {};
        this.nearBufGroups = [];
        this.farBufGroups = [];
        this.pendingNear = false;
        this.pendingFar = false;

        this.farDistance = 2;
        this.nearCutoff = 0;
        this.farCutoff = 0;

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



        // prepare nearRenderBuffersByGroup and far
        let createRenderBufferContainer = function(sampler) {
            return {
                position: null,
                texcoord: null,
                sampler: sampler,
                tuples: 0
            };
        }
        // TODO: how should we index these now?
        for (let i = 3; i < 3 + 10; i++) {
            this.nearRenderBuffersByGroup[i] = createRenderBufferContainer(i);
            this.farRenderBuffersByGroup[i] = createRenderBufferContainer(i);

            this.nearBufGroups[i] = new BufGroup(this.gl, i, i);
            this.farBufGroups[i] = new BufGroup(this.gl, i, i);
        };
    }

    // enqueue this chunk's mesh for showing/updating
    showChunk(chunkId, mesh) {
        if (!(chunkId in this.visibleChunks)) {
            return;
        }

        // think we just need to queue, and figure out near/far later

        if (this.visibleChunks[chunkId] < this.farDistance) {
            this.nearChunksToShow[chunkId] = mesh;
            this.nearPending = true;
        } else {
            this.farChunksToShow[chunkId] = mesh;
            this.farPending = true;
        }
    }

    // Due to player's current position, we only need to show these meshes.
    // This controls which chunks we draw, and helps us discard far chunks as we move through the world.
    // Param is a map of chunkId to distance away from player, which helps us sort each chunk into near/far
    chunksToShow(chunkDistances) {
        let self = this;
        /*
        chunkDistances = {
            '0|0|0': 0,
            '32|32|32': 1
        };
        */

        for (let chunkId in chunkDistances) {
            if (chunkDistances[chunkId] < this.farDistance) {
                // near
                if (chunkId in this.farChunkToGroups) {
                    // relocate from far to near
                    this.farChunkToGroups[chunkId].forEach(function(bufGroup) {
                        let id = bufGroup.id;
                        self.nearBufGroups[ id ].toCopy(chunkId, bufGroup.getLocations(chunkId));
                    });
                    this.nearPending = true;
                    this.farPending = true;
                }
            } else {
                // far
                if (chunkId in this.nearChunkToGroups) {
                    // relocate from near to far
                    this.nearChunkToGroups[chunkId].forEach(function(bufGroup) {
                        let id = bufGroup.id;
                        self.farBufGroups[ id ].toCopy(chunkId, bufGroup.getLocations(chunkId));
                    });
                    this.nearPending = true;
                }
            }
        }
        // handle deletions
        for (let chunkId in this.farChunkToGroups) {
            if (chunkId in chunkDistances && chunkDistances[chunkId] >= this.farDistance) {
                continue;
            }
            // delete
            this.farChunkToGroups[ chunkId ].forEach(function(bufGroup) {
                bufGroup.toDelete(chunkId);
                self.pendingFarBufGroups[ bufGroup.id ] = bufGroup;
            });
            this.farPending = true;
        }
        for (let chunkId in this.nearChunkToGroups) {
            if (chunkId in chunkDistances && chunkDistances[chunkId] < this.farDistance) {
                continue;
            }
            // delete
            this.nearChunkToGroups[ chunkId ].forEach(function(bufGroup) {
                bufGroup.toDelete(chunkId);
                self.pendingNearBufGroups[ bufGroup.id ] = bufGroup;
            });
            this.nearPending = true;
        }
        this.visibleChunks = chunkDistances;
    }

    updateNear() {
        let self = this;
        var start = Date.now();

        for (let chunkId in this.nearChunksToShow) {
            let data = this.nearChunksToShow[chunkId];
            // compare to current nearChunkToGroups // hmmm

            // remove this chunk from buffer group it's no longer in
            if (chunkId in this.nearChunkToGroups) {
                this.nearChunkToGroups[chunkId].forEach(function(bufGroup) {
                    // is this going to work?
                    if (!data[ bufGroup.id ]) {
                        bufGroup.toDelete( chunkId );
                        self.pendingNearBufGroups[ bufGroup.id ] = bufGroup;
                    }
                });
            }
            let groups = [];
            data.forEach(function(bufferBundle, groupId) {
                let bufGroup = self.nearBufGroups[groupId];
                groups.push(bufGroup);
                bufGroup.toShow(chunkId, bufferBundle);
                self.pendingNearBufGroups[ bufGroup.id ] = bufGroup;
            });
            this.nearChunkToGroups[chunkId] = groups;
        }

        for (let id in this.pendingNearBufGroups) {
            let bufGroup = this.pendingNearBufGroups[id];
            let glBuffers = bufGroup.update();

            this.nearRenderBuffersByGroup[ id ] = glBuffers;
        }
        this.nearPending = false;
        this.nearChunksToShow = {};
        this.pendingNearBufGroups = {};
        console.log('Voxels.updateNear ms', Date.now() - start);
    }

    updateFar() {
        let self = this;
        var start = Date.now();

        for (let chunkId in this.farChunksToShow) {
            let data = this.farChunksToShow[chunkId];
            // compare to current nearChunkToGroups // hmmm

            // remove this chunk from buffer group it's no longer in
            if (chunkId in this.farChunkToGroups) {
                this.farChunkToGroups[chunkId].forEach(function(bufGroup) {
                    // is this going to work?
                    if (!data[ bufGroup.id ]) {
                        bufGroup.toDelete( chunkId );
                        self.pendingFarBufGroups[ bufGroup.id ] = bufGroup;
                    }
                });
            }
            let groups = [];
            data.forEach(function(bufferBundle, groupId) {
                let bufGroup = self.farBufGroups[groupId];
                groups.push(bufGroup);
                bufGroup.toShow(chunkId, bufferBundle);
                self.pendingFarBufGroups[ bufGroup.id ] = bufGroup;
            });
            this.farChunkToGroups[chunkId] = groups;
        }

        for (let id in this.pendingFarBufGroups) {
            let bufGroup = this.pendingFarBufGroups[id];
            let glBuffers = bufGroup.update();
            this.farRenderBuffersByGroup[ id ] = glBuffers;
        }
        this.farPending = false;
        this.farChunksToShow = {};
        this.pendingFarBufGroups = {};
        console.log('Voxel.updateFar ms', Date.now() - start);
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
                this.updateNear();
            }
        }
        if (ts > this.farCutoff) {
            this.farCutoff = ts + 200;
            if (this.farPending) {
                this.updateFar();
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
        //gl.uniform1i(shader.uniforms.texture, 3); // all voxel textures are in the same

        gl.enable(gl.CULL_FACE);

        // TODO: measure time within render body per second, so we can see how much render changes help
        // TODO: refactor this to render once per texture atlas, isntead of per-texture
        // TODO: need to flag textures in config that have "cutouts" or alpha, and move them to a dedicated texture atlas
        // so we can disable face culling when rendering that atlas


        for (let i = 0; i < 13; i++) {
            var bufferBundle = this.nearRenderBuffersByGroup[ i ];
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
            var bufferBundle = this.farRenderBuffersByGroup[ i ];
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
