/*

Forked from https://github.com/chriso/lru
* Renamed prev/next to older/newer
* Renamed head/tail pointers to newest/oldest
* All pointers are now pointers, instead of holding the cache key string (figured less indirection is better for performance)
* Re-worked some of the logic

*/
var events = require('events');
var util = require('util');

var LRU = module.exports = function(opts) {
    if (!(this instanceof LRU)) return new LRU(opts);
    if (typeof opts === 'number') opts = {max: opts};
    if (!opts) opts = {};
    events.EventEmitter.call(this);
    this.cache = {}
    this.newest = this.oldest = null;
    this.length = 0;
    this.max = opts.max || 1000;
    this.maxAge = opts.maxAge || 0;
    this.debug = false;
};
util.inherits(LRU, events.EventEmitter);

LRU.prototype.remove = function(key) {
    if (!this.cache.hasOwnProperty(key)) return;

    var element = this.cache[key];
    delete this.cache[key];

    --this.length;

    /*
    It's easiest to think about removals in terms of where the element points to. That will
    take care of all the edge cases we need. No need for conditionals to involve this.newest or this.oldest. 
    */
    if (element.newer) {
        element.newer.older = element.older;
    } else {
        this.newest = element.older;
    }

    if (element.older) {
        element.older.newer = element.newer;
    } else {
        this.oldest = element.newer;
    }

    if (this.debug) {
        console.log('Removed ' + key + ' from LRU');
    }

    return element.value;
}

LRU.prototype.peek = function(key) {
  return this.cache.hasOwnProperty(key) ? this.cache[key].value : null
}

LRU.prototype.set = function(key, value) {
    var element;
    if (this.cache.hasOwnProperty(key)) {
        if (this.debug) {
            console.log('Found ' + key + ' in LRU');
        }
        element = this.cache[key]
        element.value = value
        if (this.maxAge) element.modified = Date.now();

        // If element is already the newest, there's nothing more to do:
        if (!element.newer) {
            return value;
        }
    } else {
        element = {
            key: key,
            value: value,
            newer: null,
            older: null
        };
        if (this.maxAge) element.modified = Date.now();

        // Eviction is only possible if the key didn't already exist:
        if (this.length === this.max) {
            this.evict();
        }

        this.cache[key] = element;
        ++this.length;
    }

    element.newer = null;
    element.older = this.newest;

    // Make the current newest item aware of it's newer sibling
    if (this.newest) {
        this.newest.newer = element;
    }

    this.newest = element;

    if (!this.oldest) {
        this.oldest = element;
    }

    if (this.debug) {
        console.log('Re-ordered ' + key + ' in LRU');
    }

    return value;
};

LRU.prototype.get = function (key) {
    if (!this.cache.hasOwnProperty(key)) {
        if (this.debug) {
            console.log(key + ' not found in LRU');
        }
        return;
    }
    var element = this.cache[key];

    // Attempt to get a key that should be expired
    if (this.maxAge && (Date.now() - element.modified) > this.maxAge) {
        this.remove(key);
        this.emit('evict', {key:key, value:element.value});
        return;
    }

    // If element is not the newest
    if (element.newer) {
        // If element is not the oldest, adjust pointers on it's adjacent siblings
        if (element.older) {
            element.newer.older = element.older;
            element.older.newer = element.newer;
            element.newer = null;
            element.older = this.newest;
            this.newest = element;
        } else {
            // Set the element's newer sibling as the new oldest
            element.newer.older = null;
            this.oldest = element.newer;
            element.newer = null;
            element.older = this.newest;
            this.newest = element;
        }
    }

    if (this.debug) {
        console.log(key + ' found in LRU');
    }

    return element.value;
};

LRU.prototype.evict = function () {
    if (!this.oldest) {
        return;
    }
    var element = this.oldest;
    this.remove( element.key );
    this.emit('evict', {key: element.key, value: element.value});
};

