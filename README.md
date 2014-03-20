MCTR
==========

**MCTR** stands for Meteor Console Test Runner. ```mctr``` is a test runner for packages in [Meteor](https://www.meteor.com/) applications. ```mctr``` runs tests packages in your app with the ```meteor test-packages``` command and ```Tinytest```.

As for now, ```mctr``` is configured to work with [```meteor 0.7.2```](https://github.com/meteor/meteor/tree/release/0.7.2/)



Using the ```mctr``` runner
---------------------------

The ```mctr``` runner is a binary which runs ```meteor test-packages```. Install ```mctr``` with:

    npm install mctr
    # Run the line below to see command line options
    mctr --help


Passing arguments to the ```mctr``` runner
---------------------------
```mctr``` accepts the following command line arguments:

	--app [directory]         The Meteor app root directory.
    --root_url [address]       The Meteor ROOT_URL (Optional)
    --settings [json]          The Meteor settings file path (Optional)
    --timeout [milliseconds]   Total timeout for all tests (Optional)
    --packages [directory]     The meteor packages to test (glob style wildcards can be specified)


If any of this argumnets is not provided ```mctr``` will look for env vars prefixed with ```mctr_```. For example, if an ```mctr_root_url``` env var  exists its value will be use as the ```--root_url``` argument for ```mctr```.

---------------------------

```mctr``` will return an exit c ode of ```0``` if all the test were run successfully. The codes for a failing tests are as follow:

* ```1``` for a usage error with the ```mctr``` command.
* ```2``` for a failing test.
* ```3``` for an Meteor Application error.
* ```4``` if the test hit the specified ```mctr``` timeout.

The Protractor runner is a binary which accepts a config file. Install protractor with

    npm install mctr
    # Run the line below to see command line options
    mctr --help


Cloning and running ```mctr```'s own tests
------------------------------------------
Clone the :octocat: github repository.

    git clone https://github.com/lavaina/meteor-console-test-runner.git mctr
    cd mctr
    npm install


Then run the tests with

    cake test
