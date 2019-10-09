const test = require('ava');
const shortid = require('shortid');
const uuid = require('uuid/v4');
const sinon = require('sinon');
const Joi = require('@hapi/joi');
const EventRepository = require('hebo-event-repository-inmemory');
const SnapshotRepository = require('hebo-snapshot-repository-inmemory');
const NotificationHandler = require('hebo-notification-handler-inmemory');
const {
    AggregateNotFoundError,
    DuplicateAggregateError,
    EventPayloadError,
    InvalidCommandParamsError,
    InvalidEventError,
    InvariantViolatedError,
    MaxCommandAttemptsError,
    UnauthorizedError,
    UnknownCommandError,
} = require('hebo-validation');
const { makeValidator } = require('../util');
const libraryAggregate = require('./helpers/aggregates/library');
const { users, getAuthorizer } = require('./helpers/authorizer');
const Hebo = require('..');

const cityIdValidator = makeValidator(
    Joi.string()
        .min(5)
        .required(),
    'cityId',
);

// An aggregate with some issues that we want to catch
const brokenCityAggregate = {
    idField: 'cityId',
    projection: {
        initialState: cityId => ({ cityId }),
        applyEvent: (prevState, event) => {
            if (event.type === 'BAD_EVENT') {
                throw new EventPayloadError(event, 'iWillNeverExist');
            }

            return prevState;
        },
        validateState: () => {},
    },
    commands: {
        createBrokenCity: {
            isCreateCommand: true,
            validateParams: ({ cityId }) => cityIdValidator(cityId),
            createEvent: ({ cityId }) => ({
                type: 'CREATED',
                payload: { cityId },
            }),
        },
        generateEmptyEvent: {
            validateParams: () => {},
            createEvent: () => ({}),
        },
        generateBadEvent: {
            validateParams: () => {},
            createEvent: () => ({
                type: 'BAD_EVENT',
                payload: {},
            }),
        },
    },
};

const hebo = new Hebo({
    aggregates: {
        library: libraryAggregate,
        brokenCity: brokenCityAggregate,
    },
    defaultCommandRetries: 4,
});

const makeEventRepository = () =>
    new EventRepository({ aggregates: ['library', 'brokenCity'] });

const makeSnapshotRepository = () =>
    new SnapshotRepository({ aggregates: ['library', 'brokenCity'] });

const setupTest = ({ eventMetadata } = {}) => {
    const libraryId = shortid.generate();
    const eventRepository = makeEventRepository();
    const notificationHandler = new NotificationHandler();
    const snapshotRepository = makeSnapshotRepository();
    const authorizer = getAuthorizer(libraryId);

    const { runCommand } = hebo.connect({
        eventRepository,
        snapshotRepository,
        notificationHandler,
        authorizer,
        user: users.superSally,
        eventMetadata,
    });

    return {
        libraryId,
        runCommand,
        eventRepository,
        notificationHandler,
    };
};

// Calling runCommand() with an unknown command should thrown an error.
test('unknown command', async t => {
    const { runCommand } = await setupTest();

    await t.throwsAsync(
        runCommand('thisIsNotValid'),
        UnknownCommandError,
        'error thrown when runCommand called with unknown command name',
    );
});

// Calling runCommand() and not including the aggregate's id in the args should
// throw an error.
test('missing aggregateId', async t => {
    const { runCommand } = await setupTest();

    await t.throwsAsync(
        runCommand('setLibraryName', { name: 'a' }),
        InvalidCommandParamsError,
        'error thrown when runCommand called without aggregate id in args',
    );
});

// If the command's validateParams() call fails, an error should be thrown.
test('validateParams', async t => {
    const { runCommand, libraryId, eventRepository } = await setupTest();

    // this should violate the 'name must be at least 4 chars' rule.
    await t.throwsAsync(
        runCommand('setLibraryName', { libraryId, name: 'a' }),
        InvalidCommandParamsError,
        'error thrown when validateParams fails',
    );

    t.deepEqual(
        await eventRepository.getEvents('library', libraryId),
        [],
        'no events written when validateParams fails',
    );
});

// You should not be able to run a create command if a aggregate already exists,
// and vice versa.
test('isCreateCommand', async t => {
    const { runCommand, libraryId } = await setupTest();

    await t.throwsAsync(
        runCommand('setLibraryName', { libraryId, name: 'North' }),
        AggregateNotFoundError,
        'error thrown when non-create command run and aggregate does not exist',
    );

    await t.notThrowsAsync(
        runCommand('createLibrary', { libraryId }),
        'can run createLibrary command when aggregate does not exist',
    );

    await t.throwsAsync(
        runCommand('createLibrary', { libraryId }),
        DuplicateAggregateError,
        'error thrown when createLibrary command run and aggregate already exists',
    );
});

// If a command's createEvent() returns an invalid event, an error should be
// thrown.
test('createEvent generated invalid event', async t => {
    const { runCommand } = await setupTest();

    const cityId = shortid.generate();

    await runCommand('createBrokenCity', { cityId });

    // This should trigger an event that is missing any data, which should be
    // flagged as an invalid event.
    await t.throwsAsync(
        runCommand('generateEmptyEvent', { cityId }),
        InvalidEventError,
        'error thrown when command creates an invalid event',
    );
});

// If an aggregate's applyEvent() function throws an error when trying to apply
// a command's event, the error should be propogated.
test('applyEvent throws error', async t => {
    const { runCommand, eventRepository } = await setupTest();

    const cityId = shortid.generate();

    await eventRepository.writeEvent({
        aggregateName: 'brokenCity',
        aggregateId: cityId,
        eventId: uuid(),
        type: 'CREATED',
        payload: { cityId },
        metadata: {},
        sequenceNumber: 1,
    });

    // This should trigger an event of type 'BAD_EVENT', which in turn
    // should trigger an error in the brokenCity aggregate's applyEvent().
    await t.throwsAsync(
        runCommand('generateBadEvent', { cityId }),
        EventPayloadError,
        'error thrown when command creates an event that fails at applyEvent',
    );
});

// If an aggregate's validateState() function throws an error after applying a
// command's event, the error should be propogated.
test('validateState throws error', async t => {
    const { runCommand, eventRepository, libraryId } = await setupTest();

    await eventRepository.writeEvent({
        aggregateName: 'library',
        aggregateId: libraryId,
        eventId: uuid(),
        type: 'CREATED',
        payload: { libraryId },
        metadata: {},
        sequenceNumber: 1,
    });

    // This violate's the library's invariant that an active library must have a
    // name.
    await t.throwsAsync(
        runCommand('activateLibrary', { libraryId }),
        InvariantViolatedError,
        'error thrown when command creates an event that validateState rejects',
    );
});

// We should retry a command if the event repo's writeEvent() returns false.
// Test when a command does not have a specific retry number set - we should use
// our default retries.
test('retries - using defaultCommandRetries', async t => {
    const { runCommand, eventRepository, libraryId } = await setupTest();

    await eventRepository.writeEvent({
        aggregateName: 'library',
        aggregateId: libraryId,
        eventId: uuid(),
        type: 'CREATED',
        payload: { libraryId },
        metadata: {},
        sequenceNumber: 1,
    });

    // Now setup event repo so that writes always fail
    const writeEvent = sinon.fake.resolves(false);
    sinon.replace(eventRepository, 'writeEvent', writeEvent);

    // Note: setLibraryCityName has no specific retries value, so we should use default
    await t.throwsAsync(
        runCommand('setLibraryCityName', { libraryId, name: 'Encino' }),
        MaxCommandAttemptsError,
        'error thrown when we reach max retries trying to write event',
    );

    t.is(writeEvent.callCount, 5, 'writeEvent() called 5 times');
});

// We should retry a command if the event repo's writeEvent() returns false.
// Test when a command has a specific retry number set that overrides the
// default.
test('retries - command specific setting', async t => {
    const { runCommand, eventRepository, libraryId } = await setupTest();

    await eventRepository.writeEvent({
        aggregateName: 'library',
        aggregateId: libraryId,
        eventId: uuid(),
        type: 'CREATED',
        payload: { libraryId },
        metadata: {},
        sequenceNumber: 1,
    });

    // Now setup event repo so that writes always fail
    const writeEvent = sinon.fake.resolves(false);
    sinon.replace(eventRepository, 'writeEvent', writeEvent);

    // Note: setLibraryName has retries set to 3
    await t.throwsAsync(
        runCommand('setLibraryName', { libraryId, name: 'North' }),
        MaxCommandAttemptsError,
        'error thrown when we reach max retries trying to write event',
    );

    t.is(writeEvent.callCount, 4, 'writeEvent() called 4 times');
});

// A successful command should write events to our repository and generate the
// proper notifications.
test('successful command', async t => {
    const {
        runCommand,
        eventRepository,
        notificationHandler,
        libraryId,
    } = await setupTest();

    await t.notThrowsAsync(
        runCommand('createLibrary', { libraryId }),
        'able to run createLibrary',
    );

    await t.notThrowsAsync(
        runCommand('setLibraryName', { libraryId, name: 'North' }),
        'able to run setLibraryName',
    );

    await t.notThrowsAsync(
        runCommand('setLibraryCityName', { libraryId, name: 'Omaha' }),
        'able to run setLibraryCityName',
    );

    const events = await eventRepository.getEvents('library', libraryId);

    t.is(events.length, 3, 'event generated for each command');

    const eventIds = events.map(e => e.eventId);
    const eventIdsSet = new Set(eventIds);
    t.is(eventIdsSet.size, 3, 'each generaged event gets unique eventId');

    t.deepEqual(
        events,
        [
            {
                aggregateName: 'library',
                aggregateId: libraryId,
                eventId: eventIds[0],
                metadata: {},
                sequenceNumber: 1,
                type: 'CREATED',
                payload: { libraryId },
            },
            {
                aggregateName: 'library',
                aggregateId: libraryId,
                eventId: eventIds[1],
                metadata: {},
                sequenceNumber: 2,
                type: 'NAME_SET',
                payload: { name: 'North' },
            },
            {
                aggregateName: 'library',
                aggregateId: libraryId,
                eventId: eventIds[2],
                metadata: {},
                sequenceNumber: 3,
                type: 'CITY_NAME_SET',
                payload: { name: 'Omaha' },
            },
        ],
        'correct events generated',
    );

    const notifications = notificationHandler.getNotifications();
    const expectedNotifications = [
        {
            name: 'eventWritten',
            notification: {
                aggregateName: 'library',
                aggregateId: libraryId,
                eventType: 'CREATED',
            },
        },
        {
            name: 'eventWritten',
            notification: {
                aggregateName: 'library',
                aggregateId: libraryId,
                eventType: 'NAME_SET',
            },
        },
        {
            name: 'eventWritten',
            notification: {
                aggregateName: 'library',
                aggregateId: libraryId,
                eventType: 'CITY_NAME_SET',
            },
        },
    ];

    t.deepEqual(
        notifications,
        expectedNotifications,
        'expected notifications generated',
    );
});

// Make sure a successful command works with a retry.
test('successful command, with retry', async t => {
    const {
        runCommand,
        eventRepository,
        notificationHandler,
        libraryId,
    } = await setupTest();

    // Setup setup event repo so that it the first 2 writeEvent calls fail.
    const origWriteEvent = eventRepository.writeEvent;
    let numWriteAttempts = 0;
    const writeEvent = sinon.fake((...params) => {
        numWriteAttempts += 1;
        if (numWriteAttempts < 3) return Promise.resolve(false);
        return origWriteEvent(...params);
    });
    sinon.replace(eventRepository, 'writeEvent', writeEvent);

    await t.notThrowsAsync(
        runCommand('createLibrary', { libraryId }),
        'able to run createLibrary',
    );

    t.is(writeEvent.callCount, 3, 'writeEvent was retried');

    const events = await eventRepository.getEvents('library', libraryId);

    t.is(events.length, 1, 'event generated');
    t.deepEqual(
        events,
        [
            {
                aggregateName: 'library',
                aggregateId: libraryId,
                eventId: events[0].eventId,
                metadata: {},
                sequenceNumber: 1,
                type: 'CREATED',
                payload: { libraryId },
            },
        ],
        'correct event generated',
    );

    const notifications = notificationHandler.getNotifications();
    const expectedNotifications = [
        {
            name: 'eventWritten',
            notification: {
                aggregateName: 'library',
                aggregateId: libraryId,
                eventType: 'CREATED',
            },
        },
    ];

    t.deepEqual(
        notifications,
        expectedNotifications,
        'expected notifications generated',
    );
});

test('metadata written to events', async t => {
    const user = users.superSally;
    const metadata = { user };
    const { runCommand, eventRepository, libraryId } = await setupTest({
        eventMetadata: metadata,
    });

    await runCommand('createLibrary', { libraryId });
    await runCommand(
        'setLibraryName',
        { libraryId, name: 'North' },
        { appId: 1234 },
    );

    const events = await eventRepository.getEvents('library', libraryId);

    t.deepEqual(
        events.map(e => e.metadata),
        [{ user }, { user, appId: 1234 }],
        'command metadata stored to events',
    );
});

// Test that authorization is enforced.
test('authorization', async t => {
    const libraryId1 = shortid.generate();
    const libraryId2 = shortid.generate();
    const eventRepository = makeEventRepository();
    const notificationHandler = new NotificationHandler();
    const snapshotRepository = makeSnapshotRepository();
    const authorizer = getAuthorizer(libraryId1);

    const connect = user =>
        hebo.connect({
            eventRepository,
            snapshotRepository,
            notificationHandler,
            authorizer,
            user,
        });

    const { runCommand: runCommandSally } = connect(users.superSally);
    const { runCommand: runCommandMary } = connect(users.marySmith);
    const { runCommand: runCommandJohn } = connect(users.johnDoe);

    // marySmith had read-only privileges
    await t.throwsAsync(
        runCommandMary('createLibrary', { libraryId: libraryId1 }),
        UnauthorizedError,
        'error thrown when marySmith tries to run createLibrary',
    );

    // johnDoe cannot run the create command on libraries
    await t.throwsAsync(
        runCommandJohn('createLibrary', { libraryId: libraryId1 }),
        UnauthorizedError,
        'error thrown when johnDoe tries to run createLibrary',
    );

    // superSally can do anything
    await t.notThrowsAsync(
        runCommandSally('createLibrary', { libraryId: libraryId1 }),
        'superSally is allowed to run createLibrary',
    );

    // johnDoe can set the library name on library1
    await t.notThrowsAsync(
        runCommandJohn('setLibraryName', {
            libraryId: libraryId1,
            name: 'Smith',
        }),
        'johnDoe is allowed to run setLibraryName on the first library',
    );

    // Have superSally create a second library
    await t.notThrowsAsync(
        runCommandSally('createLibrary', { libraryId: libraryId2 }),
        'superSally is allowed to run createLibrary',
    );

    // johnDoe is not allowed to set the library name on library2
    await t.throwsAsync(
        runCommandJohn('setLibraryName', {
            libraryId: libraryId2,
            name: 'Johnson',
        }),
        UnauthorizedError,
        'johnDoe is not allowed to run setLibraryName on the second library',
    );
});
