module.exports = function(moduleName) {
    // From: https://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
    var log = Function.prototype.bind.call(console.log, console);

    return function() {
        var args = new Array(arguments.length + 1);
        args[0] = moduleName;
        for (var i = 0, len = arguments.length; i < len; i++) {
            args[i+1] = arguments[i];
        }
        log.apply(console, args);
    }
};