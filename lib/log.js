module.exports = function(moduleName) {
    // From: https://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9
    var log = Function.prototype.bind.call(console.log, console);

	return function() {
        var args = Array.prototype.slice.apply(arguments);
        args.unshift(moduleName);
        log.apply(console, args);
	}
};