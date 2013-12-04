global.log = require('loglevel')
expect = require('chai').expect
spawn = require('child_process').spawn
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")

class TestRunner
  meteor: null
  phantomjs: null

  constructor: ->
    log.debug "TestRunner.constructor()"
    @rc = require('rc')("mctr", { #defaults go here.
     log_level:"debug"
    port:4096
    root_url:null
    app_path:null
    settings_path:null
    timeout:120000 # 2 minutes
    packages:null,
    meteor_ready_text: "=> Meteor server running on:",
    meteor_error_text: "=> Your application has errors. Waiting for file change."
    })
    log.setLevel(@rc.log_level)

    if @rc.root_url is null
     @rc.root_url = "http://localhost:#{@rc.port}/"


  run: ->
    log.debug "TestRunner.run()"
    expect(@meteor).to.be.null

    @meteor = new Meteor(@rc)
    @meteor.on "ready", =>
      log.info "Meteor is ready"
      @runPhantom()

    @meteor.on "error", =>
      log.error "Meteor has errors, exiting"
      @meteor.childProcess.child.kill()
      process.exit 1

    @meteor.run()


  runPhantom: ->
    log.debug "TestRunner.runPhantom()"
    @phantomjs = new Phantomjs(@rc)

    @phantomjs.on "exit", (code,signal)=>
      @meteor.kill()
      if code?
        process.exit code
      else if signal?
        process.exit 1
      else
        process.exit 1

    @phantomjs.run()



module.exports = new TestRunner()