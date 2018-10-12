const isNil = require('lodash/isNil');
const { validateEvent } = require('hebo-validation');

// Produces an initial projection from calling initialState.
const makeInitialProjection = (aggregateId, initialState) => ({
    state: initialState(aggregateId),
    version: 0,
    invalidEvents: [],
    ignoredEvents: [],
});

// Gets the previous projection for an aggregate
const getPrevProjection = async ({
    aggregateName,
    aggregateId,
    initialState,
    getSnapshot,
}) => {
    const currentSnapshot = await getSnapshot(aggregateName, aggregateId);
    return isNil(currentSnapshot)
        ? makeInitialProjection(aggregateId, initialState)
        : currentSnapshot;
};

// Applies an event to a projection's state, and runs validation.
const applyEventToState = ({ prevState, event, applyEvent, validateState }) => {
    const newState = applyEvent(prevState, event);
    validateState(newState);
    return newState;
};

// Find any invalid events the projection previously had that were resolved by
// an event.
const getResolvedEvents = ({ prevProjection, event }) => {
    const { resolvesEventIds } = event.metadata;
    if (!(resolvesEventIds && resolvesEventIds.length > 0)) {
        return [];
    }
    const eventIdSet = new Set(resolvesEventIds);
    return prevProjection.invalidEvents.filter(e => eventIdSet.has(e.eventId));
};

// Produce a projection's invalidEvents, given its previous contents and any
// events that have now been resolved.
const getInvalidEvents = ({ prevProjection, resolvedEvents }) => {
    const eventIds = new Set(resolvedEvents.map(e => e.eventId));
    return prevProjection.invalidEvents.filter(e => !eventIds.has(e.eventId));
};

// Produce a projection's ignoredEvents, given its previous contents and any
// events that have now been resolved.
const getIgnoredEvents = ({ prevProjection, resolvedEvents, event }) => [
    ...prevProjection.ignoredEvents,
    ...resolvedEvents.map(re => ({
        eventId: re.eventId,
        resolvingEventId: event.eventId,
    })),
];

// Handles an event that was successfully applied to a projection.
const handleValidEvent = ({ prevProjection, event, newState }) => {
    const resolvedEvents = getResolvedEvents({
        prevProjection,
        event,
    });
    return {
        ...prevProjection,
        state: newState,
        version: event.sequenceNumber,
        invalidEvents: getInvalidEvents({ prevProjection, resolvedEvents }),
        ignoredEvents: getIgnoredEvents({
            prevProjection,
            resolvedEvents,
            event,
        }),
    };
};

// Handles an event that threw an error when applied.
const handleBadEvent = ({ prevProjection, event, err }) => {
    const condensedError = {
        name: err.name,
        message: err.message,
    };
    return {
        ...prevProjection,
        version: event.sequenceNumber,
        invalidEvents: [
            ...prevProjection.invalidEvents,
            {
                eventId: event.eventId,
                error: condensedError,
            },
        ],
    };
};

// Applies an event to a projection, trapping and raised errors and storing the
// offending event in invalidEvents.
const eventReducer = ({ applyEvent, validateState }) => (
    prevProjection,
    event,
) => {
    let result;
    try {
        validateEvent(event);
        const newState = applyEventToState({
            prevState: prevProjection.state,
            event,
            applyEvent,
            validateState,
        });
        result = handleValidEvent({
            prevProjection,
            event,
            newState,
        });
    } catch (err) {
        result = handleBadEvent({
            prevProjection,
            event,
            err,
        });
    }
    return result;
};

// Applies a set of events to a previous projection
const applyEvents = ({ prevProjection, events, applyEvent, validateState }) =>
    events.reduce(eventReducer({ applyEvent, validateState }), prevProjection);

// Emit a notification if we produced an aggregate with invalid events.
const notifyIfInvalidEvents = async (
    aggregateName,
    aggregateId,
    projection,
    notifier,
) => {
    if (projection.invalidEvents.length > 0) {
        const eventIds = projection.invalidEvents.map(e => e.eventId);
        await notifier.emit('invalidEventsFound', {
            aggregateName,
            aggregateId,
            eventIds,
        });
    }
};

/*

getProjection:: (parameters) -> Promise<object>

This function will fetch a projection for a given aggregate.

Parameters:
  aggregateName: Name of aggregate type.

  aggregateId: Id of aggregate.

  getSnapshot: Function for retrieving a previously-stored snapshot of this
    aggregate's projection.
    Signature: (aggregateName, aggregateId) -> Promise<projectionSnapshot|null>

  initialState: Function to get starting state.
    Signature: (aggregateId) -> newState

  getEvents: Function for retrieving events for the aggregate.
    Signature: (aggregateName, aggregateId, greaterThanSequenceNumber)
      -> Promise<Array<events>>

  applyEvent: Function for applying an event to a previous projection. Used to
    build the resulting projection from retrieved events.
    Signature: (prevState, event) -> newState

  validateState: Function for validating a state object. Should throw an error
    if the state violates one of its aggregate's invariants.
    Signature: (state) -> void

  notifier: EventEmitter object. Notifications emitted:
    * 'invalidEventsFound' - an invalid event was found in the build projection.

  user: User object to use for authorization.

  assertAuthorized: Function to assert that user is authorized to perform
    operation. Should throw an error if not.
    Signature: (user, operation) -> Promise(void)
    operation will be: { type: 'getProjection', aggregateName, aggregateId }

  missValue: Controls return value generated for missing aggregate. One of:
   * 'none' (default) - return undefined
   * 'newProjection' - return an initialized projection

Return value: Promise containing projection.

 */
const getProjection = async ({
    aggregateName,
    aggregateId,
    initialState,
    validateState,
    applyEvent,
    getSnapshot,
    getEvents,
    notifier,
    assertAuthorized,
    user,
    missValue = 'none',
}) => {
    // authorize user
    await assertAuthorized(user, {
        type: 'getProjection',
        aggregateName,
        aggregateId,
    });

    // Get the starting projection
    const prevProjection = await getPrevProjection({
        aggregateName,
        aggregateId,
        initialState,
        getSnapshot,
    });

    // Get all following events
    const events = await getEvents(
        aggregateName,
        aggregateId,
        prevProjection.version,
    );

    // If we're at version 0 with no events, this is a miss.
    const miss = prevProjection.version === 0 && events.length === 0;
    if (miss) {
        return missValue === 'newProjection' ? prevProjection : undefined;
    }

    // Apply all the events and return the result
    const projection = applyEvents({
        prevProjection,
        events,
        applyEvent,
        validateState,
    });

    // Notify about any errors
    await notifyIfInvalidEvents(
        aggregateName,
        aggregateId,
        projection,
        notifier,
    );

    // Return the built projection
    return projection;
};

module.exports = getProjection;
