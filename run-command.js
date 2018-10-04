const shortid = require('shortid');
const { validateEvent } = require('./validators');
const {
    AggregateNotFoundError,
    DuplicateAggregateError,
    InvalidCommandParamsError,
    MaxCommandAttemptsError,
} = require('./errors');

// Run parameter validation, throwing typed error if it fails.
const validateParams = ({
    runValidateParams,
    params,
    aggregateName,
    commandName,
}) => {
    try {
        runValidateParams(...params);
    } catch (err) {
        throw new InvalidCommandParamsError(
            err.message,
            aggregateName,
            commandName,
        );
    }
};

// Get our starting projection. Throw an error if the current projection status
// does not match our command type
const getProjection = async ({
    runGetProjection,
    aggregateName,
    aggregateId,
    isCreateCommand,
}) => {
    const projection = await runGetProjection(aggregateId, {
        missValue: 'newProjection',
    });
    const newProjection = projection.version === 0;
    if (isCreateCommand && !newProjection) {
        throw new DuplicateAggregateError(aggregateName, aggregateId);
    }
    if (!isCreateCommand && newProjection) {
        throw new AggregateNotFoundError(aggregateName, aggregateId);
    }
    return projection;
};

const createEvent = ({ runCreateEvent, params, user, version }) => {
    const eventDetails = runCreateEvent(...params);
    return {
        eventId: shortid.generate(),
        metadata: { user },
        version,
        ...eventDetails,
    };
};

const eventValidation = ({ applyEvent, validateState, prevState, event }) => {
    validateEvent(event);
    const newState = applyEvent(prevState, event);
    validateState(newState);
};

/*
runCommand:: (parameters) -> Promise<boolean>

This function will execute a defined command for a given aggregate.

Parameters:
  aggregateName: Name of aggregate type.

  aggregateId: Id of aggregate.

  commandName: Name of command to run.

  commandParams: Command arguments.

  isCreateCommand: Boolean indicating this command creates a new aggregate.

  validateParams: Function that should throw an error if there's an error in
  commandParams.

  getProjection: Function to get the existing projection for an aggregate.

  createEvent: Function to create an event.

  applyEvent: Function that applies the an event to a projection.

  validateState: Function that validates the state of a projection.

  writeEvent: Function to write an event to storage.

  retries: How many times should the command be retried if we fail to write it.

  notifier: EventEmitter object. Notifications emitted:
    * 'eventWritten' - an event was succesfully written.

  user: User object to use for authorization, and to store to event.

  assertAuthorized: Function to assert that user is authorized to perform
    operation. Should throw an error if not.
    Signature: (user, operation) -> Promise(void)
    operation will be: {
        type: 'runCommand', commandName, aggregateName, aggregateId
    }

 */
const runCommand = async args => {
    const {
        aggregateName,
        aggregateId,
        commandName,
        commandParams,
        isCreateCommand,
        validateParams: runValidateParams,
        getProjection: runGetProjection,
        createEvent: runCreateEvent,
        applyEvent,
        validateState,
        writeEvent,
        retries,
        notifier,
        assertAuthorized,
        user,
        attempts = 0,
    } = args;

    // Give up if we've tried too many times
    if (attempts > retries) {
        throw new MaxCommandAttemptsError(aggregateName, commandName, attempts);
    }

    // authorize user
    await assertAuthorized(user, {
        type: 'runCommand',
        commandName,
        aggregateName,
        aggregateId,
    });

    // For create commands, the parameters are just the aggregate id
    const params = isCreateCommand ? [aggregateId] : commandParams;

    validateParams({
        runValidateParams,
        params,
        aggregateName,
        commandName,
    });

    const projection = await getProjection({
        runGetProjection,
        aggregateName,
        aggregateId,
        isCreateCommand,
    });

    const event = createEvent({
        runCreateEvent,
        params,
        user,
        version: projection.version + 1,
    });

    eventValidation({
        applyEvent,
        validateState,
        prevState: projection.state,
        event,
    });

    const success = await writeEvent(aggregateName, aggregateId, event);

    // Retry if we failed to write event
    if (!success) {
        return runCommand({
            ...args,
            attempts: attempts + 1,
        });
    }

    await notifier.emit('eventWritten', {
        aggregateName,
        aggregateId,
        eventType: event.type,
    });

    return success;
};

module.exports = runCommand;
