import uuid from 'hat';

var tickables = {};

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