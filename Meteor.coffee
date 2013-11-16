spawn = require("child_process").spawn


class Meteor

  child_process:{}
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

    @child_process = spawn("meteor",args,options)
    @child_process.stdout.setEncoding('utf8');
    @child_process.stderr.setEncoding('utf8');
    
    @child_process.stdout.on "data", (data) =>
      @buffer.stdout += data
      console.info data

    @child_process.stderr.on "data", (data) =>
      @buffer.stderr += data
      console.error data

    @child_process.on "close", (code) =>
      if code is 0
        console.info "Meteor exited with code: " + code
      else
        console.error "Meteor exited with code: " + code


module.exports = Meteor

