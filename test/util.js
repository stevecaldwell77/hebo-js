const test = require('ava');
const Joi = require('@hapi/joi');
const heboUtil = require('../util');

test('makeValidator', t => {
    const idValidator = heboUtil.makeValidator(
        Joi.string()
            .min(5)
            .required(),
        'myId',
    );
    const validate = id => idValidator(id);

    t.throws(
        () => validate('asdf'),
        'myId "value" length must be at least 5 characters long',
        'correct error throw when asserting validator with invalid value',
    );

    t.notThrows(
        () => validate('abcdef'),
        'no error throw when asserting validator with valid value',
    );
});
