SpaceJam
========

**spacejam** is a console test runner for [meteor](https://www.meteor.com/) packages. It wraps meteor test-packages with some enhancements, allowing you to easily run your package tinytests or [munit](https://atmospherejs.com/package/munit) tests from the command line. It's primary use is in continuous integration environments. It starts meteor test-packages (--driver-package test-in-console), waits for it to be ready, and then runs the tinytests or [munit](https://atmospherejs.com/package/munit) tests in phantomjs. Support for more browsers is coming shortly.

Supported Meteor Versions
-------------------------
```spacejam``` has only been tested with [```meteor 0.8.1```](https://github.com/meteor/meteor/tree/release/0.8.1/), but it should work with any recent meteor version.

Changelog
---------
See [CHANGELOG.md](CHANGELOG.md)

Prerequisites
-------------
CoffeeScript:

	npm install -g spacejam


Installation
------------
    npm install -g spacejam
This will automatically add spacejam to your path.

Quick Start
-----------
In your meteor app folder:    

	spacejam test-packages <your-package1> [your-package2...]


Usage
-----

    spacejam test-packages [options] <packages-to-test>

`<packages-to-test>` can be a list of packages with tinytests or [munit](https://atmospherejs.com/package/munit) tests.
It enhances meteor test-packages, by supporting glob wildcards on package names that are matched against all package names in the meteor app packages directory. We added this because all of our package names start with the same prefix.
    
The following options are specific to spacejam:

    --app <directory>             The directory of your meteor app (default is '.').
    
    --log-level <level>           spacejam log level. One of TRACE|DEBUG|INFO|WARN|ERROR.

    --root-url <url>              The meteor app ROOT_URL 
                                  (defaults to the ROOT_URL env var or 
                                  http://localhost:3000/).
                                  
    --mongo-url <url>             The meteor app MONGO_URL
                                  (defaults to the MONGO_URL env var or the 
                                  internal meteor mongodb).
                                  
    --timeout  <milliseconds>     Total timeout for all tests (defaults to 120000
                                  milliseconds, i.e. 2 minutes).
                                  
    --tinytest                    The browser to run the tests in automatically.
                                  Currently, only phantomjs is supported and is
                                  the default.
                                  
    --meteor-ready-text <text>    The meteor output text that indicates that the app
                                  is ready. If not provided, defaults to the text
                                  meteor 0.8.1 prints out when the app is ready.
                                    
    --meteor-error-text <text>    The meteor output text that indicates that the app
                                  has errors. If not provided, defaults to the text
                                  meteor 0.8.1 prints out when the app is crashing.

The following options are meteor options and are passed through to meteor (all are optional):

    --port <port>                 The port in which to run your meteor app
                                  (defaults to the PORT env var or 4096).

    --settings <file>             Path to a meteor settings file.
    
    --production                  Simulate meteor production mode. Minify and bundle 
                                  CSS and JS files (defaults to false).

    --release <version>           Specify the release of Meteor to use.
                                  
    --once                        If true, do not wait for file changes if meteor 
                                  has errors, exit immediately. We recommend 
                                  setting this to true in your continuous integration 
                                  environment, and setting it to false in your development 
                                  environment defaults to false).
                                  
    
 To get help, just:
    
    spacejam help


Environment Variables
---------------------

```spacejam``` uses the [rc](https://www.npmjs.org/package/rc) npm package 
for runtime configuration, so every command line option can also be set by an upper case environment variable of the same name, and a prefix of ```SPACEJAM_```, i.e. ```SPACEJAM_PORT```.

In Case It Doesn't Work With Your Meteor Version
------------------------------------------------

Different versions of Meteor may print out different texts to indicate your app is ready or that your app has errors, so if that's the case, you will be able to provide the appropiate text, using the `meteor-xxx-text` options. For meteor 0.8.1, we use:

      meteor_ready_text: "=> App running at:",
      meteor_error_text: "Waiting for file change."

Exit codes
----------

```spacejam``` will return the following exit codes:

* ```0``` All the tests have passed in all packages.
* ```1``` ```spacejam``` usage error.
* ```2``` At least one test has failed.
* ```3``` The meteor app has errors.
* ```4``` The tests have timed out.

Helper Scripts
--------------
In the bin folder, in addition to spacejam, you will find the following scripts that you can copy and modify to suit your needs: 

* [run.tests.sh](bin/run-tests.sh) - set / unset environment variables before running spacejam.
* [run.app.sh](bin/run-app.sh) - set / unset environment variables before running your meteor app.
* [unset-meteor-env.sh](bin/unset-meteor-env.sh) - unset meteor related environment variables.


spacejam self tests
-------------------
We use CoffeScript's cake for that so, clone the repository, run `npm install` in the repo root and then run: 

`npm test`

This will execute `cake test`.

Contributions
-------------
Are more than welcome. Just create pull requests. Following are a list of enhancements we were thinking of:

* Passing through to meteor all unrecognized options to make spacejam future proof. Currently, we don't support `--deploy` due to that.

Note that we are about to include support for running tests in any browser from the command line so no need to work on that.

License
--
MIT, see [LICENSE.txt](LICENSE.txt) for more details.
