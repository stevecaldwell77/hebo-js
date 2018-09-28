module.exports.EventPayloadError = class EventPayloadError extends Error {
    constructor(event, key) {
        const message = `event payload missing "${key}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.event = event;
        this.key = key;
    }
};

module.exports.InvalidEventError = class InvalidEventError extends Error {
    constructor(message, event) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.event = event;
    }
};

// eslint-disable-next-line max-len
module.exports.InvariantViolatedError = class InvariantViolatedError extends Error {
    constructor(aggregateName, aggregateId, state, message) {
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
        this.aggregateId = aggregateId;
        this.state = state;
    }
};

// eslint-disable-next-line max-len
module.exports.UnknownAggregateError = class UnknownAggregateError extends Error {
    constructor(aggregateName) {
        const message = `unknown aggregate "${aggregateName}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.aggregateName = aggregateName;
    }
};

// eslint-disable-next-line max-len
module.exports.UnknownEventTypeError = class UnknownEventTypeError extends Error {
    constructor(eventType) {
        const message = `unknown event type "${eventType}"`;
        super(message);
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
        this.eventType = eventType;
    }
};
