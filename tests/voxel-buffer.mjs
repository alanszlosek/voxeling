import { AtlasBuffer } from '../src/lib/voxels.mjs';

// testing new buffer copy code from src/lib/voxels.mjs

class GlStub {
    ARRAY_BUFFER = 0;
    COPY_READ_BUFFER = 1;
    constructor() {
        this.bound = [];
    }
    createBuffer() {
        return {
            arrayBuffer: null,
            byteLength: 0
        };
    }
    deleteBuffer(buffer) {
        // remove from binds?
    }
    bindBuffer(bind1, target) {
        this.bound[bind1] = target;
    }
    // size is in bytes
    bufferData(bind1, size, type) {
        let buffer = this.bound[bind1];

        // create Uint8, which allows us to manipulate bytes more directly
        buffer.arrayBuffer = new ArrayBuffer(size);
        buffer.byteLength = size;

        //console.log(this.bound);
    }
    // data will be Float32Array, but size will be in bytes
    // so we need to work around
    bufferSubData(bind1, writeOffset, data, readOffset, size) {
        // Uint8Array over the Float32Array's underlying buffer
        // so we can work with bytes directly
        let buffer1 = new Uint8Array(this.bound[bind1].arrayBuffer);
        let data1 = new Uint8Array( data.buffer );
        let size1 = size * data.BYTES_PER_ELEMENT;

        for (let i = 0; i < size1; i++) {
            buffer1[ writeOffset + i ] = data1[ readOffset + i ];
        }
        //console.log('input and final', data1, buffer1);
    }
    copyBufferSubData(readBind, writeBind, readOffset, writeOffset, size) {
        let buffer1 = new Uint8Array(this.bound[readBind].arrayBuffer);
        let buffer2 = new Uint8Array(this.bound[writeBind].arrayBuffer);
        
        // buffer1 and buffer2 should be Uint8Array, so we can work directly on bytes
        for (let i = 0; i < size; i++) {
            buffer2[ writeOffset + i ] = buffer1[ readOffset + i ];
        }
    }
}

// using this because we're handed ArrayBuffer objects from the client worker
function floatData(input) {
    let f = new Float32Array(input);
    return f.buffer;
}

/*
let chunks = {
    
    '32|32|32': {
        'position': {
            // need to deal in bytes
            'buffer': floatData([4, 5, 6]),
            // buffer may be larger than the data it holds,
            // treat offsetBytes as current length
            'offsetBytes': 12
        },
        'texcoord': {
            'buffer': floatData([-4, -5, -6]),
            'offsetBytes': 12
        }
    },
    '64|64|64': {
        'position': {
            // need to deal in bytes
            'buffer': floatData([7, 8, 9]),
            // buffer may be larger than the data it holds,
            // treat offsetBytes as current length
            'offsetBytes': 12
        },
        'texcoord': {
            'buffer': floatData([-4, -5, -6]),
            'offsetBytes': 12
        }
    }
};
*/

function compare(out, test) {

    test = new Uint8Array(test);

    for (let i = 0; i < out.byteSize; i++) {
        //console.log(test[i]);
        if (test[i] != out.buffer.data[i]) {
            console.log('FAIL', out, test);
            return false;
            break;
        }
    }
    console.log('ok');
}


let verify = function(v, out) {
    //console.log(out);
    for (let key in v) {
        let left = v[key];
        if (!(left instanceof ArrayBuffer)) {
            console.log('FAIL: Verify should be passed as first param');
            return;
        }
        left = new Float32Array(left);
        let right = new Float32Array(
            out[key].glBuffer.arrayBuffer,
            0,
            // length needs to be in terms of elements type
            out[key].offset / Float32Array.BYTES_PER_ELEMENT
        );

        //console.log( new Float32Array(out[key].glBuffer.arrayBuffer) );

        //console.log(left, right);
        if (!(key in out)) {
            console.log(key + ' not found in out');
        } else {
            if ( JSON.stringify(left) != JSON.stringify(right)) {
                console.log('oops');
            } else {
                console.log('ok');
            }
        }
    }
}


let tests = [
    {
        description: 'Adding 0|0|0 chunk with 3 values',
        fill: {
            chunkId: '0|0|0',
            mesh: {
                position: floatData([1,2,3]),
                texcoord: floatData([4,5])
            }
        },
        verify: {
            position: floatData([1,2,3]),
            texcoord: floatData([4,5])
        }
    },

    {
        description: 'Replacing 0|0|0 with 3 diff values',
        fill: {
            chunkId: '0|0|0',
            mesh: {
                position: floatData([4,5,6]),
                texcoord: floatData([6,7])
            }
        },
        verify: {
            position: floatData([4,5,6]),
            texcoord: floatData([6,7])
        }
    },

    {
        description: 'Replacing 0|0|0 with 4 values',
        fill: {
            chunkId: '0|0|0',
            mesh: {
                position: floatData([4,5,6,7]),
                texcoord: floatData([6,7,8])
            }
        },
        verify: {
            position: floatData([4,5,6,7]),
            texcoord: floatData([6,7,8])
        }
    },
    {
        description: 'Replacing 0|0|0 again with 4 different values',
        fill: {
            chunkId: '0|0|0',
            mesh: {
                position: floatData([8, 9, 10, 11]),
                texcoord: floatData([9, 10, 11])
            }
        },
        verify: {
            position: floatData([8, 9, 10, 11]),
            texcoord: floatData([9, 10, 11])
        }
    },

    {
        description: 'Add 0|32|32 chunk with 3 values',
        fill: {
            chunkId: '0|32|32',
            mesh: {
                position: floatData([20, 21, 22]),
                texcoord: floatData([20, 21])
            }
        },
        verify: {
            position: floatData([8, 9, 10, 11, 20, 21, 22]),
            texcoord: floatData([9, 10, 11, 20, 21])
        }
    },

    {
        description: 'Replacing 0|0|0 chunk again with 5 different values',
        fill: {
            chunkId: '0|0|0',
            mesh: {
                position: floatData([8, 9, 10, 11, 12]),
                texcoord: floatData([9, 10, 11, 12])
            }
        },
        verify: {
            position: floatData([20, 21, 22, 8, 9, 10, 11, 12]),
            texcoord: floatData([20, 21, 9, 10, 11, 12])
        }
    },

    {
        description: 'Add 32|32|32 with 3 values',
        fill: {
            chunkId: '32|32|32',
            mesh: {
                position: floatData([30,31,32]),
                texcoord: floatData([30,31])
            }
        },
        verify: {
            position: floatData([20, 21, 22, 8, 9, 10, 11, 12, 30, 31, 32]),
            texcoord: floatData([20, 21, 9, 10, 11, 12, 30, 31])
        }
    }
];

let gl = new GlStub();
// First test adding chunk data to Buf
let atlasBuffer = new AtlasBuffer(3, true, 6);


tests.forEach(function(test) {
    let out;
    console.log(test.description);
    if (test.fill) {
        atlasBuffer.fill( test.fill.chunkId, test.fill.mesh );
        atlasBuffer.update(gl);
        out = atlasBuffer.buffers();
        verify( test.verify, out );
    }
})
/*


}
b.fill('0|0|0', mesh);
b.update(gl);
out = b.glBuffers;
verify(v, out);
*/

/*
compare(out, floatData([1,2,3]));

console.log('Adding another chunk (should copy to new buffer)');
b.toShow('32|32|32', floatData([4,5,6]), 12);
out = b.update();
compare(out, floatData([1,2,3,4,5,6]));


console.log('Replacing first chunk data in-place');
b.toShow('0|0|0', floatData([7,8,9]), 12);
out = b.update();
compare(out, floatData([7,8,9,4,5,6]));

console.log('Removing first chunk');
b.toDelete('0|0|0');
out = b.update();
compare(out, floatData([4,5,6]));

console.log('Adding two chunks');
b.toShow('-32|-32|-32', floatData([10,11,12]), 12);
b.toShow('64|64|64', floatData([13,14,15]), 12);
out = b.update();
compare(out, floatData([4,5,6,10,11,12,13,14,15]));

console.log('Removing middle chunk');
b.toDelete('-32|-32|-32');
out = b.update();
compare(out, floatData([4,5,6,13,14,15]));
*/