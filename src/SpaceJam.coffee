require('./log')
expect = require("chai").expect
_ = require("underscore")
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")

class SpaceJam

  @opts = null;

  @meteor = null

  @phantomjs = null

  @ERR_CODE:
    TEST_SUCCESS: 0
    TEST_FAILED: 2
    METEOR_ERROR: 3
    TEST_TIMEOUT: 4


  @defaultOpts =->
    {
      "timeout"   : 120000
      "tinytest"  : "phantomjs" #TODO: For now only phantomjs is supported
      "crash-spacejam-after": 0
    }


  @exec: ->
    log.debug "SpaceJam.exec()"
    log.info "spacejam jamming"

    expect(SpaceJam.meteor,"Meteor is already running").to.be.null

    SpaceJam.opts = require("rc")("spacejam",SpaceJam.defaultOpts())

    command = SpaceJam.opts._[0]
    if _.has(runCommands,command)
      runCommands[command](SpaceJam.opts)
    else
      log.error "\n'#{command}' is not a spacejam command\n" if command
      runCommands.help()



  testPackages = (opts)->
    log.debug "SpaceJam.testPackages()",arguments
    SpaceJam.meteor = Meteor.exec()

    setTimeout(
      =>
        log.error "Tests timed out after #{opts['timeout']} milliseconds."
        killChildren( SpaceJam.ERR_CODE.TEST_TIMEOUT )
    ,opts["timeout"]
    )

    SpaceJam.meteor.on "ready", =>
      log.info "spacejam: meteor is ready"
      runPhantom(SpaceJam.meteor.opts["root-url"])

    SpaceJam.meteor.on "error", =>
      log.error "spacejam: meteor has errors, exiting"
      killChildren(SpaceJam.ERR_CODE.METEOR_ERROR)

    SpaceJam.meteor.testPackages(opts)

    if +opts["crash-spacejam-after"] > 0
      setTimeout(->
        throw new Error("Testing spacejam crash")
      ,+opts["crash-spacejam-after"])



  runPhantom=(url)->
    log.debug "SpaceJam.runPhantom()",arguments
    SpaceJam.phantomjs = new Phantomjs()

    SpaceJam.phantomjs.on "exit", (code,signal)=>
      SpaceJam.meteor.kill()
      if code?
        process.exit code
      else if signal?
        process.exit SpaceJam.ERR_CODE.PHANTOM_ERROR
      else
        process.exit SpaceJam.ERR_CODE.PHANTOM_ERROR
    SpaceJam.phantomjs.run(url)


  #Kill all running child_process instances
  killChildren=(code = 1)->
    log.debug "SpaceJam.killChildren()",arguments
    SpaceJam.meteor?.kill()
    SpaceJam.phantomjs?.kill()
    process.exit code


  
  printHelp =->
    process.stdout.write(
      """
Usage
-----

spacejam test-packages [options] <packages-to-test>

<packages-to-test> can be a list of packages with tinytests or munit tests.
It enhances meteor test-packages, by supporting glob wildcards on package names
that are matched against all package names in the meteor app packages 
directory.

The following options are specific to spacejam:

 --app <directory>           The directory of your meteor app (required, for
                              now).

 --log-level <level>         spacejam log level. One of
                              TRACE|DEBUG|INFO|WARN|ERROR.

 --root-url <url>            The meteor app ROOT_URL (defaults to the
                              ROOT_URL env var or http://localhost:3000/).

 --mongo-url <url>           The meteor app MONGO_URL (defaults to
                              the MONGO_URL env var, if exists).

 --timeout  <milliseconds>   Total timeout for all tests (defaults to
                              120000 milliseconds, i.e. 2 minutes).

 --tinytest                  The browser to run the tests in automatically.
                              Currently, only phantomjs is supported and is
                              the default.

 --meteor-ready-text <text>  The meteor output text that indicates that the
                              app is ready.

 --meteor-error-text <text>  The meteor output text that indicates that the
                              app has errors.


The following options are meteor options and are passed through to meteor (all
are optional):

 --port <port>         The port in which to run your meteor app
                       (defaults to the PORT env var or 4096).

 --settings <file>     Path to a meteor settings file.

 --production          Simulate meteor production mode. Minify and bundle CSS
                       and JS files (defaults to false).

 --once                If true, do not wait for file changes if meteor has
                       errors, exit immediately.

 --driver-package      One of "test-in-console" (default) or "test-in-browser".
                       "test-in-console" will print test results to the console.
                       "test-in-browser" will allow you to open any browser on
                       the ROOT_URL, run the tests in that browser, and get the
                       results in html.

Other commands:

spacejam help - This help text.

Environment Variables
---------------------

Every command line option can also be set by an upper case environment 
variable of the same name, and a prefix of SPACEJAM_, i.e. SPACEJAM_PORT

Exit codes
----------

0 - All the tests have passed in all packages.
1 - spacejam usage error.
2 - At least one test has failed.
3 - The meteor app has errors.
4 - The tests have timed out.

For additional usage info, please visit https://github.com/spacejamio/spacejam

""")



  runCommands = {
    "test-packages" : testPackages
    "help"          : printHelp
  }

module.exports = SpaceJam
