const test = require('ava');
const shortid = require('shortid');
const { omit } = require('lodash');
const { validateEvent, validateAggregate } = require('../validators');
const libraryAggregate = require('./helpers/aggregates/library');

test('validateEvent()', t => {
    const validEvent = {
        eventId: shortid.generate(),
        type: 'CREATE',
        payload: {},
        metadata: {},
        version: 1,
    };

    t.notThrows(() => validateEvent(validEvent), 'valid event passes');

    t.throws(
        () => validateEvent(omit(validEvent, 'eventId')),
        /"eventId" is required/,
        'eventId required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, eventId: {} }),
        /"eventId" must be a number, "eventId" must be a string/,
        'eventId must be correct type',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'type')),
        /"type" is required/,
        'type required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, type: 10 }),
        /"type" must be a string/,
        'type must be string',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'payload')),
        /"payload" is required/,
        'payload required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, payload: 10 }),
        /"payload" must be an object/,
        'payload must be an object',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'metadata')),
        /"metadata" is required/,
        'metadata required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, metadata: 10 }),
        /"metadata" must be an object/,
        'metadata must be an object',
    );

    t.throws(
        () => validateEvent(omit(validEvent, 'version')),
        /"version" is required/,
        'version required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, version: 'asdf' }),
        /"version" must be a number/,
        'version must be a number',
    );

    t.throws(
        () => validateEvent({ ...validEvent, version: 0 }),
        /"version" must be greater than 0/,
        'version must be positive',
    );
});

test('validateAggregate()', t => {
    t.notThrows(
        () => validateAggregate(libraryAggregate, 'library'),
        'valid aggregate passes',
    );

    t.throws(
        () =>
            validateAggregate(omit(libraryAggregate, 'projection'), 'library'),
        /"projection" is required/,
        'projection required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(libraryAggregate, 'projection.initialState'),
                'library',
            ),
        /"initialState" is required/,
        'projection > initialState required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(libraryAggregate, 'projection.applyEvent'),
                'library',
            ),
        /"applyEvent" is required/,
        'projection > applyEvent required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(libraryAggregate, 'projection.validateState'),
                'library',
            ),
        /"validateState" is required/,
        'projection > validateState required',
    );

    t.throws(
        () => validateAggregate(omit(libraryAggregate, 'commands'), 'library'),
        /"commands" is required/,
        'commands required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(libraryAggregate, 'commands.setName.validateParams'),
                'library',
            ),
        /"validateParams" is required/,
        'command > validateParams required',
    );

    t.throws(
        () =>
            validateAggregate(
                omit(libraryAggregate, 'commands.setName.createEvent'),
                'library',
            ),
        /"createEvent" is required/,
        'command > createEvent required',
    );
});
