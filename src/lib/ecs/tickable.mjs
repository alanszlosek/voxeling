var tickables = [];

class Tickable {
    constructor() {
        tickables.push(this);
    }

    tick(ts) {
        console.log('Base class tick', this);
    }
}

export { Tickable, tickables }