const { produce } = require('immer');
const isNil = require('lodash/isNil');
const has = require('lodash/has');
const Joi = require('@hapi/joi');
const {
    EventPayloadError,
    InvariantViolatedError,
} = require('hebo-validation');

module.exports.createReducer = handlers =>
    produce((draft, event) => {
        const defaultHandler = handlers.default || (() => draft);
        const handler = has(handlers, event.type)
            ? handlers[event.type]
            : defaultHandler;
        return handler(draft, event);
    });

module.exports.getRequiredPayloadValue = (event, key) => {
    const val = event.payload[key];
    if (isNil(val)) {
        throw new EventPayloadError(event, key);
    }

    return event.payload[key];
};

module.exports.assertInvariant = (aggregateName, aggregateId, state) => (
    assertion,
    msg,
) => {
    if (!assertion) {
        throw new InvariantViolatedError(
            'library',
            state.libraryId,
            state,
            msg,
        );
    }
};

module.exports.makeValidator = (schema, message) => value =>
    Joi.assert(value, schema, message);
