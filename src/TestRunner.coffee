global.log = require('loglevel')
expect = require('chai').expect
spawn = require('child_process').spawn
Meteor = require("./Meteor")
Phantom = require("./Phantom")

class TestRunner
  runCalled: false

  constructor: ->
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


    @meteor = new Meteor(@rc)
    @meteor.on "ready", =>
      log.info "Meteor is ready"

    @meteor.on "error", =>
      log.error "Meteor has errors, exiting"
      @meteor.child.kill()
      process.exit 1


  run: ->
    expect(@runCalled).to.be.false
    @runCalled = true
    @meteor.run()



module.exports = new TestRunner()