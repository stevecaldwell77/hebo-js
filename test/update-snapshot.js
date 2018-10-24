const test = require('ava');
const shortid = require('shortid');
const uuid = require('uuid/v4');
const sinon = require('sinon');
const EventRepository = require('hebo-event-repository-inmemory');
const SnapshotRepository = require('hebo-snapshot-repository-inmemory');
const NotificationHandler = require('hebo-notification-handler-inmemory');
const { UnauthorizedError } = require('hebo-validation');
const Hebo = require('..');
const libraryAggregate = require('./helpers/aggregates/library');
const { users, getAuthorizer } = require('./helpers/authorizer');

const hebo = new Hebo({
    aggregates: {
        library: libraryAggregate,
    },
});

const setupTest = async (user = users.superSally) => {
    const libraryId = shortid.generate();
    const eventRepository = new EventRepository({ aggregates: ['library'] });
    const snapshotRepository = new SnapshotRepository({
        aggregates: ['library'],
    });
    const authorizer = getAuthorizer(libraryId);

    const { getAggregate } = hebo.connect({
        eventRepository,
        snapshotRepository,
        notificationHandler: new NotificationHandler(),
        authorizer,
        user,
    });

    await eventRepository.writeEvent({
        aggregateName: 'library',
        aggregateId: libraryId,
        eventId: uuid(),
        type: 'CITY_NAME_SET',
        payload: { name: 'Los Angeles' },
        metadata: {
            user: users.superSally,
        },
        sequenceNumber: 1,
    });

    return {
        libraryId,
        getAggregate,
        eventRepository,
        snapshotRepository,
    };
};

test('updateSnapshot() writes snapshot correctly', async t => {
    const {
        getAggregate,
        libraryId,
        eventRepository,
        snapshotRepository,
    } = await setupTest();

    const writeSnapshotSpy = sinon.spy(snapshotRepository, 'writeSnapshot');

    const expectedProjection1 = {
        ignoredEvents: [],
        invalidEvents: [],
        state: {
            libraryId,
            libraryName: null,
            cityName: 'Los Angeles',
            active: false,
            books: [],
        },
        version: 1,
    };

    await getAggregate('library').updateSnapshot(libraryId);

    t.is(writeSnapshotSpy.callCount, 1, 'writeSnapshot() called');
    t.deepEqual(
        writeSnapshotSpy.args[0],
        ['library', libraryId, expectedProjection1],
        'writeSnapshot() called with expected args',
    );

    const snapshot1 = await snapshotRepository.getSnapshot(
        'library',
        libraryId,
    );

    t.deepEqual(
        snapshot1,
        expectedProjection1,
        'snapshotted projection is expected',
    );

    await eventRepository.writeEvent({
        aggregateName: 'library',
        aggregateId: libraryId,
        eventId: uuid(),
        type: 'NAME_SET',
        payload: { name: 'South Branch' },
        metadata: {
            user: users.superSally,
        },
        sequenceNumber: 2,
    });

    const expectedProjection2 = {
        ignoredEvents: [],
        invalidEvents: [],
        state: {
            libraryId,
            libraryName: 'South Branch',
            cityName: 'Los Angeles',
            active: false,
            books: [],
        },
        version: 2,
    };

    await getAggregate('library').updateSnapshot(libraryId);

    const snapshot2 = await snapshotRepository.getSnapshot(
        'library',
        libraryId,
    );

    t.deepEqual(
        snapshot2,
        expectedProjection2,
        'after new event, snapshotted projection is expected',
    );
});

test('authorization - valid user allowed', async t => {
    const { getAggregate, libraryId } = await setupTest(users.johnDoe);
    await t.notThrows(
        getAggregate('library').updateSnapshot(libraryId),
        'no error thrown when user has privileges on aggregate',
    );
});

test('authorization - invalid user throws error', async t => {
    const { getAggregate, libraryId } = await setupTest(users.marySmith);
    await t.throws(
        getAggregate('library').updateSnapshot(libraryId),
        UnauthorizedError,
        'error thrown when user does not have privileges',
    );
});
