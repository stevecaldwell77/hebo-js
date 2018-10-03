const test = require('ava');
const shortid = require('shortid');
const sinon = require('sinon');
const Hebo = require('..');
const { UnauthorizedError } = require('../errors');
const EventRepository = require('./helpers/event-repository-inmemory');
const SnapshotRepository = require('./helpers/snapshot-repository-inmemory');
const NotificationHandler = require('./helpers/notification-handler-inmemory');
const libraryAggregate = require('./helpers/aggregates/library');
const { users, getAuthorizer } = require('./helpers/authorizer');

const hebo = new Hebo({
    aggregates: {
        library: libraryAggregate,
    },
});

const getEmptyEventRepository = () =>
    new EventRepository({ aggregates: { library: {} } });

const getEmptySnapshotRepository = () =>
    new SnapshotRepository({ library: {} });

const setupBasicLibrary = (name, city) => {
    const libraryId = shortid.generate();
    const eventRepository = getEmptyEventRepository();
    eventRepository.writeEvent('library', libraryId, {
        eventId: shortid.generate(),
        type: 'NAME_SET',
        payload: { name },
        metadata: {
            user: users.superSally,
        },
        version: 1,
    });
    eventRepository.writeEvent('library', libraryId, {
        eventId: shortid.generate(),
        type: 'CITY_NAME_SET',
        payload: { name: city },
        metadata: {
            user: users.superSally,
        },
        version: 2,
    });
    return { libraryId, eventRepository };
};

const runGetProjection = async ({
    aggregateName,
    aggregateId,
    eventRepository,
    snapshotRepository,
    authorizer,
    user = users.superSally,
    opts,
}) => {
    const notificationHandler = new NotificationHandler();
    const getAggregate = hebo.connect({
        eventRepository,
        snapshotRepository,
        notificationHandler,
        authorizer,
        user,
    });
    const getSnapshotSpy = sinon.spy(snapshotRepository, 'getSnapshot');
    const getEventsSpy = sinon.spy(eventRepository, 'getEvents');
    const aggregate = getAggregate(aggregateName);
    const projection = await aggregate.getProjection(aggregateId, opts);
    const updateSnapshot = () => aggregate.updateSnapshot(aggregateId);
    const getSnapshotCalls = getSnapshotSpy.getCalls().map(c => c.args);
    const getEventsCalls = getEventsSpy.getCalls().map(c => c.args);
    getSnapshotSpy.restore();
    getEventsSpy.restore();
    return {
        projection,
        getSnapshotCalls,
        getEventsCalls,
        notifications: notificationHandler.getNotifications(),
        updateSnapshot,
    };
};

const testGetProjection = async ({
    t,
    label,
    aggregateName,
    aggregateId,
    eventRepository,
    snapshotRepository,
    authorizer,
    user,
    expectedProjection,
    expectedGetSnapshotCalls,
    expectedGetEventsCalls,
    expectedNotifications,
}) => {
    const {
        projection,
        notifications,
        getSnapshotCalls,
        getEventsCalls,
        updateSnapshot,
    } = await runGetProjection({
        aggregateName,
        aggregateId,
        eventRepository,
        snapshotRepository,
        authorizer,
        user,
    });

    t.deepEqual(
        projection,
        expectedProjection,
        `${label}: correct projection returned`,
    );

    t.deepEqual(
        getSnapshotCalls,
        expectedGetSnapshotCalls,
        `${label}: getSnapshot() called as expected`,
    );

    t.deepEqual(
        getEventsCalls,
        expectedGetEventsCalls,
        `${label}: getEvents() called as expected`,
    );

    t.deepEqual(
        notifications,
        expectedNotifications,
        `${label}: expected notifications`,
    );

    return { updateSnapshot };
};

// Calling getProjection() for an aggregate that has no events
test('aggregate does not exist', async t => {
    const libraryId = shortid.generate();
    const authorizer = getAuthorizer(libraryId);
    const { projection, notifications } = await runGetProjection({
        aggregateName: 'library',
        aggregateId: libraryId,
        eventRepository: getEmptyEventRepository(),
        snapshotRepository: getEmptySnapshotRepository(),
        authorizer,
    });
    t.is(projection, undefined, 'returns undefined for unknown aggregate id');
    t.deepEqual(notifications, [], 'no notifications');
});

// Calling getProjection() for an aggregate that has no events, but we want a
// new projection to be returned.
test('aggregate does not exist, missValue = "newProjection"', async t => {
    const libraryId = shortid.generate();
    const authorizer = getAuthorizer(libraryId);
    const { projection } = await runGetProjection({
        aggregateName: 'library',
        aggregateId: libraryId,
        eventRepository: getEmptyEventRepository(),
        snapshotRepository: getEmptySnapshotRepository(),
        authorizer,
        opts: { missValue: 'newProjection' },
    });
    t.deepEqual(
        projection,
        {
            state: {
                libraryId,
                libraryName: null,
                cityName: null,
                active: false,
                books: [],
            },
            version: 0,
            invalidEvents: [],
            ignoredEvents: [],
        },
        'returns initialized projection',
    );
});

// Calling getProjection() for an aggregate that has no snapshot, but has events
test('aggregate with no snapshot', async t => {
    const { libraryId, eventRepository } = setupBasicLibrary(
        'North Branch',
        'Los Angeles',
    );
    const snapshotRepository = getEmptySnapshotRepository();
    const authorizer = getAuthorizer(libraryId);

    await testGetProjection({
        t,
        label: 'no snaphot',
        aggregateName: 'library',
        aggregateId: libraryId,
        eventRepository,
        snapshotRepository,
        authorizer,
        expectedProjection: {
            state: {
                libraryId,
                libraryName: 'North Branch',
                cityName: 'Los Angeles',
                active: false,
                books: [],
            },
            version: 2,
            invalidEvents: [],
            ignoredEvents: [],
        },
        expectedGetSnapshotCalls: [['library', libraryId]],
        expectedGetEventsCalls: [['library', libraryId, 0]],
        expectedNotifications: [],
    });
});

// Test calling getProjection() with snapshots, both latest and outdated
test('aggregate with snapshots', async t => {
    const { libraryId, eventRepository } = setupBasicLibrary(
        'North Branch',
        'Los Angeles',
    );
    const snapshotRepository = getEmptySnapshotRepository();
    const authorizer = getAuthorizer(libraryId);

    // Save snapshot with basic library (which is version 2)
    const { updateSnapshot } = await runGetProjection({
        aggregateName: 'library',
        aggregateId: libraryId,
        eventRepository,
        snapshotRepository,
        authorizer,
    });
    await updateSnapshot();

    // OK, now our snapshot repo has a projection at version 2
    // Test that calling getProjection() works again, but uses snapshot.
    await testGetProjection({
        t,
        label: 'up-to-date snaphot',
        aggregateName: 'library',
        aggregateId: libraryId,
        eventRepository,
        snapshotRepository,
        authorizer,
        expectedProjection: {
            state: {
                libraryId,
                libraryName: 'North Branch',
                cityName: 'Los Angeles',
                active: false,
                books: [],
            },
            version: 2,
            invalidEvents: [],
            ignoredEvents: [],
        },
        expectedGetSnapshotCalls: [['library', libraryId]],
        expectedGetEventsCalls: [['library', libraryId, 2]],
        expectedNotifications: [],
    });

    // Now add one more event, and make sure everything still works correctly.
    eventRepository.writeEvent('library', libraryId, {
        eventId: shortid.generate(),
        type: 'CITY_NAME_SET',
        payload: { name: 'Playa Del Rey' },
        metadata: {
            user: users.superSally,
        },
        version: 3,
    });

    await testGetProjection({
        t,
        label: 'out-of-date snaphot',
        aggregateName: 'library',
        aggregateId: libraryId,
        eventRepository,
        snapshotRepository,
        authorizer,
        expectedProjection: {
            state: {
                libraryId,
                libraryName: 'North Branch',
                cityName: 'Playa Del Rey', // this was updated
                active: false,
                books: [],
            },
            version: 3, // this was updated
            invalidEvents: [],
            ignoredEvents: [],
        },
        expectedGetSnapshotCalls: [['library', libraryId]],
        expectedGetEventsCalls: [['library', libraryId, 2]],
        expectedNotifications: [],
    });
});

// // Test calling getProjection() with a event store that has a bad event
test('handing bad events', async t => {
    const { libraryId, eventRepository } = setupBasicLibrary(
        'North Branch',
        'Los Angeles',
    );
    const snapshotRepository = getEmptySnapshotRepository();
    const authorizer = getAuthorizer(libraryId);

    // Add some invalid events that theoretically should not have been allowed
    // into the event store. But maybe they were valid at the time, and our
    // rules changed later.

    // Invalid event: missing a name in the payload.
    const invalidEvent1 = {
        eventId: shortid.generate(),
        type: 'CITY_NAME_SET',
        payload: {},
        metadata: {
            user: users.superSally,
        },
        version: 3,
    };
    eventRepository.writeEvent('library', libraryId, invalidEvent1);

    // Invalid event: our library doesn't have any books yet.
    const invalidEvent2 = {
        eventId: shortid.generate(),
        type: 'ACTIVATED',
        payload: {},
        metadata: {
            user: users.superSally,
        },
        version: 4,
    };
    eventRepository.writeEvent('library', libraryId, invalidEvent2);

    // Now add a valid event. This event should be successfully applied to the
    // projection.
    eventRepository.writeEvent('library', libraryId, {
        eventId: shortid.generate(),
        type: 'NAME_SET',
        payload: { name: 'Rodgers Branch' },
        metadata: {
            user: users.superSally,
        },
        version: 5,
    });

    // One more invalid event: missing metadata. This is going to fail the basic
    // validateEvent() check - i.e. our framework doesn't recognize this as a
    // valid event. This could happen if there was an error in the event
    // repository implementation.
    const invalidEvent3 = {
        eventId: shortid.generate(),
        type: 'CITY_NAME_SET',
        payload: {
            name: 'Playa Vista',
        },
        version: 6,
    };
    eventRepository.forceWriteEvent('library', libraryId, invalidEvent3);

    // Expected:
    //  * The bad events are stored to invalidEvents
    //  * The bad events should not have affected the state
    //  * The later good event is still applied to the state
    //  * The projection version should have been incremented
    //  * We get a notification about the invalid events.
    const { updateSnapshot } = await testGetProjection({
        t,
        label: 'unhandled bad events',
        aggregateName: 'library',
        aggregateId: libraryId,
        eventRepository,
        snapshotRepository,
        authorizer,
        expectedProjection: {
            state: {
                libraryId,
                libraryName: 'Rodgers Branch', // this was updated by event 5
                cityName: 'Los Angeles',
                active: false,
                books: [],
            },
            version: 6, // this was updated to the last event
            invalidEvents: [
                {
                    eventId: invalidEvent1.eventId,
                    error: {
                        name: 'EventPayloadError',
                        message: 'event payload missing "name"',
                    },
                },
                {
                    eventId: invalidEvent2.eventId,
                    error: {
                        name: 'InvariantViolatedError',
                        message: 'An active library must have at least 1 book',
                    },
                },
                {
                    eventId: invalidEvent3.eventId,
                    error: {
                        name: 'InvalidEventError',
                        message: '"metadata" is required',
                    },
                },
            ],
            ignoredEvents: [],
        },
        expectedGetSnapshotCalls: [['library', libraryId]],
        expectedGetEventsCalls: [['library', libraryId, 0]],
        expectedNotifications: [
            {
                name: 'invalidEventsFound',
                notification: {
                    aggregateName: 'library',
                    aggregateId: libraryId,
                    eventIds: [
                        invalidEvent1.eventId,
                        invalidEvent2.eventId,
                        invalidEvent3.eventId,
                    ],
                },
            },
        ],
    });

    // Snapshot our projection, to make sure that invalid events are retrieved
    // correctly below.
    await updateSnapshot();

    // Now create 2 events that resolve the 3 issues.
    const resolvingEvent1 = {
        eventId: shortid.generate(),
        type: 'CITY_NAME_SET',
        payload: {
            name: 'Playa Vista',
        },
        metadata: {
            user: users.superSally,
            resolvesEventIds: [invalidEvent1.eventId, invalidEvent3.eventId],
        },
        version: 7,
    };
    eventRepository.writeEvent('library', libraryId, resolvingEvent1);

    const resolvingEvent2 = {
        eventId: shortid.generate(),
        type: 'DEACTIVATED',
        payload: {},
        metadata: {
            user: users.superSally,
            resolvesEventIds: [invalidEvent2.eventId],
        },
        version: 8,
    };
    eventRepository.writeEvent('library', libraryId, resolvingEvent2);

    // Expected:
    //  * The new events are applied
    //  * The bad events are moved to ignoredEvents
    //  * No notifications generated.
    await testGetProjection({
        t,
        label: 'bad events resolved',
        aggregateName: 'library',
        aggregateId: libraryId,
        eventRepository,
        snapshotRepository,
        authorizer,
        expectedProjection: {
            state: {
                libraryId,
                libraryName: 'Rodgers Branch',
                cityName: 'Playa Vista',
                active: false,
                books: [],
            },
            version: 8,
            invalidEvents: [],
            ignoredEvents: [
                {
                    eventId: invalidEvent1.eventId,
                    resolvingEventId: resolvingEvent1.eventId,
                },
                {
                    eventId: invalidEvent3.eventId,
                    resolvingEventId: resolvingEvent1.eventId,
                },
                {
                    eventId: invalidEvent2.eventId,
                    resolvingEventId: resolvingEvent2.eventId,
                },
            ],
        },
        expectedGetSnapshotCalls: [['library', libraryId]],
        expectedGetEventsCalls: [['library', libraryId, 6]],
        expectedNotifications: [],
    });
});

test('authorization', async t => {
    const libraryId1 = shortid.generate();
    const libraryId2 = shortid.generate();
    const eventRepository = getEmptyEventRepository();
    const snapshotRepository = getEmptySnapshotRepository();
    const authorizer = getAuthorizer(libraryId1);

    const run = (libraryId, user) =>
        runGetProjection({
            aggregateName: 'library',
            aggregateId: libraryId,
            eventRepository,
            snapshotRepository,
            authorizer,
            user,
        });

    await t.notThrows(
        run(libraryId1, users.superSally),
        'superuser able to run getProjection() on first library',
    );

    await t.notThrows(
        run(libraryId1, users.marySmith),
        'read-all user is able to run getProjection() on first library',
    );

    await t.notThrows(
        run(libraryId1, users.johnDoe),
        'library-specific user is able to run getProjection() on first library',
    );

    await t.notThrows(
        run(libraryId2, users.superSally),
        'superuser able to run getProjection() on second library',
    );

    await t.notThrows(
        run(libraryId2, users.marySmith),
        'read-all user is able to run getProjection() on second library',
    );

    await t.throws(
        run(libraryId2, users.johnDoe),
        UnauthorizedError,
        'error thrown when library-specific user runs getProjection() on a ' +
            'different library',
    );
});
