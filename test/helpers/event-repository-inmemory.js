const assert = require('assert');
const curry = require('lodash/curry');
const autoBind = require('auto-bind');
const cloneDeep = require('lodash/cloneDeep');
const { validateEvent } = require('../../src/validators');

const versionFilter = curry(
    (greaterThan, event) => event.version > greaterThan,
);

const last = arr => arr.slice(-1)[0];

const assertEventCanBeAppended = (prevEvents, event) => {
    const lastEvent = last(prevEvents);
    const lastVersion = lastEvent ? lastEvent.version : 0;
    const newVersion = event.version;
    assert(
        newVersion > lastVersion,
        `event version ${newVersion} not greater than ` +
            `previous event version ${lastVersion}`,
    );
};

module.exports = class EventRepositoryInmemory {
    constructor({ aggregates = {} } = {}) {
        this.aggregates = cloneDeep(aggregates);
        autoBind(this);
    }

    getEvents(aggregateName, aggregateId, greaterThanVersion = 0) {
        const { aggregates } = this;
        assert(
            aggregates[aggregateName],
            `unknown aggregate "${aggregateName}"`,
        );
        const allEvents = aggregates[aggregateName][aggregateId] || [];
        return allEvents.filter(versionFilter(greaterThanVersion));
    }

    appendEvent(aggregateName, aggregateId, event) {
        const prevEvents = this.getEvents(aggregateName, aggregateId);
        assertEventCanBeAppended(prevEvents, event);
        this.aggregates[aggregateName][aggregateId] = [...prevEvents, event];
        return true;
    }

    writeEvent(aggregateName, aggregateId, event) {
        validateEvent(event);
        return this.appendEvent(aggregateName, aggregateId, event);
    }

    forceWriteEvent(aggregateName, aggregateId, event) {
        return this.appendEvent(aggregateName, aggregateId, event);
    }
};
