require('./log')
expect = require("chai").expect
_spawn = require("child_process").spawn
_exec = require("child_process").exec
Pipe = require("./Pipe")
path = require 'path'

class ChildProcess

  child: null

  descendants: []

  pipe : null

  command: null

  constructor:->
    log.debug "ChildProcess.constructor()", arguments



  # TODO: Check if is used (least important)
  exec: (command, taskName)->
    log.debug "ChildProcess.exec()", arguments
    expect(@child).to.be.null
    expect(command).to.be.a 'string'
    expect(taskName).to.be.a 'string'

    @command = taskName

    @child = _exec command, (err, stdout, stderr) =>
      if err?.code? and err.code isnt 0
        log.error "spacjam: Error: #{taskName} exit code: "+err.code
#        process.exit(err.code)
      if err?.signal? and err.signal isnt 0
        log.error "spacjam: Error: #{taskName} termination signal: "+err.signal
#        process.exit(1)

    @pipe = new Pipe(@child.stdout,@child.stderr)


  spawn: (command, args=[], options={}, pipeClass = null)->
    log.debug "ChildProcess.spawn()",command

    expect(@child,"ChildProcess is already running").to.be.null
    expect(command,"Invalid @command argument").to.be.a "string"
    expect(args,"Invalid @args argument").to.be.an "array"
    expect(options,"Invalid @options").to.be.an "object"

    @command = path.basename command

    log.info("spacejam: spawning #{@command}")

    @child = _spawn(command,args,options)

    if pipeClass
      @pipe = new pipeClass(@child.stdout, @child.stderr)
    else
      @pipe = new Pipe(@child.stdout, @child.stderr)

    @child.on "exit", (code,signal)=>
      if code?
        log.info "spacejam: #{command} exited with code: #{code}"
      else if signal?
        log.info "spacejam: #{command} killed with signal: #{signal}"
      else
        log.error "spacejam: #{command} exited: #{args}"


  kill: (signal = "SIGTERM")->
    log.debug "ChildProcess.kill()", signal
    log.info "spacejam: killing", @command
    try
      # Providing a negative pid will kill the entire process group,
      # i.e. the process and all it's children
      # See man kill for more info
      #process.kill(-@child.pid, signal)
      @child.kill(signal)

    catch err
      log.warn "spacejam: Error: While killing #{@command} with pid #{@child.pid}:\n", err


module.exports = ChildProcess
