require('./log')
expect = require("chai").expect
_ = require("underscore")
EventEmitter = require('events').EventEmitter
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")


class SpaceJam extends EventEmitter

  instance = null
  @get: ->
    instance ?= new SpaceJam()

  opts: null

  meteor: null

  waitForMeteorMongodbKillDone: false

  phantomjs: null

  exitCode: null

  @ERR_CODE:
    TEST_SUCCESS: 0
    TEST_FAILED: 2
    METEOR_ERROR: 3
    TEST_TIMEOUT: 4

  @commands: {
    "test-packages" : "testPackages"
    "help"          : "printHelp"
  }

  @defaultOpts =->
    {
      "timeout"   : 120000
      "crash-spacejam-after": 0
    }


  exec: ->
    log.debug "SpaceJam.exec()"

    @opts = require("rc")("spacejam",SpaceJam.defaultOpts())

    command = @opts._[0]
    if _.has(SpaceJam.commands,command)
      @[SpaceJam.commands[command]](@opts)
    else
      log.error "\n'#{command}' is not a spacejam command\n" if command
      @printHelp()



  testPackages: (opts)->
    log.debug "SpaceJam.testPackages()",arguments
    expect(opts).to.be.an "object"
    expect(@meteor,"Meteor is already running").to.be.null

    try
      @meteor = new Meteor()
    catch err
      console.trace err
      process.exit 1

    @meteor.on "exit", (code)=>
      @meteor = null
      if code
        @killChildren SpaceJam.ERR_CODE.METEOR_ERROR

    @meteor.on "ready", =>
      log.info "spacejam: meteor is ready"
      @waitForMeteorMongodbKillDone = @meteor.hasMongodb()
      if @waitForMeteorMongodbKillDone
        @meteor.meteorMongodb.on "kill-done", @onMeteorMongodbKillDone

      @runPhantom(@meteor.opts["root-url"])

    @meteor.on "error", =>
      log.error "spacejam: meteor has errors, exiting"
      @waitForMeteorMongodbKillDone = @meteor.hasMongodb()
      if @waitForMeteorMongodbKillDone
        @meteor.meteorMongodb.on "kill-done", @onMeteorMongodbKillDone
      @killChildren(SpaceJam.ERR_CODE.METEOR_ERROR)

    try
      @meteor.testPackages(opts)
    catch err
      console.trace err
      process.exit 1

    setTimeout(
      =>
        log.error "Tests timed out after #{opts['timeout']} milliseconds."
        @killChildren( SpaceJam.ERR_CODE.TEST_TIMEOUT )
    ,opts["timeout"]
    )

    if +opts["crash-spacejam-after"] > 0
      setTimeout(->
        throw new Error("Testing spacejam crash")
      ,+opts["crash-spacejam-after"])


  runPhantom: (url)->
    log.debug "SpaceJam.runPhantom()",arguments
    expect(url).to.be.a "string"

    @phantomjs = new Phantomjs()

    @phantomjs.on "exit", (code, signal)=>
      @phantomjs = null
      @meteor?.kill()
      if code?
        @exit code

    @phantomjs.run(url)


  onMeteorMongodbKillDone: =>
    log.debug "SpaceJam.onMeteorMongodbKillDone()", @exitCode
    process.exit @exitCode


  #Kill all running child_process instances
  killChildren: (code = 1)->
    log.debug "SpaceJam.killChildren()",arguments
    expect(code,"Invalid exit code").to.be.a "number"

    @meteor?.kill()
    @phantomjs?.kill()
    @exit(code)


  exit: (code)->
    log.debug "SpaceJam.exit()", arguments
    expect(code, "Invalid exit code").to.be.a "number"

    @waitForMeteorMongodbKillDone = @meteor?.hasMongodb()
    process.exit code if not @waitForMeteorMongodbKillDone
    @exitCode = code



  printHelp: ->
    process.stdout.write """
Usage
-----

spacejam test-packages [options] [packages-to-test]

[packages-to-test] can be a list of packages with tinytests or munit tests.
It enhances meteor test-packages, by supporting glob wildcards on package names
that are matched against all package names in the meteor app packages 
directory.

If not specified, acts the same as meteor test-packages without arguments.

The following options are specific to spacejam:

 --log-level <level>         spacejam log level. One of
                              TRACE|DEBUG|INFO|WARN|ERROR.

 --root-url <url>            The meteor app ROOT_URL (defaults to the
                              ROOT_URL env var or http://localhost:4096/).

 --mongo-url <url>           The meteor app MONGO_URL (defaults to
                              the MONGO_URL env var, if exists).

 --timeout  <milliseconds>   Total timeout for all tests (defaults to
                              120000 milliseconds, i.e. 2 minutes).

 --meteor-ready-text <text>  The meteor output text that indicates that the
                              app is ready.

 --meteor-error-text <text>  The meteor output text that indicates that the
                              app has errors.


The following options are meteor options and are passed through to meteor (all
are optional):

 --release <release>   The release of Meteor to use.

 --port <port>         The port in which to run your meteor app
                       (defaults to the PORT env var or 4096).

 --settings <file>     Path to a meteor settings file.

 --production          Simulate meteor production mode. Minify and bundle CSS
                       and JS files (defaults to false).


Other commands:

spacejam help - This help text.

Environment Variables
---------------------

Every command line option can also be set by an environment variable of the same name, and a prefix of spacejam_, i.e. spacejam_port.
Note that environment variables have to be lower case, due to the way rc reads them.

Running your package tests without a meteor app
-----------------------------------------------

From within your package folder, run:

spacejam test-packages ./

Exit codes
----------

0 - All the tests have passed in all packages.
1 - spacejam usage error.
2 - At least one test has failed.
3 - The meteor app exited with an error or is crashing.
4 - The tests have timed out.

For additional usage info, please visit https://github.com/spacejamio/spacejam
"""


module.exports = SpaceJam
