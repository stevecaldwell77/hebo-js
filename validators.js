const Joi = require('joi');
const forIn = require('lodash/forIn');
const {
    InvalidAggregateError,
    InvalidCommandError,
    InvalidEventError,
    InvalidProjectionError,
} = require('./errors');

const errorDetailsMessage = error =>
    error.details.map(d => d.message).join(', ');

const eventSchema = Joi.object()
    .keys({
        eventId: Joi.alternatives()
            .try(Joi.number(), Joi.string())
            .required(),
        type: Joi.string().required(),
        metadata: Joi.object().required(),
        payload: Joi.object().required(),
        version: Joi.number()
            .integer()
            .greater(0)
            .required(),
    })
    .unknown();

module.exports.validateEvent = event => {
    const { error } = Joi.validate(event, eventSchema);

    if (error) {
        const messages = error.details.map(d => d.message);
        const message = messages.join(', ');
        throw new InvalidEventError(message, event);
    }
};

const aggregateSchema = Joi.object().keys({
    projection: Joi.object().required(),
    commands: Joi.object().required(),
});

const projectionSchema = Joi.object().keys({
    initialState: Joi.func().required(),
    applyEvent: Joi.func().required(),
    validateState: Joi.func().required(),
});

const commandSchema = Joi.object().keys({
    validateParams: Joi.func().required(),
    createEvent: Joi.func().required(),
    isCreateCommand: Joi.boolean(),
    retries: Joi.number()
        .integer()
        .positive(),
});

module.exports.validateAggregate = (aggregate, aggregateName) => {
    const { error: aggregateError } = Joi.validate(aggregate, aggregateSchema);
    if (aggregateError) {
        throw new InvalidAggregateError(
            errorDetailsMessage(aggregateError),
            aggregateName,
        );
    }

    const { error: projectionError } = Joi.validate(
        aggregate.projection,
        projectionSchema,
    );
    if (projectionError) {
        throw new InvalidProjectionError(
            errorDetailsMessage(projectionError),
            aggregateName,
        );
    }

    forIn(aggregate.commands, (command, commandName) => {
        const { error: commandError } = Joi.validate(command, commandSchema);
        if (commandError) {
            throw new InvalidCommandError(
                errorDetailsMessage(commandError),
                aggregateName,
                commandName,
            );
        }
    });
};

module.exports.eventRepositorySchema = Joi.object()
    .keys({
        getEvents: Joi.func().required(),
        writeEvent: Joi.func().required(),
    })
    .unknown();

module.exports.snapshotRepositorySchema = Joi.object()
    .keys({
        getSnapshot: Joi.func().required(),
        writeSnapshot: Joi.func().required(),
    })
    .unknown();

module.exports.notificationHandlerSchema = Joi.object()
    .keys({
        invalidEventsFound: Joi.func().required(),
        eventWritten: Joi.func().required(),
    })
    .unknown();

module.exports.authorizerSchema = Joi.object()
    .keys({
        assert: Joi.func().required(),
    })
    .unknown();
