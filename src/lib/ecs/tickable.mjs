var tickables = [];

class Tickable {
    constructor() {
        tickables.push(this);
    }
}

export { Tickable, tickables }