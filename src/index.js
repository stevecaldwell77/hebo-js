const EventEmitter = require('events');
const has = require('lodash/has');
const mapValues = require('lodash/mapValues');
const curry = require('lodash/fp/curry');
const Joi = require('joi');
const getProjection = require('./get-projection');
const updateSnapshot = require('./update-snapshot');
const { UnknownAggregateError } = require('./errors');
const {
    eventRepositorySchema,
    snapshotRepositorySchema,
    notificationHandlerSchema,
    authorizerSchema,
    aggregateSchema,
} = require('./validators');

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
            assertAuthorized: authorizer.assert,
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

const heboSchema = Joi.object().keys({
    aggregates: Joi.object()
        .pattern(Joi.string(), aggregateSchema)
        .required(),
});

const connectSchema = Joi.object().keys({
    eventRepository: eventRepositorySchema.required(),
    snapshotRepository: snapshotRepositorySchema.required(),
    notificationHandler: notificationHandlerSchema.required(),
    authorizer: authorizerSchema.required(),
    user: Joi.any(),
});

module.exports = class Hebo {
    constructor(params) {
        Joi.assert(
            params,
            heboSchema,
            'Invalid parameters in Hebo constructor',
        );
        this.aggregates = params.aggregates;
    }

    // NOTE: see connectSchema for allowed params
    connect(params) {
        Joi.assert(params, connectSchema, 'Invalid parameters to connect()');
        const { notificationHandler } = params;
        const notifier = createNotifier(notificationHandler);
        const connectedAggregates = connectAggregates({
            ...params,
            aggregates: this.aggregates,
            notifier,
        });
        return getAggregate(connectedAggregates);
    }
};
