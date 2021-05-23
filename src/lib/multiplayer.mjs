import { quat, vec3 } from 'gl-matrix';
import { Player } from './models/player';
import { Tickable } from './entities/tickable';


// This class holds the player objects, updates their positions
class Multiplayer extends Tickable {
    constructor(game) {
        super();
        this.game = game;
        this.players = {}

        this.cutoff = 0;
    }
    show(players) {
        for (let id in this.players) {
            if (!(id in players)) {
                let player = this.players[id];
                // Remove this player
                // TODO: not sure which parent class has the method to remove from Tickable+Renderable lists
                player.destroy();
            }
        }
        for (let id in players) {
            if (id in this.players) {

                this.players[id].setTexture('player');

            } else {
                this.players[id] = new Player(this.game);
                this.players[id].setup();
            }
            quat.copy(this.players[id].rotationQuat, players[id].rotationQuat);
            vec3.copy(this.players[id].position, players[id].position);
        }
    }
    tick(ts) {
        if (ts > this.cutoff) {
            this.cutoff = ts + 100;
            this.game.clientWorkerHandle.send([
                'myPosition',
                this.game.player.position,
                this.game.player.rotationQuat
            ]);
        }

    }
}

export { Multiplayer };