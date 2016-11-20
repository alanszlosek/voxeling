// Encoder
var encode = function(input) {
    var out = [];
    var previous = input[0];
    var count = 1;
    out.push(previous);
    for (var i = 1; i < input.length; i++) {
        var value = input[i];
        if (previous != value) {
            out.push(count);
            out.push(value);
            previous = value;
            count = 1;
        } else {
            count++;
        }
    }
    out.push(count);
    return out;
};

module.exports = encode;