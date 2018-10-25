const EventEmitter = require('events');
const forIn = require('lodash/forIn');
const has = require('lodash/has');
const mapValues = require('lodash/mapValues');
const compose = require('lodash/fp/compose');
const curry = require('lodash/fp/curry');
const flatten = require('lodash/fp/flatten');
const fromPairs = require('lodash/fp/fromPairs');
const keys = require('lodash/fp/keys');
const map = require('lodash/fp/map');
const toPairs = require('lodash/fp/toPairs');
const Joi = require('joi');
const {
    eventRepositorySchema,
    snapshotRepositorySchema,
    notificationHandlerSchema,
    authorizerSchema,
    validateAggregate,
    InvalidCommandError,
    UnknownAggregateError,
    UnknownCommandError,
} = require('hebo-validation');
const getProjection = require('./get-projection');
const updateSnapshot = require('./update-snapshot');
const runCommand = require('./run-command');

// validate aggregates input
const validateAggregates = aggregates => {
    forIn(aggregates, validateAggregate);
    const commands = new Set();
    forIn(aggregates, (aggregate, aggregateName) => {
        keys(aggregate.commands).forEach(commandName => {
            if (commands.has(commandName)) {
                throw new InvalidCommandError(
                    `duplicate command "${commandName}" found`,
                    aggregateName,
                    commandName,
                );
            }
            commands.add(commandName);
        });
    });
};

// Build object that maps a command name to its aggregate name
const mapCommandsToAggregates = compose(
    fromPairs,
    flatten,
    map(([aggregateName, aggregate]) =>
        keys(aggregate.commands).map(commandName => [
            commandName,
            aggregateName,
        ]),
    ),
    toPairs,
);

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
}) => async (aggregateName, aggregateId, opts = {}) => {
    if (!has(aggregates, aggregateName)) {
        throw new UnknownAggregateError(aggregateName);
    }
    const aggregate = aggregates[aggregateName];
    const result = await getProjection({
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
    return result;
};

const makeUpdateSnapshot = ({
    aggregates,
    snapshotRepository,
    authorizer,
    user,
    getProjection,
}) => async (aggregateName, aggregateId) => {
    if (!has(aggregates, aggregateName)) {
        throw new UnknownAggregateError(aggregateName);
    }
    const result = await updateSnapshot({
        aggregateName,
        aggregateId,
        getProjection,
        writeSnapshot: snapshotRepository.writeSnapshot,
        assertAuthorized: authorizer.assert,
        user,
    });
    return result;
};

const makeRunCommand = ({
    aggregates,
    eventRepository,
    notifier,
    authorizer,
    user,
    getProjection,
    commandAggregate,
    defaultRetries,
}) => async (commandName, aggregateId, ...commandParams) => {
    const aggregateName = commandAggregate[commandName];
    if (!aggregateName) {
        throw new UnknownCommandError('UNKNOWN', commandName);
    }

    const aggregate = aggregates[aggregateName];
    const command = aggregate.commands[commandName];

    const {
        createEvent,
        isCreateCommand = false,
        retries = defaultRetries,
        validateParams,
    } = command;

    const result = await runCommand({
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
    return result;
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
        validateAggregates(params.aggregates);
        this.aggregates = params.aggregates;
        this.commandAggregate = mapCommandsToAggregates(this.aggregates);
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
        const runCommand = makeRunCommand({
            ...params,
            aggregates,
            notifier,
            getProjection,
            commandAggregate: this.commandAggregate,
            defaultRetries: this.defaultCommandRetries,
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
            runCommand,
        };
    }
};
