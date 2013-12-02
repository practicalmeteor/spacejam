spawn = require("child_process").spawn
EventEmitter = require('events').EventEmitter

class Phantom extends EventEmitter

  child:{}
  buffer:
    stdout:""
    stderr:""


  constructor:(@rc,@log)->
    log.info("spawning phantom")
    @run()



  run:()->
    log.info("spawning phantom")
    args = []

    options = {
      cwd:@rc.app_path
    }

    @child = spawn("phantom",args,options)
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
        console.info "Phantom exited with code: " + code
      else
        console.error "Phantom exited with code: " + code


module.exports = Phantom

