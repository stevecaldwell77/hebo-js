const test = require('ava');
const sinon = require('sinon');
const Notifier = require('../notifier');

test('event handlers are called', async t => {
    const onFoo = sinon.stub().resolves(true);
    const onBar = sinon.stub().resolves(true);
    const notificationHandler = {
        foo: onFoo,
        bar: onBar,
    };
    const notifier = new Notifier(notificationHandler);

    await notifier.emit('foo', 1, 'red', false);
    await notifier.emit('baz', 42);

    t.true(
        onFoo.calledOnceWith(1, 'red', false),
        'event handler correctl called on "emit"',
    );
    t.is(onBar.callCount, 0, 'event handler not called without "emit"');
});
