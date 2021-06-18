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

function setIntersection(setA, setB) {
    let _intersection = new Set();
    for (let elem of setB) {
        if (setA.has(elem)) {
            _intersection.add(elem);
        }
    }
    return _intersection;
}

function setDifference(setA, setB) {
    let _difference = new Set(setA);
    for (let elem of setB) {
        _difference.delete(elem);
    }
    return _difference;
}

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

// For each chunk, a handle the Bufs, offsets and positions
class Manifest {
    constructor() {
        this.manifest = {}
    }
    // details = [positionBuf, offset, length, texcoordBuf, offset, length]
    add(chunkId, details) {
        this.manifest[chunkid] = details;
    }
    delete(chunkId) {
        delete this.manifest[chunkId];

    }
    contains(chunkId) {
        return chunkId in this.manifest;
    }
    getByteNeeds() {
        let bytes1 = 0;
        let bytes2 = 0;
        let bytes = {
            position: 0,
            texcoord: 0
        };
        for (let chunkId in this.manifest) {
            let chunk = this.manifest[chunkId];
            bytes.position += chunk[2];
            bytes.texcoord += chunk[4];
        }
        return bytes;
    }
}

// We have an instance of this for each cube face ...
// Holds position and texcoord values for each face mesh
class BufGroup {
    constructor(groupId) {
        this.groupId = groupId;
        this.uuid = uuid();

        this.positionBuf = new Buf();
        this.texcoordBuf = new Buf();
    }

    toShow(chunkId, bufferBundle) {
        // todo check these
        this.positionBuf.toShow(chunkId, bufferBundle.position.data, bufferBundle.position.offsetBytes);
        this.texcoordBuf.toShow(chunkId, bufferBundle.texcoord.data, bufferBundle.texcoord.offsetBytes);
    }
    toDelete(chunkId) {
        this.positionBuf.toDelete(chunkId);
        this.texcoordBuf.toDelete(chunkId);
    }
    toCopy(chunkId, sources) {
        this.positionBuf.toCopy(chunkId, sources.position);
        this.texcoordBuf.toCopy(chunkId, sources.texcoord);
    }

    update() {
        // update tuples number?
        let position = this.positionBuf.update();
        let texcoord = this.texcoordBuf.update();

        return {
            position: position.buffer,
            texcoord: texcoord.buffer,
            // 4 byte floats, 3 floats per tuple, i think?
            tuples: position.byteSize / 12
        };
    }
}

class Buf {
    constructor(byteSize) {
        this.currentState = this._newState();
        this.nextState = this._newState();
        this.pending = false;
 
    }
    _newState() {
        return {
            byteNeeds: {},
            offsets: {},
            buffer: null,
            bufferSize: 0,

            toCopy: {},
            toShow: {}
        };
    }
    toShow(chunkId, data, length) {
        let state = this.nextState;
        state.byteNeeds[ chunkId ] = length;
        state.toShow[ chunkId ] = data;
        // do we already have this in current state?
        // if same size we don't have to gen new buffer ... but maybe that logic will work
        // itself out in update()
    
        //if (chunkId in this.current.byteNeeds && length == )

        this.pending = true;
    }

    toDelete(chunkId) {
        delete this.nextState.byteNeeds[chunkId];
    }

    // source = [glBuffer, offset, byteLength]
    toCopy(chunkId, source) {
        // ???
        //this.nextState.toCopy[chunkId]
        this.nextState.byteNeeds[chunkId] = source[2];
        this.nextState.toCopy[chunkId] = source;
        this.pending = true;
    }

    update() {
        if (!this.pending) {
            return;
        }
        let gl = this.gl;

        let state = this.nextState;
        let byteNeeds = 0;
        for (let chunkId in state.byteNeeds) {
            byteNeeds += state.byteNeeds[chunkId];

            if (!(chunkId in state.toCopy)) {
                // pull from current state, so we can copy from other GL buffer
                state.toCopy[chunkId] = this.currentState.manifest[chunkId];
            }
        }

        // what if we don't really need to swap to new buffer?
        // in some cases, we can just copy toShow back into current buffer
        // how can i handle that case?

        // do we need to re-allocate our buffer?
        if (byteNeeds != state.bufferSize) {
            if (state.buffer) {
                gl.deleteBuffer(state.buffer);
            }
            console.log('gl.createBuffer ' + byteNeeds);
            // need to re-alloc
            state.buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
            gl.bufferData(gl.ARRAY_BUFFER, byteNeeds, gl.STATIC_DRAW);
            state.bufferSize = byteNeeds;
        }

        let offset = 0;
        gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
        // Copy data from other buffers
        for (let chunkId in state.toCopy) {
            let source = state.toCopy[chunkId];
            let size = source[2];

            console.log('gl.copyBufferSubData size: ' + size);

            gl.bindBuffer(gl.COPY_READ_BUFFER, source[0]);
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.ARRAY_BUFFER, source[1], offset, size);

            state.offsets[chunkId] = offset;
            state.manifest[chunkId] = [state.buffer, offset, size];
            offset += size;
        }
        // now copy in new data
        for (let chunkId in state.toShow) {
            let source = state.toShow[chunkId];
            let size = state.byteNeeds[chunkId];

            // TODO: source should be float 32
            console.log('gl.bufferSubData size: ' + source.length);
            gl.bufferSubData(gl.ARRAY_BUFFER, offset, source);

            state.offsets[chunkId] = offset;
            state.manifest[chunkId] = [state.buffer, offset, size];
            offset += size;
        }

        state.toCopy = {};
        state.toShow = {};

        // swap currentState and nextState?
        if (this.swap) {
            let temp = this.currentState;
            this.currentState = this.nextState;
            this.currentState = temp;
        }

        return {
            buffer: this.currentState.buffer,
            byteSize: this.currentState.bufferSize
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
        this.pendingBufGroups = {};
        this.nearChunkToGroups = {};
        this.farChunkToGroups = {};
        this.nearBufGroups = [];
        this.farBufGroups = [];

        this.farDistance = 2;
        this.nearCutoff = 0;

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
        let createRenderBufferContainer = function() {
            return {
                position: null,
                texcoord: null,
                tuples: 0
            };
        }
        for (let i = 0; i < 12; i++) {
            this.nearRenderBuffersByGroup.push(createRenderBufferContainer());
            this.farRenderBuffersByGroup.push(createRenderBufferContainer());

            this.nearBufGroups.push( new BufGroup(i) );
            this.farBufGroups.push( new BufGroup(i) );
        };
    }

    // enqueue this chunk's mesh for showing/updating
    showChunk(chunkId, mesh) {
        if (!(chunkId in this.visibleChunks)) {
            return;
        }

        if (this.visibleChunks[chunkId] < this.farDistance) {
            this.nearChunksToShow[chunkId] = mesh;
        } else {
            this.farChunksToShow[chunkId] = mesh;
        }
    }

    // Due to player's current position, we only need to show these meshes.
    // This controls which chunks we draw, and helps us discard far chunks as we move through the world.
    // Param is a map of chunkId to distance away from player, which helps us sort each chunk into near/far
    chunksToShow(chunkDistances) {
        for (let chunkId in chunkDistances) {
            if (chunkDistances[chunkId] < this.farDistance) {
                // near
                if (chunkId in this.farChunkToGroups) {
                    // relocate
                    // get source and destination
                    for (let groupId in this.farChunkToGroups[chunkId]) {

                    }
                }
            } else {
                // far
                if (chunkId in this.nearChunkToGroups) {
                    // relocate
                }
            }
        }
        // handle deletions
        for (let chunkId in this.farChunkToGroups) {
            if (!(chunkId in chunkDistances)) {
                // delete
                this.farChunkToGroups[ chunkId ].forEach(function(bufGroup) {
                    bufGroup.toDelete(chunkId);
                    this.pendingBufGroups[ bufGroup.uuid ] = bufGroup;
                });
            }
        }
        for (let chunkId in this.nearChunkToGroups) {
            if (!(chunkId in chunkDistances)) {
                // delete
                this.nearChunkToGroups[ chunkId ].forEach(function(bufGroup) {
                    bufGroup.toDelete(chunkId);
                    this.pendingBufGroups[ bufGroup.uuid ] = bufGroup;
                });
            }
        }
        this.visibleChunks = chunkDistances;
    }

    update() {

        // TODO: when do we add to nearChunkToGroups?
        for (let chunkId in this.nearChunksToShow) {
            let data = this.nearChunksToShow[chunkId];
            // compare to current nearChunkToGroups // hmmm

            // remove this chunk from buffer group it's no longer in
            this.chunkToBufGroups[chunkId].forEach(function(bufGroup) {
                // is this 
                if (!data[ bufGroup.groupId ]) {
                    bufGroup.toDelete( chunkId );
                    this.pendingNearBufGroups[ bufGroup.uuid ] = bufGroup;
                }
            });
            let groups = [];
            data.forEach(function(bufferBundle, groupId) {
                let bufGroup = this.nearBufGroups[groupId];
                groups.push(bufGroup);
                bufGroup.toShow(chunkId, bufferBundle);
                this.pendingNearBufGroups[ bufGroup.uuid ] = bufGroup;
            });
            this.nearChunkToGroups[chunkId] = groups;
        }

        for (let chunkId in this.farChunksToShow) {
            let data = this.farChunksToShow[chunkId];
            // compare to current nearChunkToGroups // hmmm

            // remove this chunk from buffer group it's no longer in
            this.chunkToBufGroups[chunkId].forEach(function(bufGroup) {
                // is this 
                if (!data[ bufGroup.groupId ]) {
                    bufGroup.toDelete( chunkId );
                    this.pendingFarBufGroups[ bufGroup.uuid ] = bufGroup;
                }
            });
            let groups = [];
            data.forEach(function(bufferBundle, groupId) {
                let bufGroup = this.farBufGroups[groupId];
                groups.push(bufGroup);
                bufGroup.toShow(chunkId, bufferBundle);
                this.pendingFarBufGroups[ bufGroup.uuid ] = bufGroup;
            });
            this.farChunkToGroups[chunkId] = groups;
        }

        // TODO: split this into near and far
        for (let id in this.pendingNearBufGroups) {
            let bufGroup = this.pendingNearBufGroups[id];
            let glBuffers = bufGroup.update();

            this.nearRenderBuffersByGroup[ groupId ] = glBuffers;
        }
        for (let id in this.pendingFarBufGroups) {
            let bufGroup = this.pendingFarBufGroups[id];
            let glBuffers = bufGroup.update();
            this.farRenderBuffersByGroup[ groupId ] = glBuffers;
        }

        this.nearChunksToShow = {};
        this.farChunksToShow = {};
        this.pendingNearBufGroups = {};
        this.pendingFarBufGroups = {};
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
            this.nearCutoff = ts + 200;
            this.update();
            /*
            if (this.nearPending) {
                this.prepareMeshBuffers(true);
                this.nearPending = false;
            }
            */
        }
        /*
        if (ts - this.farTimestamp >= 1000.0) {
            this.farTimestamp = ts;
            if (this.farPending) {
                this.prepareMeshBuffers(false);
                this.farPending = false;
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
        gl.uniform1i(shader.uniforms.texture, 3); // all voxel textures are in the same

        gl.enable(gl.CULL_FACE);

        // TODO: measure time within render body per second, so we can see how much render changes help
        // TODO: refactor this to render once per texture atlas, isntead of per-texture
        // TODO: need to flag textures in config that have "cutouts" or alpha, and move them to a dedicated texture atlas
        // so we can disable face culling when rendering that atlas


        for (let bufferGroupId = 0; bufferGroupId < 6; bufferGroupId++) {
            var bufferBundle = this.nearRenderBuffersByGroup[ bufferGroupId ];
            if (bufferBundle.tuples == 0) {
                continue;
            }
            // dont do faces with transparency yet

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

        for (let bufferGroupId = 0; bufferGroupId < 6; bufferGroupId++) {
            var bufferBundle = this.farRenderBuffersByGroup[ bufferGroupId ];
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
        for (let bufferGroupId = 6; bufferGroupId < 12; bufferGroupId++) {
            var bufferBundle = this.nearRenderBuffersByGroup[ bufferGroupId ];
            if (bufferBundle.tuples == 0) {
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
