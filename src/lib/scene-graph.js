var glm = require('gl-matrix'),
    vec3 = glm.vec3,
    vec4 = glm.vec4,
    mat4 = glm.mat4,
    quat = glm.quat;

// http://webglfundamentals.org/webgl/lessons/webgl-scene-graph.html

var Node = function(gl, model) {
    this.gl = gl;
    this.children = [];
    this.model = model;

    this.localMatrix = mat4.create();
    this.worldMatrix = mat4.create();
};

// setParent helps us prevent a child from being added to multiple parents
/*
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
*/
Node.prototype.addChild = function(node) {
    this.children.push(node);
};

// Update 
Node.prototype.tick = function(parentWorldMatrix, ts) {
    this.model.tick(parentWorldMatrix, ts);

    for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        // Don't really like that this reaches in
        child.tick(this.model.worldMatrix, ts);
    }
};

Node.prototype.render = function(ts) {
    // Now render this item?
    this.model.render(ts);

    for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        child.render(ts);
    }
};


module.exports = {
    Node: Node
};
