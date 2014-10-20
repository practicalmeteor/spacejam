[![Build Status](https://travis-ci.org/spacejamio/spacejam.svg?branch=master)](https://travis-ci.org/spacejamio/spacejam)
SpaceJam
========

**spacejam** is a console test runner for [meteor](https://www.meteor.com/) packages. It wraps meteor test-packages with some enhancements, allowing you to easily run your package tinytests or [munit](https://atmospherejs.com/package/munit) tests from the command line. It's primary use is in continuous integration environments. It starts meteor test-packages, waits for it to be ready, and then runs the tinytests or [munit](https://atmospherejs.com/package/munit) tests in phantomjs. Support for more browsers is coming shortly.


Table of Contents
-------------------
- [Supported  Meteor Versions](#supported-meteor-versions)
- [Changelog](#changelog)
- [Installation](#installation)
- [Usage](#usage)
- [Running your package tests without a meteor app](#running-your-package-tests-without-a-meteor-app)
- [Environment Variables](#environment-variables)
- [In case It doesn't work with your meteor version](#in-case-it-doesnt-work-with-your-meteor-version)
- [Helper Scripts](#helper-scripts)
- [Spacejam self tests](#spacejam-self-tests)
- [Contributions](#contributions)



## Supported Meteor Versions

```spacejam``` has only been tested with meteor 0.8.1 and 0.9.2.2, but it should work with any recent meteor version.

## Changelog

See [CHANGELOG.md](CHANGELOG.md)

## Installation

```bash
npm install -g spacejam
```

This will automatically add spacejam to your path.

## Usage

    spacejam test-packages [options] [packages-to-test]

**packages-to-test** can be a list of packages with tinytests or [munit](https://atmospherejs.com/package/munit) tests.
It enhances meteor test-packages, by supporting glob wildcards on package names that are matched against all package names in the meteor app packages folder. We added this because all of our package names start with the same prefix.

If not specified, will call meteor test-packages without arguments which will result in meteor testing all of the following packages:

1. All of your app's packages, if run from within a meteor app folder.

3. All of the packages meteor will find in all the folders specified in the PACKAGE_DIRS environment variable.

The following options are specific to spacejam:

`--log-level <level>`

spacejam log level. One of TRACE|DEBUG|INFO|WARN|ERROR. Defaults to INFO.

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

## Running your package tests without a meteor app

From within your package folder, run:

````
spacejam test-packages ./
```

## Environment Variables

```spacejam``` uses the [rc](https://www.npmjs.org/package/rc) npm package 
for runtime configuration, so every command line option can also be set by an environment variable of the same name, and a prefix of ```spacejam_```, i.e. ```spacejam_port```. Note that environment variables have to be lower case, due to the way rc reads them.


Exit codes
----------

```spacejam``` will return the following exit codes:

* ```0``` All the tests have passed in all packages.
* ```1``` ```spacejam``` usage or internal error.
* ```2``` At least one test has failed.
* ```3``` The meteor app has errors.
* ```4``` The tests have timed out.

## Helper Scripts

In the bin folder, in addition to spacejam, you will find the following scripts that you can copy and modify to suit your needs: 

* [run.tests.sh](bin/run-tests.sh) - set / unset environment variables before running spacejam.
* [run.app.sh](bin/run-app.sh) - set / unset environment variables before running your meteor app.
* [unset-meteor-env.sh](bin/unset-meteor-env.sh) - unset meteor related environment variables.


## spacejam self tests

We use CoffeScript's cake for that so, clone the repository, run `npm install` in the repo root and then run: 

`npm test`

This will execute `cake test`.

## Contributions

Are more than welcome. Just create pull requests.

Note that we are about to include support for running tests in any browser from the command line so no need to work on that.

## License

MIT, see [LICENSE.txt](LICENSE.txt) for more details.
