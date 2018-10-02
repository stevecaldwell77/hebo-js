const autoBind = require('auto-bind');
const cloneDeep = require('lodash/cloneDeep');

module.exports = class NotificationHandlerInmemory {
    constructor(initialNotifications = []) {
        this.notifications = cloneDeep(initialNotifications);
        autoBind(this);
    }

    storeNotification(name, notification) {
        this.notifications.push({
            name,
            notification,
        });
    }

    getNotifications() {
        return this.notifications;
    }

    numNotifications() {
        return this.notifications.length;
    }

    hasNotifications() {
        return this.numNotifications() > 0;
    }

    clear() {
        this.notifications = [];
    }

    invalidEventsFound(notification) {
        this.storeNotification('invalidEventsFound', notification);
    }

    eventWritten(notification) {
        this.storeNotification('eventWritten', notification);
    }
};
