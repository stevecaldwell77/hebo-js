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
    })
    .unknown();

module.exports.authorizerSchema = Joi.object()
    .keys({
        assert: Joi.func().required(),
    })
    .unknown();

module.exports.aggregateSchema = Joi.object()
    .keys({
        projection: Joi.object()
            .keys({
                initialState: Joi.func().required(),
                applyEvent: Joi.func().required(),
                validateState: Joi.func().required(),
            })
            .unknown()
            .required(),
    })
    .unknown();
