expect = require("chai").expect
_ = require("underscore")
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")

class SpaceJam

  meteor = null

  phantomjs = null

  @ERR_CODE:
    TEST_SUCCESS: 0
    TEST_FAILED: 2
    METEOR_ERROR: 3
    TEST_TIMEOUT: 4



  @exec: ->
    log.debug "SpaceJam.exec()"
    log.info "Running mctr"

    expect(meteor,"Meteor is already running").to.be.null

    opts = require("rc")("spacejam",{
      "root-url"   : process.env.ROOT_URL || null
      "timeout"    : 120000
      "log-level"  : "debug"
      "--tinytest" : "phantomjs" #TODO: For now only phantomjs is supported
    })
    log.setLevel opts["log-level"]

    command = opts._[0]
    if _.has(runCommands,command)
      runCommands[command](opts)
    else
      log.error "'#{command}' is not a spacejam command\n"
      runCommands.help()



  testPackages = (opts)->
    log.debug "SpaceJam.testPackages()"
    meteor = Meteor.exec()

    setTimeout(
      =>
        log.error "Tests timed out after #{opts['timeout']} milliseconds."
        killChildren( SpaceJam.ERR_CODE.TEST_TIMEOUT )
    ,opts["timeout"]
    )

    meteor.on "ready", =>
      log.info "Meteor is ready"
      runPhantom(opts["root-url"]) if opts["run-phantomjs-tests"]

    meteor.on "error", =>
      log.error "Meteor has errors, exiting"
      killChildren(SpaceJam.ERR_CODE.METEOR_ERROR)

    meteor.testPackages(opts)



  runPhantom=(url)->
    log.debug "SpaceJam.runPhantom()",arguments
    phantomjs = new Phantomjs()

    phantomjs.on "exit", (code,signal)=>
      meteor.kill()
      if code?
        process.exit code
      else if signal?
        process.exit SpaceJam.ERR_CODE.PHANTOM_ERROR
      else
        process.exit SpaceJam.ERR_CODE.PHANTOM_ERROR
    phantomjs.run(url)


  #Kill all running child_process instances
  killChildren=(code = 1)->
    log.debug "SpaceJam.killChildren()",arguments
    meteor?.kill()
    phantomjs?.kill()
    process.exit code



  #TODO: Update
  printHelp =->
    process.stdout.write(
      "Usage: spacejam test-packages [--flags]\nFlags:\n\n

    --app <directory>             The directory of your meteor app to test (Required).\n
    --packages <name1> [name2...] The meteor packages to test in your app, with suport for glob style wildcards (Required).\n
    --log-level <level>           spacejam log level. One of TRACE|DEBUG|INFO|WARN|ERROR.\n
    --port <port>                 The port in which to run your meteor app (default 3000).\n
    --root-url <url>              The meteor app ROOT_URL (default http://localhost:3000/).\n
    --settings <file>             The meteor app settings path.\n
    --timeout  <milliseconds>     Total timeout for all tests (default 120000 milliseconds).\n
    --meteor-ready-text <text>    The meteor print-out text to wait for that indicates the app is ready.\n
    --meteor-error-text <text>    The meteor print-out text that indicates that your app has errors.\n
    --help                        This help text.\n")



  runCommands = {
    "test-packages" : testPackages
    "help"          : printHelp
  }

module.exports = SpaceJam