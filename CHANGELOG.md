## 1.0.0

#### Changes
* Remove support for the --app option. spacejam needs to be run from within a meteor app or package folder.
* Remove support for the --once option, since we need the meteor proxy to start and launch a mongodb, if needed. With --once, the meteor proxy will not launch a mongodb.
* Remove support for the --driver-package option. It will always be test-in-console, since spacejam should only be used to test your packages from the command line or in ci environments.
* Internal: Update tests to meteor 0.9.2.2

## 0.2.10

#### Changes
* Internal: Fix npm-publish script so it stops in case of errors.

## 0.2.9

#### Changes
* Add support for running spacejam without packages specified, so it will do the same as meteor test-packages without arguments.
* Add support for running tests for standalone packages, without a meteor app.
* spacejam now kills meteor's internal mongodb cleanly. See #3

## 0.2.8

#### Changes
* Updated documentation to reflect that spacejam_ environment variables need to be lower case.

## 0.2.7

#### Changes


* `--driver-package` option has been removed. It will always use `test-in-console`.
* Updated documentation to include prerequisites (coffee-script) and quick start.


## 0.2.6

#### Features


* `--app` is no longer required. spacejam will use the current working directory, if no --app folder is specified.
* Added spacejam ([bin/run-tests.sh](bin/run-tests.sh)) and meteor ([bin/run-app.sh](bin/run-app.sh)) wrapper scripts in order to easily specify different environments for meteor and spacejam.
* Added a script ([bin/unset-meteor-env.sh](bin/unset-meteor-env.sh)) to easily unset meteor related environment variables.

## 0.2.5

#### Features

* Add support for the `--release` meteor flag.
