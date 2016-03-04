var activeCount = 0;
var pending = [];
var maxFilesInFlight = 100; // Set this value to some number that's safe for your system


module.exports = {
    operation: function(op) {
        if (activeCount < maxFilesInFlight) {
            activeCount++;
            op();
        } else {
            pending.push(op);
        }
    },
    callback: function(cb) {
        return function() {
            activeCount--;
            cb.apply(null, Array.prototype.slice.call(arguments));
            if (activeCount < maxFilesInFlight && pending.length){
                console.log("Processing Pending read/write");
                activeCount++;
                pending.shift()();
            }
        };
    }
};