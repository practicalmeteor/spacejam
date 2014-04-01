global.log = require('loglevel')
expect = require('chai').expect
spawn = require('child_process').spawn
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")

class TestRunner
  meteor: null
  phantomjs: null

  @ERR_CODE:
    TEST_SUCCESS: 0
    TEST_FAILED: 2
    METEOR_ERROR: 3
    TEST_TIMEOUT: 4

  constructor: ->
    @rc = require('rc')("mctr", {
      help:null
      log_level:"info"
      port:4096
      root_url:null
      app:null
      settings:null
      timeout:120000 # 2 minutes
      packages:null,
      meteor_ready_text: "=> App running at:",
      meteor_error_text: "Waiting for file change."
    })
    log.setLevel(@rc.log_level)
    @handleArgs()


  run: ->
    log.debug "TestRunner.run()",arguments
    log.info "Running mctr"
    expect(@meteor).to.be.null

    setTimeout(
      =>
        log.error "Tests timed out after #{@rc.timeout} milliseconds."
        @killAllChilds( TestRunner.ERR_CODE.TEST_TIMEOUT )
      ,@rc.timeout
    )

    @meteor = new Meteor(@rc)
    @meteor.on "ready", =>
      log.info "Meteor is ready"
      @runPhantom() if not @phantomjs

    @meteor.on "error", =>
      log.error "Meteor has errors, exiting"
      @killAllChilds TestRunner.ERR_CODE.METEOR_ERROR

    @meteor.run()


  runPhantom: ->
    log.debug "TestRunner.runPhantom()",arguments
    @phantomjs = new Phantomjs(@rc)

    @phantomjs.on "exit", (code,signal)=>
      @meteor.kill()
      if code?
        process.exit code
      else if signal?
        process.exit TestRunner.ERR_CODE.PHANTOM_ERROR
      else
        process.exit TestRunner.ERR_CODE.PHANTOM_ERROR

    @phantomjs.run()

  killAllChilds: (code = 1)->
    log.debug "TestRunner.killAllChilds()",arguments
    @meteor?.kill()
    @phantomjs?.kill()
    process.exit code


  handleArgs: ->
    log.debug "TestRunner.handleArgs()",arguments
    if @rc.help?
      @printUsage()
      process.exit 0

    if @rc.root_url is null
      @rc.root_url = "http://localhost:#{@rc.port}/"


  printUsage : ->
    log.debug "TestRunner.printUsage()",arguments
    process.stdout.write("Usage: mctr <command>\n
    --app <directory>             The directory of your meteor app to test (Required).\n
    --packages <name1> [name2...] The meteor packages to test in your app, with suport for glob style wildcards (Required).\n
    --log_level <level>           mctr log level. One of TRACE|DEBUG|INFO|WARN|ERROR.\n
    --port <port>                 The port in which to run your meteor app (default 3000).\n
    --root_url <url>              The meteor app ROOT_URL (default http://localhost:3000/).\n
    --settings <file>             The meteor app settings path.\n
    --timeout  <milliseconds>     Total timeout for all tests (default 120000 milliseconds, i.e. 2 minutes).\n
    --meteor_ready_text <text>    The meteor print-out text to wait for that indicates the app is ready.\n
    --meteor_error_text <text>    The meteor print-out text that indicates that your app has errors.\n
    --help                        This help text.\n")

module.exports = new TestRunner()