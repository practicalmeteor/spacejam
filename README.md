[![Build Status](https://travis-ci.org/practicalmeteor/spacejam.svg?branch=master)](https://travis-ci.org/practicalmeteor/spacejam)

## Overview

An npm package to run your meteor package tinytests and mocha tests from the command line with phantomjs. Can be used in continuous integration environments, such as Travis CI.

## Quickstart

### Installation

```
npm install -g spacejam
```

### Running

spacejam test-packages works the same as meteor-test-packages, i.e.:

### Running package tinytests

Assuming you use [tinytest](https://atmospherejs.com/meteor/tinytest) for your package tests:

```
# Inside a meteor package folder
spacejam test-packages ./
# Inside a meteor app folder
spacejam test-packages myaccount:mypkg1 myaccount:mypkg2
```

### Running package mocha tests

Assuming you use [practicalmeteor:mocha](https://atmospherejs.com/practicalmeteor/mocha) for your package tests:

```
# Inside a meteor package folder
spacejam test-packages --driver-package=practicalmeteor:mocha-console-runner ./
# Inside a meteor app folder
spacejam test-packages --driver-package=practicalmeteor:mocha-console-runner myaccount:mypkg1 myaccount:mypkg2
```

Alternatively, just use the spacejam-mocha wrapper script to avoid specifying the driver-package on the command line:

```
spacejam-mocha ./
spacejam-mocha myaccount:mypkg1 myaccount:mypkg2
```

## Table of Contents

- [Installation](#installation)
- [spacejam test-packages](#spacejam-test-packages)
    - [Running your package tests standalone](#running-your-package-tests-standalone)
    - [Exit codes](#exit-codes)
- [spacjam package-version](#spacjam-package-version)
- [spacejam-mocha wrapper script](#spacejam-mocha-wrapper-script)
- [meteor-mocha wrapper script](#meteor-mocha-wrapper-script)
- [mrun (meteor run)](#mrun-meteor-run)
    - [METEOR_SETTINGS_PATH](#meteor_settings_path)
- [mtp (meteor test-packages)](#mtp-meteor-test-packages)
    - [TEST_PORT](#test_port)
    - [TEST_ROOT_URL](#test_root_url)
    - [TEST_MONGO_URL](#test_mongo_url)
    - [TEST_METEOR_SETTINGS_PATH](#test_meteor_settings_path)
    - [METEOR_SETTINGS_PATH](#meteor_settings_path-1)
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

This will automatically add spacejam, mrun and mtp to your path.

## spacejam test-packages

`spacejam test-packages [options] [package...]`

`package...` can be a list of packages with [tinytests](https://atmospherejs.com/meteor/tinytest) or [mocha](https://atmospherejs.com/practicalmeteor/mocha) tests.

If not specified, will call meteor test-packages without arguments which will result in meteor testing all of the following packages:

1. All of your app's packages, if run from within a meteor app folder.

2. All of the packages meteor will find in all the folders specified in the PACKAGE_DIRS environment variable.

spacejam test-packages also sets process.env.METEOR_TEST_PACKAGES to '1', so packages can know they are running in the context of meteor test-packages. Not really a good practice, but sometimes just unavoidable.

The following options are specific to spacejam:

`--loglevel <level>`

spacejam log level. One of trace|debug|info|warn|error. Defaults to info.

`--root-url <url>`

The meteor ROOT_URL. Defaults to http://localhost:--port/, and not ROOT_URL, to avoid conflicts with your meteor app ROOT_URL.

`--mongo-url <url>`

The meteor MONGO_URL. Defaults to none, and not MONGO_URL, to avoid conflicts with your meteor app MONGO_URL.

`--phantomjs-options "<options...>"`

The [command line options](http://phantomjs.org/api/command-line.html) to pass to phantomjs. The default is `--load-images=no --ssl-protocol=TLSv1`.

`--xunit-out <file>`

If specified, saves results as xunit output to file.

`--timeout  <milliseconds>`

Total timeout for all tests. Defaults to no timeout.

The following options are meteor options and are passed through to meteor (all are optional):

`--driver-package=<driver-package>`

For running your [practicalmeteor:mocha](https://atmospherejs.com/practicalmeteor/mocha) tests, use [practicalmeteor:mocha-console-runner](https://atmospherejs.com/practicalmeteor/mocha-console-runner)

`--port <port>`

The meteor port. Defaults to 4096, and not PORT, to avoid conflicts with your meteor app PORT.

`--settings <file>`

Path to a meteor settings file.

`--production`

Simulate meteor production mode. Minify and bundle CSS and JS files.

`--release <version>`

Specify the release of Meteor to use.

`--use-system-phantomjs`

Use the installed version of PhantomJS instead of the one from the
[PhantomJS NPM package](https://www.npmjs.com/package/phantomjs)

To get help, just:

```
spacejam help
```

### Running your package tests standalone

to run your package tests without a meteor app, from within your package folder, run:

````
spacejam test-packages ./
OR
spacejam-mocha test-packages ./
```

### Exit codes

```spacejam``` will return the following exit codes:

* ```0``` All the tests have passed in all packages.
* ```1``` ```spacejam``` usage or internal error.
* ```2``` At least one test has failed.
* ```3``` The meteor app has errors.
* ```4``` The tests have timed out.
* ```6``` An uncaught error happened client side before or during tests.

## spacejam package-version

Prints the package version in the current working directory's package.js

## spacejam-mocha wrapper script

A wrapper script so you don't have to specify --driver-package=practicalmeteor:mocha-console-runner on the command line every time, i.e.:

```
spacejam-mocha --production ./
```

## meteor-mocha wrapper script

A wrapper script so you don't have to specify --driver-package=practicalmeteor:mocha on the command line every time, i.e.:

```
meteor-mocha --port 4000 pkg1 pkg2
```

## mrun (meteor run)

Runs `meteor run` with the provided options. Supports the following additional environment variables:

### METEOR_APP_HOME

If set, will cd $METEOR_APP_HOME && meteor run, so you can run your app from any folder, without leaving that folder.

### METEOR_SETTINGS_PATH

If set, runs meteor with --settings $METEOR_SETTINGS_PATH

## mtp (meteor test-packages)

Runs `meteor test-packages` with the provided options on port 3100 and with MONGO_URL unset so you can run your app and your package tests in parallel, without port or mongodb conflicts, if you use an external mongodb for your app.

It also always sets METEOR_TEST_PACKAGES to '1', so packages can know they run in the context of meteor test-packages. Not really a good practice, but sometimes just unavoidable.

Supports the following additional environment variables:

### TEST_PORT

Runs meteor with --port $TEST_PORT and sets PORT to TEST_PORT. Defaults to 3100.

### TEST_ROOT_URL

If set, sets ROOT_URL to TEST_ROOT_URL. If not set, sets ROOT_URL to http://localhost:$TEST_PORT/

### TEST_MONGO_URL

If set, sets MONGO_URL to TEST_MONGO_URL. If not set, unsets MONGO_URL.

### TEST_METEOR_SETTINGS_PATH

If set, runs meteor with --settings $TEST_METEOR_SETTINGS_PATH. Useful if you use different settings for your app and your package tests.

### METEOR_SETTINGS_PATH

If set, runs meteor with --settings $METEOR_SETTINGS_PATH. Useful if you use the same settings for your app and your package tests.

## Changelog

See [CHANGELOG.md](CHANGELOG.md)

## Contributing

Contributions are more than welcome. Just create pull requests and make sure to include proper test coverage. We use mocha.js for tests and run our tests using CoffeScript's cake, so `npm test` will run `cake test`.

Note that we plan to include support for running tests in any browser and in sauce from the command line so if you plan to add this, check with us if we already started working on it.

## License

[MIT](LICENSE.txt)
