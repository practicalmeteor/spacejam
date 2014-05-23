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
