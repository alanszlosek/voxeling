import { mat4, quat, vec3 } from 'gl-matrix';

import { Movable } from './capabilities/movable.mjs';
import scratch from './scratch.mjs';

class Camera {
    constructor(game) {
        let self = this;

        this.game = game;

        this.movable = new Movable();

        // the camera manages some matrices used to render our scene
        // more info: https://jsantell.com/model-view-projection/
        // projection is used to transform points to clip/screen space, in perspective fashion
        this.projectionMatrix = mat4.create();
        // this contains the camera's position in coordinate space
        // you can think of it as the camera's model matrix
        this.modelMatrix = mat4.create();
        // this is an inverse of the model matrix
        // it transforms vertices from world space to camera/view space
        this.viewMatrix = mat4.create();
        // just a helper handle to make it clear view is the inverse
        this.inverseMatrix = this.viewMatrix;

        this.verticalFieldOfView = Math.PI / 4;
        this.ratio;
        // 32 * 20 = 640 ... 20 chunks away
        this.farDistance = 640; //2000; // three.JS uses 2000, not 640

        // values from three.js
        /*
        constructor( fov = 50, aspect = 1, near = 0.1, far = 2000 ) {
        this.fov = fov;
		this.zoom = 1;

		this.near = near;
		this.far = far;
		this.focus = 10;

		this.aspect = aspect;
        */



        this.canvas = game.userInterface.webgl.canvas;
        this.canvasResized();
    }


    // TODO: this doesn't work yet
    canvasResized() {
        this.ratio = this.canvas.clientWidth / this.canvas.clientHeight;
        
        // Adjusts coordinates for the screen's aspect ration
        // Not sure to set near and far to ... seems arbitrary. Surely those values should match the frustum

        // I used to use Math.PI / 4 for vertical FOV
        // Three.JS defaults to 50 degrees = 0.87 radians
        // A demo defaulted to 30
        // for some reason everything feels abnormal today
        this.verticalFieldOfView = Math.PI / 5;
        mat4.perspective(this.projectionMatrix, this.verticalFieldOfView, this.ratio, 0.1, this.farDistance);
    }

    // TODO: rename this method?
    updateProjection() {
        // CREATE INVERSE MATRIX FOR RENDERING THE WORLD AROUND THE CAMERA
        mat4.fromRotationTranslation(this.modelMatrix, this.movable.rotationQuat, this.movable.position); //getRotationQuat(), this.position);
        mat4.invert(this.viewMatrix, this.modelMatrix);
        // nope, let's do this in the shader ... gives us more shader flexibility
        //mat4.multiply(this.inverse, this.projection, this.inverse);
    }
}

export { Camera };
