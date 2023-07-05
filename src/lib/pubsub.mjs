class PubSub {
    constructor() {
        this._subscribers = new Map();
    }

    publish(event, args) {
        if (!this._subscribers.has(event)) {
            return;
        }
        let subscribers = this._subscribers.get(event);
        subscribers.forEach(function(subscriber) {
            subscriber.apply(null, args);
        });

    }
    subscribe(event, callback) {
        let subscribers;
        if (this._subscribers.has(event)) {
            subscribers = this._subscribers.get(event);
            
        } else {
            subscribers = new Set();
            this._subscribers.set(event, subscribers);
        }
        subscribers.add(callback);
    }

}

export { PubSub };