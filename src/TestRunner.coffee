global.log = require('loglevel')
expect = require('chai').expect
spawn = require('child_process').spawn
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")

class TestRunner
  meteor: null
  phantomjs: null

  @ERR_CODE:
    METEOR_ERROR: 2
    TEST_SUCCESS: 4
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
    meteor_ready_text: "=> Meteor server running on:",
    meteor_error_text: "=> Your application has errors. Waiting for file change."
    meteor_crashing_text: "=> Your application is crashing. Waiting for file change."
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
      @usageHelp()
      process.exit 0

    if @rc.root_url is null
      @rc.root_url = "http://localhost:#{@rc.port}/"


  usageHelp : ->
    process.stdout.write("Usage: mctr <command>\n\n
    --app_path [directory]     Send the Meteor app root directory.\n
    --root_url [address]       Send the root url for Meteor\n
    --settings_path [json]     Use this json settings file\n
    --timeout [milliseconds]   Send a timeout for the tests\n
    --packages [directory]     The package(s) to test\n")

module.exports = new TestRunner()