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
