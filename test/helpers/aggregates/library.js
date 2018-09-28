const {
    createReducer,
    getRequiredPayloadValue,
    assertInvariant,
} = require('../../../src/util');
const { UnknownEventTypeError } = require('../../../src/errors');

const NAME_SET = 'NAME_SET';
const CITY_NAME_SET = 'CITY_NAME_SET';
const ACTIVATED = 'ACTIVATED';
const DEACTIVATED = 'DEACTIVATED';
const BOOK_ADDED = 'BOOK_ADDED';
const BOOK_REMOVED = 'BOOK_REMOVED';

const initialState = libraryId => ({
    libraryId,
    libraryName: null,
    cityName: null,
    active: false,
    books: [],
});

const applyEvent = createReducer({
    [NAME_SET]: (draft, event) => {
        const name = getRequiredPayloadValue(event, 'name');
        draft.libraryName = name;
    },
    [CITY_NAME_SET]: (draft, event) => {
        const name = getRequiredPayloadValue(event, 'name');
        draft.cityName = name;
    },
    [ACTIVATED]: draft => {
        draft.active = true;
    },
    [DEACTIVATED]: draft => {
        draft.active = false;
    },
    [BOOK_ADDED]: (draft, event) => {
        const bookId = getRequiredPayloadValue(event, 'bookId');
        draft.books.push(bookId);
    },
    [BOOK_REMOVED]: (draft, event) => {
        const bookId = getRequiredPayloadValue(event, 'bookId');
        draft.books = draft.books.filter(book => book.bookId !== bookId);
    },
    default: (draft, event) => {
        throw new UnknownEventTypeError(event.type);
    },
});

const validateState = state => {
    const assert = assertInvariant('library', state.libraryId, state);

    if (state.active) {
        assert(state.libraryName, 'An active library must have a name');
        assert(state.cityName, 'An active library must have a city name');
        assert(
            state.books.length > 0,
            'An active library must have at least 1 book',
        );
    }
};

module.exports = {
    projection: {
        initialState,
        applyEvent,
        validateState,
    },
};
