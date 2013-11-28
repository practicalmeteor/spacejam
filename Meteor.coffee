spawn = require("child").spawn
EventEmitter = require('events').EventEmitter

class Meteor extends EventEmitter

  child:{}
  buffer:
    stdout:""
    stderr:""


  constructor:(@rc,@log)->
    @run()



  run:()->
    console.info("spawning meteor")
    #meteor --settings $METEOR_TEST_SETTINGS_PATH test-packages packages/lavaina-base --driver-package test-in-console -p $PORT
    args = [
      "-p"
      @rc.port
      "--settings"
      @rc.settings_path
      "test-packages"
      @rc.packages
      "--driver-package"
      "test-in-console"
    ]

    options = {
      cwd:@rc.app_path
    }

    @child = spawn("meteor",args,options)
    @child.stdout.setEncoding('utf8');
    @child.stderr.setEncoding('utf8');
    
    @child.stdout.on "data", (data) =>
      @buffer.stdout += data
      console.info data

    @child.stderr.on "data", (data) =>
      @buffer.stderr += data
      console.error data

    @child.on "close", (code) =>
      if code is 0
        console.info "Meteor exited with code: " + code
      else
        console.error "Meteor exited with code: " + code


module.exports = Meteor

