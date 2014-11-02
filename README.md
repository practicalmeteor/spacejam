[![Build Status](https://travis-ci.org/spacejamio/spacejam.svg?branch=master)](https://travis-ci.org/spacejamio/spacejam)

## SpaceJam

**spacejam** is a console test runner for [meteor](https://www.meteor.com/) packages. It wraps meteor test-packages with some enhancements, allowing you to easily run your package tinytests or [munit](https://atmospherejs.com/package/munit) tests from the command line. It's primary use is in continuous integration environments. It starts meteor test-packages, waits for it to be ready, and then runs the tinytests or [munit](https://atmospherejs.com/package/munit) tests in phantomjs. The npm package also includes helper scripts to easily run meteor and test meteor packages in parallel, tag package builds in Travis CI and publish packages from Travis CI build tags.

## Table of Contents

- [Installation](#installation)

- [Commands](#commands)

    - [spacejam test-packages](#spacejam-test-packages)

        - [Running your package tests without a meteor app](#running-your-package-tests-without-a-meteor-app)

        - [Exit codes](#exit-codes)

    - [spacjam package-version](#spacjam-package-version)

- [Contributing](#contributing)

- [Changelog](#changelog)

- [License](#license)

## Installation

For current user:

```bash
npm install -g spacejam
```

For all users:

```bash
# The -H is required
sudo -H npm install -g spacejam
```

This will automatically add spacejam and all the scripts it includes to your path.

## Commands

### spacejam test-packages

`spacejam test-packages [options] [package...]`

**package...** can be a list of packages with tinytests or [munit](https://atmospherejs.com/package/munit) tests.
It enhances meteor test-packages, by supporting glob wildcards on package names that are matched against all package names in the meteor app packages folder. Useful if all your package names start with the same prefix.

If not specified, will call meteor test-packages without arguments which will result in meteor testing all of the following packages:

1. All of your app's packages, if run from within a meteor app folder.

2. All of the packages meteor will find in all the folders specified in the PACKAGE_DIRS environment variable.

The following options are specific to spacejam:

`--log-level <level>`

spacejam log level. One of trace|debug|info|warn|error. Defaults to info.

`--root-url <url>`

The meteor ROOT_URL. Defaults to http://localhost:--port/, and not ROOT_URL, to avoid conflicts with your meteor app ROOT_URL.

`--mongo-url <url>`

The meteor MONGO_URL. Defaults to none, and not MONGO_URL, to avoid conflicts with your meteor app MONGO_URL.

`--timeout  <milliseconds>`
     
Total timeout for all tests. Defaults to 120000 milliseconds, i.e. 2 minutes.
                                  
The following options are meteor options and are passed through to meteor (all are optional):

`--port <port>`
                 
The meteor port. Defaults to 4096, and not PORT, to avoid conflicts with your meteor app PORT.

`--settings <file>`

Path to a meteor settings file.

`--production`

Simulate meteor production mode. Minify and bundle CSS and JS files.

`--release <version>`

Specify the release of Meteor to use.
                                  
To get help, just:

```
spacejam help
```

#### Running your package tests without a meteor app

From within your package folder, run:

````
spacejam test-packages ./
```

#### Exit codes

```spacejam``` will return the following exit codes:

* ```0``` All the tests have passed in all packages.
* ```1``` ```spacejam``` usage or internal error.
* ```2``` At least one test has failed.
* ```3``` The meteor app has errors.
* ```4``` The tests have timed out.

### spacejam package-version

Prints the package version in the current working directory's package.js

## Changelog

See [CHANGELOG.md](CHANGELOG.md)

## Contributing

Contributions are more than welcome. Just create pull requests and make sure to include proper test coverage. We use mocha.js for tests and run our tests using CoffeScript's cake, so `npm test` will run `cake test`.

Note that we plan to include support for running tests in any browser and in sauce from the command line so if you plan to add this, check with us if we already started working on it.

## License

[MIT](LICENSE.txt)
