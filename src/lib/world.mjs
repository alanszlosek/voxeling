import { Tickable } from './entities/tickable';

class World extends Tickable {
    constructor(game) {
        super();
        let self = this;
        this.game = game;

        // start clearly out of bounds to trigger a load of world chunks
        this.lastRegion = [100,100,100];


        let coords = document.getElementById('coordinates');
        setInterval(
            function() {
                let player = self.game.player;
                let pos = player.getPosition().map(Math.floor);
                coords.innerText = pos.join(', ');
            },
            2000
        );
    }

    tick(ts) {
        // compare player position with chunk boundaries to trigger regionChange
        var thisRegion = this.game.coordinates.positionToChunk(this.game.player.position);
        var lastRegion = this.lastRegion;
        if (thisRegion[0] !== lastRegion[0] || thisRegion[1] !== lastRegion[1] || thisRegion[2] !== lastRegion[2]) {
            console.log('region change');
            this.game.clientWorkerHandle.regionChange();
        }
        this.lastRegion = thisRegion;
    }
}


export { World };
