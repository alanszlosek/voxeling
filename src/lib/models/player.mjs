import { mat4, quat, vec3 } from 'gl-matrix';
import scratch from '../scratch.mjs';
import Shapes from '../shapes';
import { MovableCollidable } from '../entities/movable-collidable';
import { Model } from '../entities/model';

class Player extends MovableCollidable {
    constructor(game) {
        super();
        this.game = game;
    }

    setup() {
        let gl = this.game.userInterface.webgl.gl;
        let shader = this.game.userInterface.webgl.shaders.projectionViewPosition; //2;
        let texture = this.game.textureAtlas.byName['player'];
        let avatar = 'player';

        var self = this;
        // TODO: this really should respond like a head tilt
        this.eyeOffset = vec3.fromValues(0, 1.25, -0.5);
        this.eyePosition = vec3.create();

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


        shape = Shapes.three.rectangle(0.33, 0.35, 0.33, uvCoordinates.head, 64);
        shape.part = 0;
        shape.pitch = 0;
        shape.render = function(gl, ts) {
            this.rotation[0] = self.pitch / 57.29; // radian is 57.29 degrees
        };
        mat4.translate(shape.view, shape.view, [0, 1.12, 0]);
        meshes.push(shape);

        // 4, 12, 8
        // out of 32
        shape = Shapes.three.rectangle(0.33, 0.5, 0.2, uvCoordinates.body, 64);
        shape.part = 1;
        mat4.translate(shape.view, shape.view, [0, 0.68, 0]);
        meshes.push(shape);

        shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.leftArm, 64);
        shape.part = 2;
        shape.render = function(gl, ts) {
            if (self.isMoving) {
                this.rotation[0] = Math.cos(0.6662 * (ts/walkAnimationSpeed));
            } else {
                this.rotation[0] = 0;
            }
        };
        shape.rotateAround[1] = 0.25;
        mat4.rotateZ(shape.view, shape.view, -0.1);
        mat4.translate(shape.view, shape.view, [-0.33, 0.62, 0]);
        meshes.push(shape);

        shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.rightArm, 64);
        shape.part = 2;
        shape.render = function(gl, ts) {
            if (self.isMoving) {
                this.rotation[0] = -Math.cos(0.6662 * (ts/walkAnimationSpeed));
            } else {
                this.rotation[0] = 0;
            }
            
        };
        shape.rotateAround[1] = 0.25;
        mat4.rotateZ(shape.view, shape.view, 0.1);
        mat4.translate(shape.view, shape.view, [0.33, 0.62, 0]);
        meshes.push(shape);

        shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.leftLeg, 64);
        shape.part = 3;
        shape.render = function(gl, ts) {
            if (self.isMoving) {
                this.rotation[0] = -Math.cos(0.6662 * (ts/walkAnimationSpeed));
            } else {
                this.rotation[0] = 0;
            }
            
        };
        shape.rotateAround[1] = 0.25;
        mat4.translate(shape.view, shape.view, [-0.09, 0.2, 0]);
        meshes.push(shape);

        shape = Shapes.three.rectangle(0.16, 0.5, 0.16, uvCoordinates.rightLeg, 64);
        shape.part = 3;
        shape.render = function(gl, ts) {
            if (self.isMoving) {
                this.rotation[0] = Math.cos(0.6662 * (ts/walkAnimationSpeed));
            } else {
                this.rotation[0] = 0;
            }
            
        };
        shape.rotateAround[1] = 0.25;
        mat4.translate(shape.view, shape.view, [0.09, 0.2, 0]);
        meshes.push(shape);

        this.model = new Model(gl, shader, meshes, texture, this, this.game.camera.inverse, this);

        this.translate(this.game.config.initialPosition);
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
        let textures = {
            'player': 0,
            'substack': 1,
            'viking': 2
        }
        this.model.setTextureUnit( textures[texture] );
        this.avatar = texture;
    }

    tick() {
        this.updateQuat();
        vec3.transformQuat(this.eyePosition, this.eyeOffset, this.rotationQuatY);
        vec3.add(this.eyePosition, this.eyePosition, this.position);
    }

    destroy() {
        this.model.destroy();
    }
}

export { Player };
