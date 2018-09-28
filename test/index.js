const test = require('ava');
const { isFunction, omit } = require('lodash');
const Hebo = require('../src');
const { UnknownAggregateError } = require('../src/errors');
const EventRepository = require('./helpers/event-repository-inmemory');
const SnapshotRepository = require('./helpers/snapshot-repository-inmemory');
const NotificationHandler = require('./helpers/notification-handler-inmemory');
const libraryAggregate = require('./helpers/aggregates/library');
const { users, getAuthorizer } = require('./helpers/authorizer');

test('constructor()', t => {
    const validParams = {
        aggregates: {
            library: libraryAggregate,
        },
    };

    t.notThrows(
        () => new Hebo(validParams),
        'can create Hebo with valid parameters',
    );

    t.throws(
        () => new Hebo(omit(validParams, 'aggregates')),
        /"aggregates" is required/,
        'aggregates required',
    );

    t.throws(
        () => new Hebo({ ...validParams, aggregates: { library: {} } }),
        /"projection" is required/,
        'aggregates must have a projection',
    );

    t.throws(
        () =>
            new Hebo({
                ...validParams,
                aggregates: {
                    library: {
                        projection: omit(
                            libraryAggregate.projection,
                            'initialState',
                        ),
                    },
                },
            }),
        /"initialState" is required/,
        'projection must have initialState()',
    );

    t.throws(
        () =>
            new Hebo({
                ...validParams,
                aggregates: {
                    library: {
                        projection: omit(
                            libraryAggregate.projection,
                            'applyEvent',
                        ),
                    },
                },
            }),
        /"applyEvent" is required/,
        'projection must have applyEvent()',
    );

    t.throws(
        () =>
            new Hebo({
                ...validParams,
                aggregates: {
                    library: {
                        projection: omit(
                            libraryAggregate.projection,
                            'validateState',
                        ),
                    },
                },
            }),
        /"validateState" is required/,
        'projection must have validateState()',
    );
});

test('connect()', t => {
    const hebo = new Hebo({
        aggregates: {
            library: libraryAggregate,
        },
    });

    const validParams = {
        eventRepository: new EventRepository(),
        snapshotRepository: new SnapshotRepository(),
        notificationHandler: new NotificationHandler(),
        authorizer: getAuthorizer(),
        user: users.superSally,
    };

    t.notThrows(
        () => hebo.connect(validParams),
        'connect() lives with valid parameters',
    );

    t.throws(
        () => hebo.connect(omit(validParams, 'eventRepository')),
        /"eventRepository" is required/,
        'connect() requires eventRepository',
    );

    t.throws(
        () => hebo.connect(omit(validParams, 'snapshotRepository')),
        /"snapshotRepository" is required/,
        'connect() requires snapshotRepository',
    );

    t.throws(
        () => hebo.connect(omit(validParams, 'notificationHandler')),
        /"notificationHandler" is required/,
        'connect() requires notificationHandler',
    );

    t.throws(
        () => hebo.connect(omit(validParams, 'authorizer')),
        /"authorizer" is required/,
        'connect() requires authorizer',
    );

    t.notThrows(
        () => hebo.connect(omit(validParams, 'user')),
        'connect() does not require user',
    );

    t.throws(
        () => hebo.connect({ ...validParams, eventRepository: {} }),
        /"getEvents" is required/,
        'connect() checks for valid eventRepository',
    );

    t.throws(
        () => hebo.connect({ ...validParams, snapshotRepository: {} }),
        /"getSnapshot" is required/,
        'connect() checks for valid snapshotRepository',
    );

    t.throws(
        () => hebo.connect({ ...validParams, notificationHandler: {} }),
        /"invalidEventsFound" is required/,
        'connect() checks for valid notificationHandler',
    );

    t.throws(
        () => hebo.connect({ ...validParams, authorizer: {} }),
        /"assert" is required/,
        'connect() checks for valid authorizer',
    );
});

test('getAggregate()', t => {
    const hebo = new Hebo({
        aggregates: {
            library: libraryAggregate,
        },
    });

    const getAggregate = hebo.connect({
        eventRepository: new EventRepository(),
        snapshotRepository: new SnapshotRepository(),
        notificationHandler: new NotificationHandler(),
        authorizer: getAuthorizer(),
        user: users.superSally,
    });

    const libraryAggregateInstance = getAggregate('library');
    t.true(
        isFunction(libraryAggregateInstance.getProjection),
        'fetched aggregate instance has getProjection()',
    );
    t.true(
        isFunction(libraryAggregateInstance.updateSnapshot),
        'fetched aggregate instance has updateSnapshot()',
    );

    t.throws(
        () => getAggregate('players'),
        UnknownAggregateError,
        'throws correct error on unknown aggregate',
    );
});
