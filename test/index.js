const test = require('ava');
const shortid = require('shortid');
const { isFunction } = require('lodash');
const Hebo = require('../src');
const { UnknownAggregateError } = require('../src/errors');
const EventRepository = require('./helpers/event-repository-inmemory');
const SnapshotRepository = require('./helpers/snapshot-repository-inmemory');
const NotificationHandler = require('./helpers/notification-handler-inmemory');
const libraryAggregate = require('./helpers/aggregates/library');

const authorizerPass = { assert: () => true };
const userJohnDoe = { userId: shortid.generate(), username: 'jdoe' };

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
        authorizer: authorizerPass,
        user: userJohnDoe,
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
