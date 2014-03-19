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
    METEOR_ERROR: 2
    TEST_FAILED: 5
    TEST_TIMEOUT: 6

  constructor: ->
    log.debug "TestRunner.constructor()"
    @rc = require('rc')("mctr", { #defaults go here.
    help:null
    log_level:"debug"
    port:4096
    root_url:null
    app_path:null
    settings_path:null
    timeout:120000 # 2 minutes
    packages:null,
    meteor_ready_text: "=> App running at:",
    meteor_error_text: "Waiting for file change."
    })
    log.setLevel(@rc.log_level)
    @handleArgs()


  run: ->
    log.debug "TestRunner.run()"
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
    log.debug "TestRunner.runPhantom()"
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
    log.debug "TestRunner.killAllChilds()"
    @meteor?.kill()
    @phantomjs?.kill()
    process.exit code


  handleArgs: ->
    if @rc.help?
      @printUsage()
      process.exit 0

    if @rc.root_url is null
      @rc.root_url = "http://localhost:#{@rc.port}/"


  printUsage : ->
    process.stdout.write("Usage: mctr <command>\n\n
    --app_path [directory]     The Meteor app root directory.\n
    --root_url [address]       The Meteor ROOT_URL (Optional)\n
    --settings_path [json]     The Meteor settings file (Optional)\n
    --timeout [milliseconds]   Total timeout for all tests (Optional)\n
    --packages [directory]     The meteor packages to test (glob style wildcards can be specified)\n")

module.exports = new TestRunner()