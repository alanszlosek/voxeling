import uuid from 'hat';

var tickables = {};

let last_ts = Date.now();
setInterval(
    function() {
        let ts = Date.now();
        for (let id in tickables) {
            tickables[id].tick(ts, ts - last_ts);
        }
        last_ts = ts;
    },
    1000/30
);

class Tickable {
    constructor() {
        // unique id so we only tick() and item once
        // AND so when they come and go we can easily remove / add
        this._tickableId = uuid();
        tickables[ this._tickableId ] = this;
    }

    tick(ts) {
        //console.log('Base class tick', this);
    }

    destroy() {
        delete tickables[ this._tickableId ];
    }
}

export { Tickable, tickables }