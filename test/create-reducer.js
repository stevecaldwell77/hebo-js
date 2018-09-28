import test from 'ava';
import { createReducer, getRequiredPayloadValue } from '../src/util';
import { UnknownEventTypeError } from '../src/errors';

const SET_FIRST_NAME = 'SET_FIRST_NAME';
const SET_LAST_NAME = 'SET_LAST_NAME';

const initialState = {
    firstName: null,
    lastName: null,
};

test('createReducer() - with no default', t => {
    const reducer = createReducer({
        [SET_FIRST_NAME]: (draft, event) => {
            const name = getRequiredPayloadValue(event, 'name');
            draft.firstName = name;
        },
        [SET_LAST_NAME]: (draft, event) => {
            const name = getRequiredPayloadValue(event, 'name');
            draft.lastName = name;
        },
    });

    const state2 = reducer(initialState, {
        type: SET_FIRST_NAME,
        payload: { name: 'John' },
    });

    t.deepEqual(
        state2,
        {
            firstName: 'John',
            lastName: null,
        },
        'reducer handles first event type',
    );

    const state3 = reducer(state2, {
        type: SET_LAST_NAME,
        payload: { name: 'Doe' },
    });

    t.deepEqual(
        state3,
        {
            firstName: 'John',
            lastName: 'Doe',
        },
        'reducer handles second event type',
    );

    const state4 = reducer(state3, {
        type: 'SET_ZIP_CODE',
        payload: { zip: '90066' },
    });

    t.deepEqual(state4, state3, 'unknown event type is ignored');
});

test('createReducer() - with default', t => {
    const reducer = createReducer({
        [SET_FIRST_NAME]: (draft, event) => {
            const name = getRequiredPayloadValue(event, 'name');
            draft.firstName = name;
        },
        [SET_LAST_NAME]: (draft, event) => {
            const name = getRequiredPayloadValue(event, 'name');
            draft.lastName = name;
        },
        default: (draft, event) => {
            throw new UnknownEventTypeError(event.type);
        },
    });

    const state2 = reducer(initialState, {
        type: SET_FIRST_NAME,
        payload: { name: 'John' },
    });

    t.deepEqual(
        state2,
        {
            firstName: 'John',
            lastName: null,
        },
        'reducer handles first event type',
    );

    t.throws(
        () =>
            reducer(state2, {
                type: 'SET_ZIP_CODE',
                payload: { zip: '90066' },
            }),
        UnknownEventTypeError,
        'unknown event type triggers default handler',
    );
});
