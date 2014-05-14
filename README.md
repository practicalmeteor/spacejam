SpaceJam
==========

**spacejam** is a console test runner for packages in [Meteor](https://www.meteor.com/) applications. It wraps meteor test-packages with some enhancements, allowing you to easily run your package tinytests or [munit](https://atmospherejs.com/package/munit) tests from the command line. It's primary use is to run it in continuous integration environments. It starts meteor test-packages, waits for it to be ready, and then runs the tinytests in phantomjs. Support for more browsers is coming shortly.


Supported Meteor Releases
--
```spacejam``` has only been tested to work with [```meteor 0.8.1```](https://github.com/meteor/meteor/tree/release/0.8.1/), but it should work with any recent meteor version.

Installation
---------------------------
Gobal installation:

    npm install -g spacejam
This will automatically add spacejam to your path.

Local installation:

	npm install spacejam [--save-dev]
Use `--save-dev` if you want to add spacejam to your nodejs package.json

Usage
---------------------------

    spacejam test-packages [options] <packages-to-test>

`<packages-to-test>` can be a list of packages with tinytests or [munit](https://atmospherejs.com/package/munit) tests.
It enhances meteor test-packages, by supporting glob wildcards on package names that are matched against all package names in the meteor app packages directory. We added this because all of our package names start with the same prefix.
	
The following options are specific to spacejam:

        --app <directory>             The directory of your meteor app (required, for now).
        --log-level <level>           spacejam log level. One of TRACE|DEBUG|INFO|WARN|ERROR.
        --port <port>                 The port in which to run your meteor app 
                                      (defaults PORT env var or 4096).
        --root-url <url>              The meteor app ROOT_URL 
									  (defaults to ROOT_URL env var or http://localhost:3000/).
		--mongo-url <url>  			  The meteor app MONGO_URL.
									  (defaults to MONGO_URL env var or the internal meteor mongodb).
        --timeout  <milliseconds>     Total timeout for all tests (defaults to 120000 milliseconds, 
									  i.e. 2 minutes).
		--tinytest                    The browser to run the tests in automaticaly. Currently, 
                                      only phantomjs is supported and is the default.
        --meteor-ready-text <text>    The meteor output text that indicates that the app is ready.
									  If not provided, defaults to the text meteor 0.8.1 prints out
									  when the app is ready.	
        --meteor-error-text <text>    The meteor output text that indicates that the app has errors.
									  If not provided, defaults to the text meteor 0.8.1 prints out 
								      when the app is crashing.

The following options are meteor options and are passed through to meteor (all are optional):

        --settings <file>             Path to a meteor settings file.
		--production  			      Simulate meteor production mode. Minify and bundle CSS and JS files
									  (defaults to false).
		--once        				  If true, do not wait for file changes if meteor has errors, exit immediately.
									  We recommend setting this to true in your continuous integration environment, 
									  and setting it to false in your development environment defaults to false).
		--driver-package			  One of "test-in-console" (default) or "test-in-browser".
                                      "test-in-console" will print test results to the console.
                                      "test-in-browser" will allow you to open any browser on the ROOT_URL,
               	                      run the tests in that browser, and get the results in html.
 To get help, just:
	
	spacejam help


Environment Variables
---

```spacejam``` uses the [rc](https://www.npmjs.org/package/rc) npm package for runtime configuration, so every command line option can also be set by an uper case environment variable of the same name, and a prefix of ```SPACEJAM_```, i.e. ```SPACEJAM_PORT```.

In Case It Doesn't Work With Your Meteor Version
----
Different versions of Meteor may print out different texts to indicate your app is ready or that your app has errors, so if that's the case, you will be able to provide the appropiate text, using the `meteor-xxx-text` options. For meteor 0.8.1, we use:

      meteor_ready_text: "=> App running at:",
      meteor_error_text: "Waiting for file change."

Exit codes
---------------------------

```spacejam``` will return the following exit codes:

* ```0``` All the tests have passed in all packages.
* ```1``` ```spacejam``` usage error.
* ```2``` At least one test has failed.
* ```3``` The meteor app has errors.
* ```4``` The tests have timed out.

SpaceJam Self Tests
------------------------------------------
We use CoffeScript's cake for that so, clone the repository, run `npm install` in the repo root and then run: 

`cake test`

Contributions
----------------------------
Are more than welcome. Just create pull requests. Following are a list of enhancements we were thinking of:

* Make the `--app` option optional, if you run spacejam from a meteor app directory.
* Passing through to meteor all unrecognized options to make spacejam future proof. Currently, we don't support `--deploy` due to that.

Note that we are about to include support for running tests in any browser from the command line so no need to work on that.

License
--
MIT, see [LICENSE.txt](LICENSE.txt) for more details.
