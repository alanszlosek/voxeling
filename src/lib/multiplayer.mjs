import { quat, vec3 } from 'gl-matrix';
import { Player } from './models/player.mjs';
import { Tickable } from './capabilities/tickable.mjs';


// This class holds the player objects, updates their positions
class Multiplayer extends Tickable {
    constructor(game) {
        super();
        let self = this;
        this.game = game;
        this.players = {}

        this.cutoff = 0;

        this.playerCache = {
            position: null,
            yaw: null,
            pitch: null,
            avatar: 0
        };
        this.game.pubsub.subscribe('player.updatePosition', function(position) {
            // unnecessary since have already have a reference to this array
            self.playerCache.position = position;
        });
        this.game.pubsub.subscribe('player.updateRotation', function(pitch, yaw) {
            // unnecessary since have already have a reference to this array
            self.playerCache.pitch = pitch;
            self.playerCache.yaw = yaw;
        });
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
        return;
        if (ts > this.cutoff) {
            // 10 times a second
            this.cutoff = ts + 99;

            // use cached player data
            this.game.clientWorkerHandle.send([
                'myPosition',
                this.playerCache.position,
                this.playerCache.yaw,
                this.playerCache.pitch,
                this.playerCache.avatar
            ]);
        }

    }
}

export { Multiplayer };