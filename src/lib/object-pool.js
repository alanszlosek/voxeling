var pool = {};

// Don't really need to keep track of those I've allocated, do I?
var bytes = 0;

var mallocs = 0;

var news = 0;

var frees = 0;

var create = function(type, size) {
    news++;
    switch (type) {
      case 'float32':
        return new Float32Array(size);

      case 'uint8':
        return new Uint8Array(size);
      
      // Generic array of 3 elements
      case 'array':
        return new Array(size);
    }
    throw new Exception('Unexpected type: ' + type);
};

var getSize = function(type, o) {
    switch (type) {
      case 'float32':
      case 'uint8':
      case 'array':
        return o.length;
    }
    // unknown
    return 0;
};

module.exports = {
    malloc: function(type, size) {
        var current;
        var o;
        mallocs++;
        if (type in pool) {
            current = pool[type];
            // Any types of this size available?
            if (size in current && current[size].length > 0) {
                o = current[size].pop();
                bytes -= getSize(type, o);
                return o;
            } else {
                current[size] = [];
            }
        } else {
            current = pool[type] = {};
            current[size] = [];
        }
        return create(type, size);
    },
    free: function(type, o) {
        var size = getSize(type, o);
        pool[type][size].push(o);
        bytes += size;
        frees++;
    },
    // Return number of bytes in the pool. If it's high, perhaps we want to free these items manually
    bytesAvailable: function() {
        return bytes;
    },
    stats: function() {
        return 'mallocs: ' + mallocs + ' news: ' + news + ' frees: ' + frees + ' bytesInPool: ' + bytes;
    },
    // Give it up to the garbage collector
    clear: function() {
        bytes = 0;
        pool = {};
    }
};