var Textures = function(textureArray) {
    this.textureArray = textureArray;
    this.byName = {};
    this.byValue = {};

    // Prepare name and value mapping
    for (var i = 0; i < textureArray.length; i++) {
        var texture = textureArray[i];
        this.byValue[texture.value] = texture;
        this.byName[texture.name] = texture;
    }
    
};

// TODO: modify this to annotate the original data structure with buffer and image object
Textures.prototype.load = function(gl, callback) {
    var toLoad = this.textureArray.length;
    // skip null (empty block) texture
    var done = function() {
        toLoad--;
        if (toLoad == 0) {
            callback();
        }
    };
    var textureClosure = function(texture) {
        return function() {
            gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
            // mipmap when scaling down
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
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
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    for (var i = 0; i < this.textureArray.length; i++) {
        var texture = this.textureArray[i];
        // Is this a cube of different textures?
        if ('sides' in texture) {
            // all the sides must be loaded independently
            done();
        } else {
            texture.glTexture = gl.createTexture();
            texture.image = new Image();
            // Need closure here, to wrap texture
            texture.image.onload = textureClosure(texture);
            texture.image.crossOrigin = 'Anonymous';
            texture.image.src = texture.src;
        }
    }
};

module.exports = Textures;