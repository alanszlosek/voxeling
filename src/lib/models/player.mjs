import { mat4, quat, vec3 } from 'gl-matrix';
import scratch from '../scratch.mjs';
import Shapes from '../shapes.mjs';
import { Meshes } from '../capabilities/meshes.mjs';
import { Node } from '../scene-graph.mjs';

// WARNING: REFACTOR IN PROGRESS HERE

class Player {
    constructor(game, movable) {
        this.game = game;
        this.currentVelocityLength = 0;

        let gl = this.game.gl;
        let texture = this.game.textureAtlas.byName['player'];
        let avatar = 'player';

        var self = this;
        this.movable = movable;

        var uvCoordinates = {
            head: [
                //x  y   w   h
                24,  16,  8,  8, // back
                8,  16,  8,  8, // front
                8,  24,  8,  8, // top
                16,  24,  8,  8, // bottom
                16,  16,  8,  8, // left
                0,  16,  8,  8 // right
            ],
            body: [
                32,  0,  8, 12, // back
                20,  0,  8, 12, // front
                20, 12,  8,  4, // top
                28, 12,  8,  4, // bottom
                28,  0,  4, 12, // left
                32,  0, -4, 12  // right
            ],
            rightArm: [
                52,  0,  4, 12, // back
                44,  0,  4, 12, // front
                44, 12,  4,  4, // top
                48, 12,  4,  4, // bottom
                48,  0,  4, 12, // left
                40,  0,  4, 12 // right
            ],

            leftArm: [
                44,  0,  4, 12, // back
                52,  0,  4, 12, // front
                44, 12,  4,  4, // top
                48, 12,  4,  4, // bottom
                40,  0,  4, 12, // left
                48,  0,  4, 12 // right
            ],

            rightLeg: [
                12,  0,  4, 12, // back
                4,  0,  4, 12,
                12, 12, -4,  4, // top
                8, 12, -4,  4,
                8,  0,  4, 12, // left
                0,  0,  4, 12 // right
            ],
            leftLeg: [
                12,  0,  4, 12, // back
                4,  0,  4, 12,
                12, 12, -4,  4, // top
                8, 12, -4,  4,
                8,  0,  4, 12, // left
                0,  0,  4, 12 // right
            ]
        };


        var meshes=[];
        var shape;
        var armRotation = 0.6662;
        var walkAnimationSpeed = 70;
        let scale = 7.4;

        this.moving = true;
        
        /*
        shape = Shapes.three.rectangle(0.33, 0.35, 0.33, uvCoordinates.head, 64);
        shape.part = 0;
        shape.pitch = 0;
        shape.render = function(gl, ts) {
            this.rotation[0] = self.pitch / 57.29; // radian is 57.29 degrees
        };
        mat4.translate(shape.view, shape.view, [0, 1.12, 0]);
        meshes.push(shape);
        */

        this.head = new Meshes(this.game);
        this.head.addMesh(
           // don't know
           0,
           Shapes.three.rectangle(0.33, 0.35, 0.33, uvCoordinates.head, 64)
        );
        mat4.translate(this.head.matrix, this.head.matrix, [0, 0.72, 0]);
        this.head.withPreRender(function(parentMatrix, ts, delta) {
            // handle head tilt here
            //console.log(parentMatrix);
        });

        /*
        // 4, 12, 8
        // out of 32
        shape = Shapes.three.rectangle(0.33, 0.5, 0.2, uvCoordinates.body, 64);
        shape.part = 1;
        mat4.translate(shape.view, shape.view, [0, 0.68, 0]);
        meshes.push(shape);
        */

        this.body = new Meshes(this.game);
        this.body.addMesh(
           // don't know
           0,
           Shapes.three.rectangle(0.33, 0.5, 0.2, uvCoordinates.body, 64)
        );
        mat4.translate(this.body.matrix, this.body.matrix, [0, 0.5, 0]);
        this.body.withPreRender(function(parentMatrix, ts, delta) {
            // handle head tilt here
            //console.log('here');
        });

        /*
        shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.leftArm, 64);
        shape.part = 2;
        shape.render = function(gl, ts) {
            if (self.isMoving) {
                // TODO: this is not quite right ... jumps when speed changes. need lerping or something
                this.rotation[0] = Math.cos((ts/scale) * self.game.player.currentVelocityLength);
            } else {
                this.rotation[0] = 0;
            }
        };
        shape.rotateAround[1] = 0.25;
        mat4.rotateZ(shape.view, shape.view, -0.1);
        mat4.translate(shape.view, shape.view, [-0.33, 0.62, 0]);
        meshes.push(shape);
        */
        this.leftArm = new Meshes(this.game);
        this.leftArm.addMesh(
           // don't know
           0,
           Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.leftArm, 64)
        );
        mat4.translate(this.leftArm.matrix, this.leftArm.matrix, [-0.13, 0.50, 0]);
        this.leftArm.rotateAround = vec3.fromValues(0, 0.25, 0);
        this.leftArm.rotation = vec3.fromValues(0, 0, 0);
        this.leftArm.rotation1 = mat4.create();
        this.leftArm.rotation2 = mat4.create();
        this.leftArm.withPreRender(function(parentMatrix, ts, delta) {
            // handle head tilt here
            //console.log('here');
            return;
            let scale = 0.000005;
            if (self.moving) {
                this.rotation[0] = 0.001; //Math.cos((ts/scale));

                mat4.translate(this.rotation1, scratch.identityMat4, this.rotateAround);
                mat4.translate(this.rotation2, scratch.identityMat4, [-this.rotateAround[0], -this.rotateAround[1], -this.rotateAround[2]]);
                mat4.multiply(this.matrix, this.rotation1, this.matrix);
                mat4.rotateX(this.matrix, this.matrix, this.rotation[0]);
                mat4.multiply(this.matrix, this.matrix, this.rotation2);
                //mat4.multiply(this.matrix, this.movable.matrix, this.view);
            }

        });


        /*


        shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.rightArm, 64);
        shape.part = 2;
        shape.render = function(gl, ts) {
            if (self.isMoving) {
                //this.rotation[0] = -Math.cos(0.6662 * (ts/walkAnimationSpeed));
                this.rotation[0] = -Math.cos((ts/scale) * self.game.player.currentVelocityLength);
            } else {
                this.rotation[0] = 0;
            }
            
        };
        shape.rotateAround[1] = 0.25;
        mat4.rotateZ(shape.view, shape.view, 0.1);
        mat4.translate(shape.view, shape.view, [0.33, 0.62, 0]);
        meshes.push(shape);
        */

        this.rightArm = new Meshes(this.game);
        this.rightArm.addMesh(
           // don't know
           0,
           Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.rightArm, 64)
        );
        mat4.translate(this.rightArm.matrix, this.rightArm.matrix, [0.13, 0.50, 0]);
        this.rightArm.withPreRender(function(parentMatrix, ts, delta) {
            // handle head tilt here
            //console.log('here');
        });

        /*

        shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.leftLeg, 64);
        shape.part = 3;
        shape.render = function(gl, ts) {
            if (self.isMoving) {
                //this.rotation[0] = -Math.cos(0.6662 * (ts/walkAnimationSpeed));
                this.rotation[0] = -Math.cos((ts/scale) * self.game.player.currentVelocityLength);
            } else {
                this.rotation[0] = 0;
            }
        };
        shape.rotateAround[1] = 0.25;
        mat4.translate(shape.view, shape.view, [-0.09, 0.2, 0]);
        meshes.push(shape);

        */

        this.leftLeg = new Meshes(this.game);
        this.leftLeg.addMesh(
           // don't know
           0,
           Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.leftLeg, 64)
        );
        
        mat4.translate(this.leftLeg.matrix, this.leftLeg.matrix, [-0.05, 0.25, 0]);
        this.leftLeg.withPreRender(function(parentMatrix, ts, delta) {
            // handle head tilt here
            //console.log('here');
        });

        /*

        shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.rightLeg, 64);
        shape.part = 3;
        shape.render = function(gl, ts) {
            if (self.isMoving) {
                //this.rotation[0] = Math.cos(0.6662 * (ts/walkAnimationSpeed));
                this.rotation[0] = Math.cos((ts/scale) * self.game.player.currentVelocityLength);
            } else {
                this.rotation[0] = 0;
            }
            
        };
        shape.rotateAround[1] = 0.25;
        mat4.translate(shape.view, shape.view, [0.09, 0.2, 0]);
        meshes.push(shape);

        this.model = new Model(this.game, gl, shader, meshes, texture, movable);
        */

        this.rightLeg = new Meshes(this.game);
        this.rightLeg.addMesh(
           // don't know
           0,
           Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.rightLeg, 64)
        );
        
        mat4.translate(this.rightLeg.matrix, this.rightLeg.matrix, [0.05, 0.25, 0]);
        this.rightLeg.withPreRender(function(parentMatrix, ts, delta) {
            // handle head tilt here
            //console.log('here');
        });



        this.head.prepare();
        this.body.prepare();
        this.leftArm.prepare();
        this.rightArm.prepare();
        this.leftLeg.prepare();
        this.rightLeg.prepare();

        this.node = new Node(this, this.movable.matrix);
        this.node.addChild(
            new Node(this.head, this.head.matrix)
        );
        this.node.addChild(
            new Node(this.body, this.body.matrix)
        );
        this.node.addChild(
            new Node(this.leftArm, this.leftArm.matrix)
        );
        this.node.addChild(
            new Node(this.rightArm, this.rightArm.matrix)
        );
        this.node.addChild(
            new Node(this.leftLeg, this.leftLeg.matrix)
        );
        this.node.addChild(
            new Node(this.rightLeg, this.rightLeg.matrix)
        );
    }

    init() {
        // TODO: do I really need to delay setup on startup?
        this.setup();
        return Promise.resolve();
    }

    translate(vector) {
        vec3.add(this.position, this.position, vector);
        // TODO: perhaps move this calculation to tick
        //vec3.add(this.eyePosition, this.position, this.eyeOffset);
    }

    setTranslation(x, y, z) {
        vec3.copy(this.position, arguments);
        //vec3.add(this.eyePosition, this.position, this.eyeOffset);
    }

    getEyeOffset() {
        return this.eyeOffset;
    }

    getEyePosition() {
        return this.eyePosition;
    }

    setTexture(texture) {
        if (this.avatar != texture) {
            let textures = {
                'player': 0,
                'substack': 1,
                'viking': 2
            }
            this.model.setTextureUnit( textures[texture] );
            this.avatar = texture;
        }
    }

    render() {

    }

    destroy() {
        this.model.destroy();
    }
}

export { Player };
