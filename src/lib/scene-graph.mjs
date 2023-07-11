import { mat4 } from 'gl-matrix';

// http://webglfundamentals.org/webgl/lessons/webgl-scene-graph.html


class Node {
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

export { Node };