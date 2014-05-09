#TODO: Fix bug: Exit code is 0 if Meteor does'n run because of used port

expect = require("chai").expect
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")

class MeteorWrapper

  @meteor: null

  @phantomjs: null

  @ERR_CODE:
    TEST_SUCCESS: 0
    TEST_FAILED: 2
    METEOR_ERROR: 3
    TEST_TIMEOUT: 4



# TODO: Rename to exec. It is static and move to Meteor
# TODO: CHeck first argument (help,run or test-packages)
  @exec: ->
    log.debug "MeteorWrapper.exec()",arguments
    log.info "Running mctr"
    expect(MeteorWrapper.meteor,"Meteor is already running").to.be.null

    opts = require("rc")("mctr",{
      "root-url"  : process.env.ROOT_URL || null
      "timeout"  : process.env.ROOT_URL || null
    })

    command = opts._[0]
    runCommands[command]()

    setTimeout(
      =>
        log.error "Tests timed out after #{opts['timeout']} milliseconds."
        @killAllChilds( MeteorWrapper.ERR_CODE.TEST_TIMEOUT )
      ,opts["timeout"]
    )

    MeteorWrapper.meteor = Meteor.exec()

    MeteorWrapper.meteor.on "ready", =>
      log.info "Meteor is ready"
      MeteorWrapper.runPhantom(opts["root-url"]) if not MeteorWrapper.phantomjs

    MeteorWrapper.meteor.on "error", =>
      log.error "Meteor has errors, exiting"
      MeteorWrapper.killAllChilds MeteorWrapper.ERR_CODE.METEOR_ERROR

    MeteorWrapper.meteor.testPackages()


  @runPhantom: (url)->
    log.debug "MeteorWrapper.runPhantom()",arguments
    MeteorWrapper.phantomjs = new Phantomjs()

    MeteorWrapper.phantomjs.on "exit", (code,signal)=>
      MeteorWrapper.meteor.kill()
      if code?
        process.exit code
      else if signal?
        process.exit MeteorWrapper.ERR_CODE.PHANTOM_ERROR
      else
        process.exit MeteorWrapper.ERR_CODE.PHANTOM_ERROR
    #TODO: Refactor
    MeteorWrapper.phantomjs.run(url)

  @killAllChilds: (code = 1)->
    log.debug "MeteorWrapper.killAllChilds()",arguments
    MeteorWrapper.meteor?.kill()
    MeteorWrapper.phantomjs?.kill()
    process.exit code


  @handleArgs: ->
    log.debug "MeteorWrapper.handleArgs()",arguments
#    if @options["help"]?
#      MeteorWrapper.printUsage()
#      process.exit 0

#    if @options["root-url"] is null
#      @options["root-url"] = "http://localhost:#{@options['port']}/"

  #TODO: Update
  @printUsage : ->
    log.debug "MeteorWrapper.printUsage()",arguments
    process.stdout.write("root-urlUsage: mctr <command>\n
    --app <directory>             The directory of your meteor app to test (Required).\n
    --packages <name1> [name2...] The meteor packages to test in your app, with suport for glob style wildcards (Required).\n
    --log-level <level>           mctr log level. One of TRACE|DEBUG|INFO|WARN|ERROR.\n
    --port <port>                 The port in which to run your meteor app (default 3000).\n
    --root-url <url>              The meteor app ROOT_URL (default http://localhost:3000/).\n
    --settings <file>             The meteor app settings path.\n
    --timeout  <milliseconds>     Total timeout for all tests (default 120000 milliseconds, i.e. 2 minutes).\n
    --meteor_ready_text <text>    The meteor print-out text to wait for that indicates the app is ready.\n
    --meteor_error_text <text>    The meteor print-out text that indicates that your app has errors.\n
    --help                        This help text.\n")

module.exports = MeteorWrapper