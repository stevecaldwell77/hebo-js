const test = require('ava');
const shortid = require('shortid');
const { validateEvent } = require('../src/validators');

test('validateEvent()', t => {
    t.throws(
        () => validateEvent({}),
        /event missing "eventId"/,
        'eventId required',
    );

    t.throws(
        () => validateEvent({ eventId: {} }),
        /event "eventId" must be a string or number/,
        'eventId must be correct type',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
            }),
        /event missing "type"/,
        'type required',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
                type: 10,
            }),
        /event "type" must be a string/,
        'type must be string',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
                type: 'CREATE',
            }),
        /event missing "payload"/,
        'payload required',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
                type: 'CREATE',
                payload: 10,
            }),
        /event "payload" must be an object/,
        'payload must be an object',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
                type: 'CREATE',
                payload: {},
            }),
        /event missing "metadata"/,
        'metadata required',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
                type: 'CREATE',
                payload: {},
                metadata: 10,
            }),
        /event "metadata" must be an object/,
        'metadata must be an object',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
                type: 'CREATE',
                payload: {},
                metadata: {},
            }),
        /event missing "version"/,
        'version required',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
                type: 'CREATE',
                payload: {},
                metadata: {},
                version: 'asdf',
            }),
        /event "version" must be an integer/,
        'version must be an integer',
    );

    t.throws(
        () =>
            validateEvent({
                eventId: shortid.generate(),
                type: 'CREATE',
                payload: {},
                metadata: {},
                version: 0,
            }),
        /event "version" must be greater than 0/,
        'version must be positive',
    );
});
