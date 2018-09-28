const isNil = require('lodash/isNil');
const isString = require('lodash/isString');
const isNumber = require('lodash/isNumber');
const isObject = require('lodash/isObject');
const isInteger = require('lodash/isInteger');
const { InvalidEventError } = require('./errors');

const isNotNil = v => !isNil(v);

module.exports.validateEvent = event => {
    const assert = (assertion, msg) => {
        if (!assertion) {
            throw new InvalidEventError(msg, event);
        }
    };

    // Validate "eventId"
    assert(isNotNil(event.eventId), 'event missing "eventId"');
    assert(
        isString(event.eventId) || isNumber(event.eventId),
        'event "eventId" must be a string or number',
    );

    // Validate "type"
    assert(isNotNil(event.type), 'event missing "type"');
    assert(isString(event.type), 'event "type" must be a string');

    // Validate "payload"
    assert(isNotNil(event.payload), 'event missing "payload"');
    assert(isObject(event.payload), 'event "payload" must be an object"');

    // Validate "metadata"
    assert(isNotNil(event.metadata), 'event missing "metadata"');
    assert(isObject(event.metadata), 'event "metadata" must be an object"');

    // Validate "version"
    assert(isNotNil(event.version), 'event missing "version"');
    assert(isInteger(event.version), 'event "version" must be an integer');
    assert(event.version > 0, 'event "version" must be greater than 0');
};
