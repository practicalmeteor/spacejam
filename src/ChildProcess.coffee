require('./log')
expect = require("chai").expect
_spawn = require("child_process").spawn
_exec = require("child_process").exec
Pipe = require("./Pipe")

class ChildProcess
  #TODO: Remove
  @children: []

  child: null

  descendants: []

  pipe : null

  command: null

  constructor:->
    log.debug "ChildProcess.constructor()", arguments



  # TODO: Check if is used (least important)
  exec: (command, taskName)->
    log.info "ChildProcess.exec()", arguments
    expect(@child).to.be.null
    expect(command).to.be.a 'string'
    expect(taskName).to.be.a 'string'

    @command = taskName

    @child = _exec command, (err, stdout, stderr) =>
      if err?.code? and err.code isnt 0
        log.error "#{taskName} exit code: "+err.code
        process.exit(err.code)
      if err?.signal? and err.signal isnt 0
        console.error "#{taskName} termination signal: "+err.signal
        process.exit(1)

    @pipe = new Pipe(@child.stdout,@child.stderr)


  spawn: (command,args=[],options={}, pipeClass=null)->
    log.debug "ChildProcess.spawn()",command

    expect(@child,"ChildProcess is already running").to.be.null
    expect(command,"Invalid @command argument").to.be.a "string"
    expect(args,"Invalid @args argument").to.be.an "array"
    expect(options,"Invalid @options").to.be.an "object"

    @command = command

    @child = _spawn(command,args,options)
    ChildProcess.children[@child.pid] = @child

    if pipeClass
      @pipe = new pipeClass(@child.stdout,@child.stderr)
    else
      @pipe = new Pipe(@child.stdout,@child.stderr)

    @child.on "exit", (code,signal)=>
      delete ChildProcess.children[@child.pid]
      if code?
        log.info "#{command} exited with code: #{code}"
      else if signal?
        log.info "#{command} killed with signal: #{signal}"
      else
        log.error "#{command} exited: #{args}"


  kill: (signal="SIGINT")->
    log.debug "ChildProcess.kill()",arguments
    log.info "Killing ", @command
    try
      @child.kill(signal)
    catch err
      log.warn "ChildProcess.kill(): ERROR killing #{@command} with pid #{@child.pid}:\n" + err


module.exports = ChildProcess

