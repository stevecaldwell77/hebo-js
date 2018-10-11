const test = require('ava');
const shortid = require('shortid');
const { omit, noop } = require('lodash');
const {
    validateEvent,
    validateAggregate,
    validateEventRepository,
    validateNotificationHandler,
    validateSnapshotRepository,
} = require('hebo-validation');
const libraryAggregate = require('./helpers/aggregates/library');

test('validateEvent()', t => {
    const validEvent = {
        eventId: shortid.generate(),
        type: 'CREATE',
        payload: {},
        metadata: {},
        version: 1,
        sequenceNumber: 1,
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
        () => validateEvent(omit(validEvent, ['version', 'sequenceNumber'])),
        /must contain at least one of \[version, sequenceNumber\]/,
        'version or sequenceNumber required',
    );

    t.throws(
        () => validateEvent({ ...validEvent, sequenceNumber: 'asdf' }),
        /"sequenceNumber" must be a number/,
        'sequenceNumber must be a number',
    );

    t.throws(
        () => validateEvent({ ...validEvent, sequenceNumber: 0 }),
        /"sequenceNumber" must be greater than 0/,
        'sequenceNumber must be positive',
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

test('validateEventRepository()', t => {
    const validRepo = {
        getEvents: noop,
        writeEvent: noop,
    };

    {
        const { error } = validateEventRepository(validRepo);
        t.is(error, null, 'no error for valid repo');
    }

    {
        const { error } = validateEventRepository(omit(validRepo, 'getEvents'));
        t.snapshot(error, 'error when getEvents omitted');
    }

    {
        const { error } = validateEventRepository(
            omit(validRepo, 'writeEvent'),
        );
        t.snapshot(error, 'error when writeEvent omitted');
    }
});

test('validateNotificationHandler()', t => {
    const validHandler = {
        invalidEventsFound: noop,
        eventWritten: noop,
    };

    {
        const { error } = validateNotificationHandler(validHandler);
        t.is(error, null, 'no error for valid handler');
    }

    {
        const { error } = validateNotificationHandler(
            omit(validHandler, 'invalidEventsFound'),
        );
        t.snapshot(error, 'error when invalidEventsFound omitted');
    }

    {
        const { error } = validateNotificationHandler(
            omit(validHandler, 'eventWritten'),
        );
        t.snapshot(error, 'error when eventWritten omitted');
    }
});

test('validateSnapshotRepository()', t => {
    const validRepo = {
        getSnapshot: noop,
        writeSnapshot: noop,
    };

    {
        const { error } = validateSnapshotRepository(validRepo);
        t.is(error, null, 'no error for valid repo');
    }

    {
        const { error } = validateSnapshotRepository(
            omit(validRepo, 'getSnapshot'),
        );
        t.snapshot(error, 'error when getSnapshot omitted');
    }

    {
        const { error } = validateSnapshotRepository(
            omit(validRepo, 'writeSnapshot'),
        );
        t.snapshot(error, 'error when writeSnapshot omitted');
    }
});
