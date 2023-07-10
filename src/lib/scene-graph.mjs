import { mat4 } from 'gl-matrix';
import { Renderable } from './capabilities/renderable.mjs';

// http://webglfundamentals.org/webgl/lessons/webgl-scene-graph.html


/*
TODO: find a way to more seamlessly merge Model and these RootNode / Node classes
*/

class RootNode extends Renderable {
    constructor(gl, model) {
        super()
        this.gl = gl;
        this.children = [];

        // TODO: I don't really like this pattern of passing in a model. it works, but it kinda sucks
        this.model = model;

        this.localMatrix = mat4.create();
        this.worldMatrix = mat4.create();
    };

    // setParent helps us prevent a child from being added to multiple parents
    /*
    setParent(parent) {
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
    addChild(node) {
        this.children.push(node);
    };

    tick(parentWorldMatrix, ts) {
        this.model.tick(parentWorldMatrix, ts);

        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            // Don't really like that this reaches in
            child.tick(this.model.worldMatrix, ts);
        }
    };

    render(ts) {
        // Now render this item?
        this.model.render(ts);

        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.render(ts);
        }
    };
}

// Node is not Renderable, since it's up to the Root and each subsequent parent node to initiate tick() and render(),
// using the appropriate transformation/rotation matrix
class Node {
    constructor(gl, model) {
        this.gl = gl;
        this.children = [];
        this.model = model;

        this.localMatrix = mat4.create();
        this.worldMatrix = mat4.create();
    };

    addChild(node) {
        this.children.push(node);
    };

    tick(parentWorldMatrix, ts) {
        this.model.tick(parentWorldMatrix, ts);

        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            // Don't really like that this reaches in
            child.tick(this.model.worldMatrix, ts);
        }
    };

    render(ts) {
        // Now render this item?
        this.model.render(ts);

        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.render(ts);
        }
    };
}



class Node2 {
    constructor(renderable, matrix) {
        if (!renderable || !renderable.render) {
            throw new Error('First parameter to Node must have render()');
        }
        /*

        if (!movable || !movable.matrix) {
            throw new Error('Second parameter to Node must have a matrix field of type mat4');
        }
        */

        this.children = [];
        this.renderable = renderable;
        this.matrix = matrix;

        this.tempMatrix = mat4.create();
    };

    // Accepts anything with a render() method
    addChild(node) {
        this.children.push(node);
    };

    render(parentMatrix, ts, delta) {
        mat4.multiply(this.tempMatrix, parentMatrix, this.matrix);
        //console.log(this.tempMatrix);

        this.renderable.render(this.tempMatrix, ts, delta);

        for (var i = 0; i < this.children.length; i++) {
            var child = this.children[i];
            child.render(this.tempMatrix, ts, delta);
        }
    };
}

export { RootNode, Node, Node2 };