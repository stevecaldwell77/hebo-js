const Joi = require('@hapi/joi');
const { noop } = require('lodash');
const { UnknownEventTypeError } = require('hebo-validation');
const {
    createReducer,
    getRequiredPayloadValue,
    assertInvariant,
    makeValidator,
} = require('../../../util');

const CREATED = 'CREATED';
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

const validateLibraryId = makeValidator(
    Joi.string()
        .min(5)
        .required(),
    'libraryId',
);

const validateLibraryName = makeValidator(
    Joi.string()
        .min(4)
        .required(),
    'name',
);

const validateCityName = makeValidator(
    Joi.string()
        .min(4)
        .required(),
    'name',
);

const validateBookId = makeValidator(
    Joi.string()
        .min(5)
        .required(),
    'bookId',
);

const applyEvent = createReducer({
    [CREATED]: (draft, event) => {
        const libraryId = getRequiredPayloadValue(event, 'libraryId');
        validateLibraryId(libraryId);
        draft = initialState(libraryId);
    },
    [NAME_SET]: (draft, event) => {
        const name = getRequiredPayloadValue(event, 'name');
        validateLibraryName(name);
        draft.libraryName = name;
    },
    [CITY_NAME_SET]: (draft, event) => {
        const name = getRequiredPayloadValue(event, 'name');
        validateCityName(name);
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
        validateBookId(bookId);
        draft.books.push(bookId);
    },
    [BOOK_REMOVED]: (draft, event) => {
        const bookId = getRequiredPayloadValue(event, 'bookId');
        validateBookId(bookId);
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

const commands = {
    // createLibrary({ libraryId })
    createLibrary: {
        isCreateCommand: true,
        validateParams: ({ libraryId }) => validateLibraryId(libraryId),
        createEvent: ({ libraryId }) => ({
            type: CREATED,
            payload: { libraryId },
        }),
    },

    // setLibraryName({ name })
    setLibraryName: {
        validateParams: ({ name }) => validateLibraryName(name),
        createEvent: ({ name }) => ({
            type: NAME_SET,
            payload: { name },
        }),
        retries: 3,
    },

    // setLibraryCityName({ name })
    setLibraryCityName: {
        validateParams: ({ name }) => validateCityName(name),
        createEvent: ({ name }) => ({
            type: CITY_NAME_SET,
            payload: { name },
        }),
    },

    // activateLibrary()
    activateLibrary: {
        validateParams: noop,
        createEvent: () => ({
            type: ACTIVATED,
            payload: {},
        }),
    },

    // deactivateLibrary()
    deactivateLibrary: {
        validateParams: noop,
        createEvent: () => ({
            type: DEACTIVATED,
            payload: {},
        }),
    },

    // addBookToLibrary({ bookId })
    addBookToLibrary: {
        validateParams: ({ bookId }) => validateBookId(bookId),
        createEvent: ({ bookId }) => ({
            type: BOOK_ADDED,
            payload: { bookId },
        }),
    },

    // removeBookFromLibrary({ bookId })
    removeBookFromLibrary: {
        validateParams: ({ bookId }) => validateBookId(bookId),
        createEvent: ({ bookId }) => ({
            type: BOOK_REMOVED,
            payload: { bookId },
        }),
    },
};

module.exports = {
    idField: 'libraryId',
    projection: {
        initialState,
        applyEvent,
        validateState,
    },
    commands,
};
