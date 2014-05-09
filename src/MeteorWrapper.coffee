global.log = require("loglevel")
expect = require("chai").expect
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")

class MeteorWrapper
  meteor: null
  phantomjs: null

  @ERR_CODE:
    TEST_SUCCESS: 0
    TEST_FAILED: 2
    METEOR_ERROR: 3
    TEST_TIMEOUT: 4

  constructor: ->
    #TODO: Diffrent options for run and testPackages. But with a base one for both (_.extend).
    #TODO: Save the options object as static member in Meteor called defaultOpts.
    @options = require("rc")("mctr", {
      "help"                : null
      "log-level"           : "info"
      "port"                : process.env.PORT || 4096
      "root-url"            : process.env.ROOT_URL || null
      "mongo-url"           : process.env.MONGO_URL || null
      "driver-package"      : "test-in-console"
      "app"                 : null #TODO: App not required in test-packages
      "app-packages"        : true #TODO Add Support
      "settings"            : null
      "timeout"             : 120000 # 2 minutes
      "packages"            : null
      "production"          : false
#      "once"                : false #TODO: Support
      "run-phantomjs-tests" : false #TODO: Support
      "meteor_ready_text"   : "=> App running at:" #TODO: Check test-packages ready text
      "meteor_error_text"   : "Waiting for file change." #TODO: Check test-packages error text
    })
    log.setLevel(@options["log-level"])
    @handleArgs()


  run: ->
    log.debug "MeteorWrapper.run()",arguments
    log.info "Running mctr"
    expect(@meteor).to.be.null

    setTimeout(
      =>
        log.error "Tests timed out after #{@options['timeout']} milliseconds."
        @killAllChilds( MeteorWrapper.ERR_CODE.TEST_TIMEOUT )
      ,@options["timeout"]
    )

    @meteor = new Meteor(@options)
    @meteor.on "ready", =>
      log.info "Meteor is ready"
      @runPhantom() if not @phantomjs

    @meteor.on "error", =>
      log.error "Meteor has errors, exiting"
      @killAllChilds MeteorWrapper.ERR_CODE.METEOR_ERROR

    @meteor.run()


  runPhantom: ->
    log.debug "MeteorWrapper.runPhantom()",arguments
    @phantomjs = new Phantomjs(@options)

    @phantomjs.on "exit", (code,signal)=>
      @meteor.kill()
      if code?
        process.exit code
      else if signal?
        process.exit MeteorWrapper.ERR_CODE.PHANTOM_ERROR
      else
        process.exit MeteorWrapper.ERR_CODE.PHANTOM_ERROR

    @phantomjs.run()

  killAllChilds: (code = 1)->
    log.debug "MeteorWrapper.killAllChilds()",arguments
    @meteor?.kill()
    @phantomjs?.kill()
    process.exit code


  handleArgs: ->
    log.debug "MeteorWrapper.handleArgs()",arguments
    if @options["help"]?
      @printUsage()
      process.exit 0

#    if @options["root-url"] is null
#      @options["root-url"] = "http://localhost:#{@options['port']}/"

  #TODO: Update
  printUsage : ->
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

module.exports = new MeteorWrapper()