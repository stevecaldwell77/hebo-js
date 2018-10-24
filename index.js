const EventEmitter = require('events');
const forIn = require('lodash/forIn');
const has = require('lodash/has');
const mapValues = require('lodash/mapValues');
const curry = require('lodash/fp/curry');
const Joi = require('joi');
const {
    eventRepositorySchema,
    snapshotRepositorySchema,
    notificationHandlerSchema,
    authorizerSchema,
    validateAggregate,
    UnknownAggregateError,
    UnknownCommandError,
} = require('hebo-validation');
const getProjection = require('./get-projection');
const updateSnapshot = require('./update-snapshot');
const runCommand = require('./run-command');

// Creates an EventEmitter object and wires up listeners
const createNotifier = notificationHandler => {
    const notifier = new EventEmitter();
    notifier.on('invalidEventsFound', notificationHandler.invalidEventsFound);
    notifier.on('eventWritten', notificationHandler.eventWritten);
    return notifier;
};

// Hooks up aggregate code to readers/writers/notifiers
const connectAggregate = ({
    eventRepository,
    authorizer,
    user,
    notifier,
    defaultCommandRetries,
    aggregate,
    aggregateName,
    getProjection,
}) => ({
    async runCommand(commandName, aggregateId, ...commandParams) {
        const command = aggregate.commands[commandName];
        if (!command) {
            throw new UnknownCommandError(aggregateName, commandName);
        }
        const {
            createEvent,
            isCreateCommand = false,
            retries = defaultCommandRetries,
            validateParams,
        } = command;
        await runCommand({
            aggregateName,
            aggregateId,
            commandName,
            commandParams,
            isCreateCommand,
            validateParams,
            getProjection,
            initialState: aggregate.projection.initialState,
            createEvent,
            applyEvent: aggregate.projection.applyEvent,
            validateState: aggregate.projection.validateState,
            writeEvent: eventRepository.writeEvent,
            retries,
            notifier,
            assertAuthorized: authorizer.assert,
            user,
        });
    },
});

// Hooks up aggregate code to readers/writers/notifiers
const connectAggregates = ({
    eventRepository,
    authorizer,
    user,
    notifier,
    aggregates,
    defaultCommandRetries,
    getProjection,
}) =>
    mapValues(aggregates, (aggregate, aggregateName) =>
        connectAggregate({
            eventRepository,
            authorizer,
            user,
            notifier,
            defaultCommandRetries,
            aggregate,
            aggregateName,
            getProjection,
        }),
    );

// Curried getAggregate() function that throws error if the key doesn't exist.
const getAggregate = curry((aggregates, aggregateName) => {
    if (!has(aggregates, aggregateName)) {
        throw new UnknownAggregateError(aggregateName);
    }
    return aggregates[aggregateName];
});

const makeGetProjection = ({
    aggregates,
    eventRepository,
    snapshotRepository,
    authorizer,
    user,
    notifier,
}) => (aggregateName, aggregateId, opts = {}) => {
    if (!has(aggregates, aggregateName)) {
        throw new UnknownAggregateError(aggregateName);
    }
    const aggregate = aggregates[aggregateName];
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
        missValue: opts.missValue,
    });
};

const makeUpdateSnapshot = ({
    aggregates,
    snapshotRepository,
    authorizer,
    user,
    getProjection,
}) => (aggregateName, aggregateId) => {
    if (!has(aggregates, aggregateName)) {
        throw new UnknownAggregateError(aggregateName);
    }
    return updateSnapshot({
        aggregateName,
        aggregateId,
        getProjection,
        writeSnapshot: snapshotRepository.writeSnapshot,
        assertAuthorized: authorizer.assert,
        user,
    });
};

const heboSchema = Joi.object().keys({
    aggregates: Joi.object().required(),
    defaultCommandRetries: Joi.number()
        .integer()
        .positive()
        .default(10),
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
        forIn(params.aggregates, validateAggregate);
        this.aggregates = params.aggregates;
        this.defaultCommandRetries = params.defaultCommandRetries;
    }

    // NOTE: see connectSchema for allowed params
    connect(params) {
        Joi.assert(params, connectSchema, 'Invalid parameters to connect()');
        const { notificationHandler } = params;
        const notifier = createNotifier(notificationHandler);
        const { aggregates } = this;
        const getProjection = makeGetProjection({
            ...params,
            aggregates,
            notifier,
        });
        const updateSnapshot = makeUpdateSnapshot({
            ...params,
            aggregates,
            getProjection,
        });
        const connectedAggregates = connectAggregates({
            ...params,
            aggregates: this.aggregates,
            defaultCommandRetries: this.defaultCommandRetries,
            notifier,
            getProjection,
        });
        return {
            getAggregate: getAggregate(connectedAggregates),
            getProjection,
            updateSnapshot,
        };
    }
};
