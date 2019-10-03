class Notifier {
    constructor(notificationHandler) {
        this.notificationHandler = notificationHandler;
    }

    async emit(eventName, args) {
        const handler = this.notificationHandler[eventName];
        if (handler) {
            await handler(args);
        }
    }
}

module.exports = Notifier;
