const EventEmitter = require('events');
const has = require('lodash/has');
const mapValues = require('lodash/mapValues');
const curry = require('lodash/fp/curry');
const getProjection = require('./get-projection');
const updateSnapshot = require('./update-snapshot');
const { UnknownAggregateError } = require('./errors');

// Creates an EventEmitter object and wires up listeners
const createNotifier = notificationHandler => {
    const notifier = new EventEmitter();
    notifier.on('invalidEventsFound', notificationHandler.invalidEventsFound);
    return notifier;
};

// Hooks up aggregate code to readers/writers/notifiers
const connectAggregate = ({
    eventRepository,
    snapshotRepository,
    authorizer,
    user,
    notifier,
    aggregate,
    aggregateName,
}) => ({
    getProjection(aggregateId) {
        return getProjection({
            aggregateName,
            aggregateId,
            initialState: aggregate.projection.initialState,
            validateState: aggregate.projection.validateState,
            applyEvent: aggregate.projection.applyEvent,
            getSnapshot: snapshotRepository.getSnapshot,
            getEvents: eventRepository.getEvents,
            notifier,
            authorizer,
            user,
        });
    },
    updateSnapshot(aggregateId) {
        return updateSnapshot({
            aggregateName,
            aggregateId,
            getProjection: this.getProjection.bind(this),
            writeSnapshot: snapshotRepository.writeSnapshot,
        });
    },
});

// Hooks up aggregate code to readers/writers/notifiers
const connectAggregates = ({
    eventRepository,
    snapshotRepository,
    authorizer,
    user,
    notifier,
    aggregates,
}) =>
    mapValues(aggregates, (aggregate, aggregateName) =>
        connectAggregate({
            eventRepository,
            snapshotRepository,
            authorizer,
            user,
            notifier,
            aggregate,
            aggregateName,
        }),
    );

// Curried getAggregate() function that throws error if the key doesn't exist.
const getAggregate = curry((aggregates, aggregateName) => {
    if (!has(aggregates, aggregateName)) {
        throw new UnknownAggregateError(aggregateName);
    }
    return aggregates[aggregateName];
});

module.exports = class Hebo {
    constructor({ aggregates }) {
        // TODO: validate aggregates
        this.aggregates = aggregates;
    }

    connect({
        eventRepository,
        snapshotRepository,
        notificationHandler,
        authorizer,
        user,
    }) {
        // TODO: validate params

        const notifier = createNotifier(notificationHandler);
        const connectedAggregates = connectAggregates({
            eventRepository,
            snapshotRepository,
            authorizer,
            user,
            aggregates: this.aggregates,
            notifier,
        });
        return getAggregate(connectedAggregates);
    }
};
