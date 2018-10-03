class AggregateNotFoundError extends Error {
    constructor(aggregateName, aggregateId) {
        super(
            `cannot find aggregate "${aggregateName}" with id "${aggregateId}"`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.aggregateId = aggregateId;
    }
}

class DuplicateAggregateError extends Error {
    constructor(aggregateName, aggregateId) {
        super(`"${aggregateName}" with id "${aggregateId}" already exists`);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.aggregateId = aggregateId;
    }
}

class EventPayloadError extends Error {
    constructor(event, key) {
        const message = `event payload missing "${key}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.event = event;
        this.key = key;
    }
}

class InvalidAggregateError extends Error {
    constructor(message, aggregateName) {
        super(`invalid aggregate "${aggregateName}": ${message}`);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
    }
}

class InvalidEventError extends Error {
    constructor(message, event) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.event = event;
    }
}

class InvalidCommandError extends Error {
    constructor(message, aggregateName, commandName) {
        super(
            `aggregate "${aggregateName}": command "${commandName}" ` +
                `is invalid: ${message}`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.commandName = commandName;
    }
}

class InvalidCommandParamsError extends Error {
    constructor(message, aggregateName, commandName) {
        super(
            `aggregate "${aggregateName}": command "${commandName}" ` +
                `called with invalid params: ${message}`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.commandName = commandName;
    }
}

class InvalidProjectionError extends Error {
    constructor(message, aggregateName) {
        super(
            `aggregate "${aggregateName}" has an invalid projection: ` +
                `${message}`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
    }
}

class InvariantViolatedError extends Error {
    constructor(aggregateName, aggregateId, state, message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.aggregateId = aggregateId;
        this.state = state;
    }
}

class MaxCommandAttemptsError extends Error {
    constructor(aggregateName, commandName, attempts) {
        super(
            `aggregate "${aggregateName}": command "${commandName}" failed ` +
                `after ${attempts} attempts`,
        );
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.commandName = commandName;
        this.attempts = attempts;
    }
}

class UnauthorizedError extends Error {
    constructor(operation, userDesc) {
        const message = `user ${userDesc} is not allowed to call ${
            operation.type
        } on ${operation.aggregateName} ${operation.aggregateId}`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.operation = operation;
        this.userDesc = userDesc;
    }
}

class UnknownAggregateError extends Error {
    constructor(aggregateName) {
        const message = `unknown aggregate "${aggregateName}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
    }
}

class UnknownCommandError extends Error {
    constructor(aggregateName, commandName) {
        const message =
            `aggregate "${aggregateName}": unknown command ` +
            `"${commandName}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.commandName = commandName;
    }
}

class UnknownEventTypeError extends Error {
    constructor(eventType) {
        const message = `unknown event type "${eventType}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.eventType = eventType;
    }
}

module.exports = {
    AggregateNotFoundError,
    DuplicateAggregateError,
    EventPayloadError,
    InvalidAggregateError,
    InvalidCommandError,
    InvalidCommandParamsError,
    InvalidEventError,
    InvalidProjectionError,
    InvariantViolatedError,
    MaxCommandAttemptsError,
    UnauthorizedError,
    UnknownAggregateError,
    UnknownCommandError,
    UnknownEventTypeError,
};
