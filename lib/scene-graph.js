var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

// http://webglfundamentals.org/webgl/lessons/webgl-scene-graph.html

var Node = function(gl) {
    this.gl = gl;
	this.children = [];
	this.localMatrix = mat4.create();
	this.worldMatrix = mat4.create();
};

Node.prototype.setParent = function(parent) {
    // remove us from our parent
    if (this.parent) {
        var ndx = this.parent.children.indexOf(this);
        if (ndx >= 0) {
            this.parent.children.splice(ndx, 1);
        }
    }

    // Add us to our new parent
    if (parent) {
        parent.children.append(this);
    }
    this.parent = parent;
};

Node.prototype.render = function(projection) {
    if (parentWorldMatrix) {
        // a matrix was passed in so do the math and
        // store the result in `this.worldMatrix`.
        matrixMultiply(this.localMatrix, projection, this.worldMatrix);
    } else {
        // no matrix was passed in so just copy.
        mat4.copy(this.localMatrix, projection);
    }

    // Now render this item?
    this.model.render(this.worldMatrix);

    // now process all the children
    var worldMatrix = this.worldMatrix;
    this.children.forEach(function(child) {
        child.updateWorldMatrix(worldMatrix);
    });
};


module.exports = {
    Node: Node
};