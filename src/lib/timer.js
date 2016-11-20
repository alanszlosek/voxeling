var items = {};

module.exports = {
    log: function(name, time) {
        var item;
        if (name in items) {
            item = items[name];

            item.min = Math.min(item.min, time);
            item.max = Math.max(item.max, time);
            item.sum += time;
            item.count++;
            item.average = item.sum / item.count;
        } else {
            item = {
                min: time,
                max: time,
                sum: time,
                count: 1,
                average: time
            };
            items[name] = item;
        }
    },

    // Called on an interval
    print: function() {
        for (var i in items) {
            var item = items[i];
            console.log(i, 'milliseconds', item);
        }
    }
};