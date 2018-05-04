var Textures = function(textureMeta, players) {
    this.textureOffsets = textureMeta;
    this.players = players;

    this.byName = {};
    this.byValue = {};

    /*
    // Prepare name and value mapping
    for (var i = 0; i < textureArray.length; i++) {
        var texture = textureArray[i];
        this.byValue[texture.value] = texture;
        this.byName[texture.name] = texture;
    }
    */

};

// TODO: modify this to annotate the original data structure with buffer and image object
Textures.prototype.load = function(gl, callback) {
    var self = this;
    var toLoad = 4;
    // skip null (empty block) texture
    var done = function() {
        toLoad--;
        if (toLoad == 0) {
            callback();
        }
    };
    var textureClosure = function(glTexture,  image) {
        return function() {
            gl.bindTexture(gl.TEXTURE_2D, glTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            // mipmap when scaling down
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
            // linear when scaling up
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.generateMipmap(gl.TEXTURE_2D);

            done();
        };
    };

    // Pre-multiply so opacity works correctly
    // http://www.realtimerendering.com/blog/gpus-prefer-premultiplication/
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    // PNGs require this
    //gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    // Load combined texture file
    var glTexture = gl.createTexture();
    var image = new Image();
    // Need closure here, to wrap texture
    image.onload = textureClosure(glTexture, image);
    image.crossOrigin = 'Anonymous';
    image.src = '/textures.png';
    self.byValue[0] = glTexture;

    // Load player textures
    for (var value in this.players) {
        var texture = this.players[value];
        var glTexture = gl.createTexture();
        var image = new Image();
        // Need closure here, to wrap texture
        image.onload = textureClosure(glTexture, image);
        image.crossOrigin = 'Anonymous';
        image.src = texture.src;
        self.byValue[value] = glTexture;
        self.byName[ texture.name ] = glTexture;
    }
};

module.exports = Textures;