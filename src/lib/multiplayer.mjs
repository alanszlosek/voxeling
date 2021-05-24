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
                delete this.players[id];
            }
        }
        for (let id in players) {
            let player;
            let newPlayer = players[id];
            if (id in this.players) {
                player = this.players[id];
                player.setTexture(newPlayer.avatar);

            } else {
                player = this.players[id] = new Player(this.game);
                player.setup();
            }
            player.yaw = newPlayer.yaw;
            player.pitch = newPlayer.pitch;
            vec3.copy(player.position, newPlayer.position);
        }
    }
    tick(ts) {
        if (ts > this.cutoff) {
            // 10 times a second
            this.cutoff = ts + 99;
            this.game.clientWorkerHandle.send([
                'myPosition',
                this.game.player.position,
                this.game.player.yaw,
                this.game.player.pitch,
                this.game.player.avatar
            ]);
        }

    }
}

export { Multiplayer };