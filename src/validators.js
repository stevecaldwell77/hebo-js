const Joi = require('joi');
const { InvalidEventError } = require('./errors');

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

module.exports.eventRepositorySchema = Joi.object()
    .keys({
        getEvents: Joi.func()
            .minArity(2)
            .maxArity(3)
            .required(),
        writeEvent: Joi.func()
            .arity(3)
            .required(),
    })
    .unknown();

module.exports.snapshotRepositorySchema = Joi.object()
    .keys({
        getSnapshot: Joi.func()
            .arity(2)
            .required(),
        writeSnapshot: Joi.func()
            .arity(3)
            .required(),
    })
    .unknown();

module.exports.notificationHandlerSchema = Joi.object()
    .keys({
        invalidEventsFound: Joi.func()
            .arity(1)
            .required(),
    })
    .unknown();

module.exports.authorizerSchema = Joi.object()
    .keys({
        assert: Joi.func()
            .arity(2)
            .required(),
    })
    .unknown();
