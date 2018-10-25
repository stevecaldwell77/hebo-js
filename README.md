# hebo

[![build status](https://img.shields.io/travis/stevecaldwell77/hebo-js.svg)](https://travis-ci.org/stevecaldwell77/hebo-js)
[![code coverage](https://img.shields.io/codecov/c/github/stevecaldwell77/hebo-js.svg)](https://codecov.io/gh/stevecaldwell77/hebo-js)
[![code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![made with lass](https://img.shields.io/badge/made_with-lass-95CC28.svg)](https://lass.js.org)
[![license](https://img.shields.io/github/license/stevecaldwell77/hebo-js.svg)](LICENSE)

> Simple CQRS / Event Sourcing Container


## Table of Contents

* [Install](#install)
* [Usage](#usage)
* [Contributors](#contributors)
* [License](#license)


## Install

[npm][]:

```sh
npm install hebo
```

[yarn][]:

```sh
yarn add hebo
```


## Usage

```js
// Meant to be done at require time
const Hebo = require('hebo');
const libraryAggregate = require('./path/to/my/libraryAggregate');
const bookAggregate = require('./path/to/my/bookAggregate');

const hebo = new Hebo({
    aggregates: {
      library: libraryAggregate,
      book: bookAggregate,
    }
})

// ... and then do this at runtime:
const { getProjection, runCommand, updateSnapshot } = hebo.connect({
    eventRepository,
    snapshotRepository,
    notificationHandler,
    authorizer,
    user,
});

await runCommand('createLibrary', 1234);
await runCommand('setLibraryName', 1234, 'North Branch');

const library = getProjection('library', 1234);

await updateSnapshot('library', 1234);
```


## Contributors

| Name               |
| ------------------ |
| **Steve Caldwell** |


## License

[MIT](LICENSE) © Steve Caldwell


## 

[npm]: https://www.npmjs.com/

[yarn]: https://yarnpkg.com/
