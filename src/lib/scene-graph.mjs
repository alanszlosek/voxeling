import { mat4 } from 'gl-matrix';
import { Renderable } from './ecs/renderable.mjs';
import { Tickable } from './ecs/tickable.mjs';

// http://webglfundamentals.org/webgl/lessons/webgl-scene-graph.html

class Node extends Renderable {
    constructor(gl, model) {
        super()
        this.gl = gl;
        this.children = [];
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

    // Update 
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

export { Node };