module.exports = function(batchSize) {
    var activeCount = 0;
    var pending = [];

    var debug = function() {
        return [batchSize, activeCount, pending.length].join(',');
    }

    var done = function() {
        activeCount--;
        //console.log('Done', debug());
        if (activeCount < batchSize && pending.length > 0) {
            activeCount++;
            //console.log('Running another', debug());
            pending.shift()(done);
        }
    };

    // Return function for user to call to add a function to the async queue
    // We pass a done callback to this function
    return function(op) {
        //console.log('New op', debug());
        if (activeCount < batchSize) {
            activeCount++;
            op(done);
            
        } else {
            pending.push(op);
        }
    };
};