import { Meshes } from '../capabilities/meshes.mjs';
import { Node2 } from '../scene-graph.mjs';
import Shapes from '../shapes.mjs';


class Dragon  {
    constructor(game, modelMatrix) {
        this.game = game;
        this.gl = game.gl;
        this.matrix = modelMatrix;
        this.enabled = true;

        this.meshes = new Meshes(game);
        this.node = new Node2(this.meshes, modelMatrix);

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
