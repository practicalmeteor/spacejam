MCTR
==========

**MCTR** stands for Meteor Console Test Runner. ```mctr``` is a test runner for packages in [Meteor](https://www.meteor.com/) applications. ```mctr``` runs tests packages in your app with the ```meteor test-packages``` command and ```Tinytest```.

As for now, ```mctr``` is only tested to work on [```meteor 0.7.2```](https://github.com/meteor/meteor/tree/release/0.7.2/)



Installation
---------------------------

The ```mctr``` runner is a binary which runs ```meteor test-packages```. Install ```mctr``` with:

```bash
git clone https://github.com/lavaina/meteor-console-test-runner.git mctr
cd mctr
npm install
# Run the line below to see command line options
mctr --help
```

Command line options
---------------------------
```mctr``` accepts the following command line arguments:

	--app directory             The Meteor app directory.
    --help                      Display a list of all arguments.        
    --log_level <level>         Sets the log level for the tests. TRACE|DEBUG|INFO|WARN|ERROR
    --port <port>               Port in which tets should be run.
    --meteor_ready_text <text>  Optional. Meteor ready message to listen.    
    --meteor_error_text <text>  Optional. Meteor error message to listen.
    --packages <directory>      The meteor packages to test (glob style wildcards can be specified).
    --root_url address          Optional. Url to use as Meteor ROOT_URL. Default is http://localhost:3000
    --settings <file>           Optional. The Meteor settings file path.
    --timeout  <milliseconds>   Optional. Total timeout for all tests. Default is 120000


Different versions of Meteor may use different error and ready output so you can change the either of them to the desired value ussing ```meteor_ready_text``` and ```meteor_error_text``` options.

These options are captured using [rc](https://github.com/dominictarr/rc) so if any of this argumnets is not provided ```mctr``` will look for env vars prefixed with ```MCTR_```. For example, if an ```MCTR_ROOT_URL``` env var  exists its value will be use as the ```--root_url``` argument for ```mctr```. See the [rc documentation](https://github.com/dominictarr/rc) for more info.


Exit codes
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


Self test
------------------------------------------
Clone the :octocat: github repository. The tests will run against [Meteor example apps](https://www.meteor.com/examples/) Todos and Leaderboard.

    git clone https://github.com/lavaina/meteor-console-test-runner.git mctr
    cd mctr
    npm install


Then run the tests with

    npm test
