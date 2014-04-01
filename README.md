MCTR
==========

**MCTR** stands for Meteor Console Test Runner. ```mctr``` is a test runner for packages in [Meteor](https://www.meteor.com/) applications. ```mctr``` runs tests packages in your app with the ```meteor test-packages``` command and ```Tinytest```.

As for now, ```mctr``` is only tested to work on [```meteor 0.7.2```](https://github.com/meteor/meteor/tree/release/0.7.2/)



Installation
---------------------------

We haven't published mctr to npmjs.org yet. For now, just:

    git clone https://github.com/lavaina/meteor-console-test-runner.git mctr
    cd mctr
    npm install
	PATH=./node_modules/.bin:$PATH
	export PATH
	# Or export PATH=./node_modules/.bin:$PATH for bash
    # Run the command below to see command line options
    mctr --help

Command Line Options
---------------------------
 
	--app <directory>             The directory of your meteor app to test (Required).
    --packages <name1> [name2...] The meteor packages to test in your app, with suport for glob style wildcards (Required).
    --log_level <level>           mctr log level. One of TRACE|DEBUG|INFO|WARN|ERROR.
    --port <port>                 The port in which to run your meteor app (default 3000).
    --root_url <url>              The meteor app ROOT_URL (default http://localhost:3000/).
    --settings <file>             The meteor app settings path.
    --timeout  <milliseconds>     Total timeout for all tests (default 120000 milliseconds, i.e. 2 minutes). 
    --meteor_ready_text <text>    The meteor print-out text to wait for that indicates the app is ready. 
    --meteor_error_text <text>    The meteor print-out text that indicates that your app has errors.
    --help                        This help text.


```mctr``` uses the [rc](https://www.npmjs.org/package/rc) for runtime configuration, so every command line option can also be set by an uper case environment variable of the same name, and a prefix of ```MCTR_```, i.e. ```MCTR_PORT```. 

Different versions of Meteor may print out different text to indicate your app is ready or that your app has errors, so if that's the case, you will be able to provide the appropiate text, using the relevant options. For meteor 0.7.2, we use:

      meteor_ready_text: "=> App running at:",
      meteor_error_text: "Waiting for file change."

Exit codes
---------------------------

```mctr``` will return a different exit code, depending on the result of it's run:

* ```0``` All the package tests have passed.
* ```1``` ```mctr``` usage error.
* ```2``` At least one test has failed.
* ```3``` The meteor app has errors.
* ```4``` The tests timed out.

Self Tests
------------------------------------------
We created a couple of meteor test apps, for self testing ```mctr```. Just run:

	npm test

Contributions
----------------------------
Are more than welcome. Just create pull requests.
 
