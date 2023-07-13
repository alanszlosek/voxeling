import { mat4, quat, vec3 } from 'gl-matrix';
import { Meshes } from '../capabilities/meshes.mjs';
import { Node } from '../scene-graph.mjs';
import Shapes from '../shapes.mjs';
import scratch from '../scratch.mjs';

class Dragon  {
    orbitVec3 = vec3.fromValues(8, 0, 0);
    rotateY = 0.00;

    constructor(game, modelMatrix, movable) {
        let self = this;
        this.game = game;
        this.gl = game.gl;
        this.matrix = modelMatrix;
        this.movable = movable;
        this.enabled = true;

        this.meshes = new Meshes(game);
        this.meshes.withPreRender(function(parentMatrix, ts, delta) {
            // adjust rotation
            //console.log(self.orbitVec3);
            let speed = 0.4;
            let r = speed * delta;
            vec3.rotateY(self.orbitVec3, self.orbitVec3, scratch.zeroVec3, r);

            vec3.add(scratch.vec3, self.movable.position, self.orbitVec3);
            
            self.rotateY += r;
            mat4.translate(this.matrix, scratch.identityMat4, scratch.vec3);
            mat4.rotateY(this.matrix, this.matrix, self.rotateY);

            /*
            vec3.rotateY(scratch.vec3, this.orbitVec3, scratch.zeroVec3, ts / speed);
            // Raise dragon up above the ground
            scratch.vec3[1] = 15
    
            //this.movable.rotateY( ts / speed );
            this.movable.copyTranslation(scratch.vec3);
            this.movable.update();
            */
    
        });
        this.node = new Node(this.meshes, modelMatrix);

        this.initMeshes();
    }

    initMeshes() {
        // what if textures span multiple atlases? need to separate those buffer bundles
        let body = 0.5;
        let neck = 0.4;
        let head = 0.3;
        let tail = 0.3;
        let horns = 0.1;


        let textureValue;
        let textureY;
        let height;
        let texcoords;
        let textureUnit; // which textureAtlas to use for meshes
        let meshes;

        // TODO: what if pink and red shift texture atlases? this needs to be more durable
        textureValue = 38;
        // TODO: these should be pre-computed in texture-atlas.py
        textureY = this.game.textureOffsets['offsets'][ textureValue ];
        height = this.game.textureOffsets['textureRowHeight'];
        // lower left, upper right in texture map
        let texcoords1 = [0, textureY, 1, textureY + height];
        textureUnit = this.game.textureOffsets['textureToTextureUnit'][ textureValue ];

        // center
        this.meshes.addMeshes(
            textureUnit,
            [
                Shapes.three.rectangle3(0.6, body, 1.2, texcoords1, [0, 0.5, 0]),
                Shapes.three.rectangle3(0.2, 0.4, 0.2, texcoords1, [-0.4, 0.1, -0.5]),
                Shapes.three.rectangle3(0.2, 0.4, 0.2, texcoords1, [0.4, 0.1, -0.5]),
                Shapes.three.rectangle3(0.2, 0.4, 0.2, texcoords1, [-0.4, 0.1, 0.5]),
                Shapes.three.rectangle3(0.2, 0.4, 0.2, texcoords1, [0.4, 0.1, 0.5])
            ]
        );

        // neck
        this.meshes.addMesh(
            textureUnit,
            Shapes.three.rectangle3(0.3, 0.6, 0.3, texcoords1, [0, 0.75, -0.75])
        );

        // horns
        this.meshes.addMeshes(
            textureUnit,
            [
                Shapes.three.rectangle3(horns, 0.4, horns, texcoords1, [-0.1, 1.45, -1.2]),
                Shapes.three.rectangle3(horns, 0.4, horns, texcoords1, [0.1, 1.45, -1.2])
            ]
        );

        // tail
        this.meshes.addMeshes(
            textureUnit,
            [
                Shapes.three.rectangle3(0.4, 0.3, 0.6, texcoords1, [0, 0.4, 0.9]),
                Shapes.three.rectangle3(0.25, 0.2, 0.6, texcoords1, [0, 0.6, 1.5])
            ]
        );


        // pink
        textureValue = 37;
        textureY = this.game.textureOffsets['offsets'][ textureValue ]; 
        // lower left, upper right in texture map
        let texcoords2 = [0, textureY, 1, textureY + height];

        // wings
        this.meshes.addMeshes(
            textureUnit,
            [
                Shapes.three.rectangle3(0.8, 0.1, 0.6, texcoords2, [-0.5, 0.8, 0]),
                Shapes.three.rectangle3(0.8, 0.1, 0.6, texcoords2, [0.5, 0.8, 0]),

            ]
        );

        // head
        this.meshes.addMesh(
            textureUnit,
            Shapes.three.rectangle3(head, head, 0.5, texcoords2, [0, 1.1, -1.15])
        );

        this.meshes.prepare();
    }
}

export { Dragon };
