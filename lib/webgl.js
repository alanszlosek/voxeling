function Core(canvas) {
    var gl;
    gl = canvas.getContext("experimental-webgl");
    // If we don't have a GL context, give up now
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser may not support it.");
        return;
    }
    this.canvas = canvas;
    this.gl = gl;
    this.renderCallback = function() {};

    gl.enable(gl.DEPTH_TEST);
    // if our fragment has a depth value that is less than the one that is currently there, use our new one
    gl.depthFunc(gl.LESS);
    
    // TODO: resize events might need to call this again
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}

Core.prototype.start = function() {
    this.render();
};

Core.prototype.render = function() {
    var self = this;
    var gl = this.gl;

    //this.gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    this.renderCallback();

    requestAnimationFrame(this.render.bind(this));
};

Core.prototype.onRender = function(callback) {
    this.renderCallback = callback;
};

Core.prototype.addRenderable = function(obj) {
    this.renderables.push(obj);
};

module.exports = Core;