


class GenOFI {
    constructor(config) {
        this.chunkWidth = config.chunkWidth;
        this.chunkWidth2 = config.chunkWidth * config.chunkWidth;
        this.chunkWidth3 = config.chunkWidth * config.chunkWidth * config.chunkWidth;
        this.lastVoxel = config.chunkWidth - 1;
    }
    run() {
        let out = {};

        for (let z = 0, indexZ = 0; z < this.chunkWidth; z++, indexZ += this.chunkWidth2) {
            for (let y = 0, indexY = indexZ; y < this.chunkWidth; y++, indexY += this.chunkWidth) {
                for (let x = 0; x < this.chunkWidth; x++) {
                    let index = x + indexY;
                    out[index] = [
                        // top
                        y < this.lastVoxel ? index + this.chunkWidth : -1,
                        // back
                        z > 0 ? index - this.chunkWidth2 : -1,
                        // front
                        z < this.lastVoxel ? index + this.chunkWidth2 : -1,
                        // left
                        x > 0 ? index - 1 : -1,
                        // right
                        x < this.lastVoxel ? index + 1 : -1,
                        // bottom
                        y > 0 ? index - this.chunkWidth : -1
                    ];
                }
            }
        }

        console.log( "let ofi=" + JSON.stringify(out) + "; export default ofi;" );
    }
}


let config = {
    chunkWidth: 32
};
let gen = new GenOFI(config);
gen.run();