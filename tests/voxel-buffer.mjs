import { Buf } from '../src/lib/voxels.mjs';

// testing new buffer copy code from src/lib/voxels.mjs

class GlStub {
    ARRAY_BUFFER = 0;
    COPY_READ_BUFFER = 1;
    constructor() {
        this.bound = [];
    }
    createBuffer() {
        return {
            data: null,
            byteLength: 0
        };
    }
    deleteBuffer(buffer) {
        // remove from binds?
    }
    bindBuffer(bind1, target) {
        this.bound[bind1] = target;
    }
    bufferData(bind1, size, type) {
        let buffer = this.bound[bind1];
        
        // size is in bytes here, which the GPU expects
        buffer.data = new Array(size);
        // TODO: unsure whether we need to deal with bytes or not
        buffer.byteLength = size;
    }
    bufferSubData(bind1, writeOffset, data, readOffset, size) {
        let buffer1 = this.bound[bind1];
        //console.log('Coping into buffer', data, readOffset, size);
        // treat float bytes as Int8 so we can copy each byte
        data = new Int8Array(data);
        for (let i = 0; i < size; i++) {
            buffer1.data[ writeOffset + i ] = data[ readOffset + i ];
        }
    }
    copyBufferSubData(readBind, writeBind, readOffset, writeOffset, size) {
        let buffer1 = this.bound[readBind];
        let buffer2 = this.bound[writeBind];
        //console.log('Copying from to:', buffer1, buffer2.data);
        for (let i = 0; i < size; i++) {
            buffer2.data[ writeOffset + i ] = buffer1.data[ readOffset + i ];
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

    test = new Int8Array(test);

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
let gl = new GlStub();

// First test adding chunk data to Buf
let b = new Buf(gl);

let out;

console.log('Adding first chunk');
b.toShow('0|0|0', floatData([1,2,3]), 12);
out = b.update();
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
