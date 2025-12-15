import { mat4, quat, vec3 } from 'gl-matrix';
import { Node } from './scene-graph.mjs';
import { Lines, LineStrip } from './lines.mjs';
import shapes from './shapes.mjs';

class Debugging {

    constructor(game) {
        this.game = game;
        this.view = mat4.create();

        // OMG i don't know how to hook ths up
        var stub = {
            render: function() {

            }
        };
        var stubView = mat4.create();
        this.scene = new Node(
            stub,
            stubView
        );

        this.updateCollisions(
            [
                [1,1,1]
            ]
        );

        // Add node for player bounds
        // with matrix being player position, somehow, but not rotation
        // Guess we can't do that

    }

    updateCollisions(collisions) {
        // collisions should be list of voxel positions player is colliding with
        // convert them to LInes, and prep for render

        console.log("num collisions: ", collisions.length);

        // Clear current nodes
        while (this.scene.children.length > 0) {
            this.scene.children.pop();
        }

        for (var lowerBound of collisions) {
            console.log("Lower bound collision", lowerBound);
            var upperBound = lowerBound.map((x) => x + 1);

            var test = new Lines(this.game, [255, 0, 0, 1]);
            test.fill(
                shapes.wire.cube(lowerBound, upperBound)
            );
            this.scene.addChild(
                test,
                test.view
            );

        }


        // Now add player bounding box
        var bounds = new LineStrip(this.game, [20, 20, 20, 1]);
        bounds.fill(
            this.game.player.movement.bounds.lines
        );
        // update view with player position
        console.log(this.game.player.movable.position);
        mat4.fromTranslation(bounds.view, this.game.player.movable.position);
        this.scene.addChild(
            bounds,
            bounds.view
        );

    }

    render(parentMatrix, ts, delta) {
        this.scene.render(parentMatrix, ts, delta);
    }

}

export { Debugging };