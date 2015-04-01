require('./log')
expect = require("chai").expect
Pipe = require("./Pipe")
path = require 'path'

class ChildProcess

  # Design for testability - so we can spy on them / stub them in tests
  @_spawn: require("child_process").spawn
  @_exec: require("child_process").exec

  child: null

  descendants: []

  pipe : null

  command: null

  killed: false

  constructor:->
    log.debug "ChildProcess.constructor()"

  exec: (command, options, cb)->
    log.debug "ChildProcess.exec()", arguments
    expect(@child).to.be.null
    expect(command).to.be.a('string').that.is.ok
    expect(options).to.be.an('object') if options?

    @command = command.split(' ', 1)[0]
    expect(@command).to.be.a('string').that.is.ok

    innerCB = (err, stdout, stderr) =>
      @killed = true
      if err?.code?
        log.error "child_process.exec: Error: #{@command} exit code: #{err.code}"
      if err?.signal?
        log.error "child_process.exec: Error: #{@command} termination signal: #{err.signal}"
      cb(err, stdout, stderr) if cb?

    if options?
      @child = ChildProcess._exec command, options, innerCB
    else
      @child = ChildProcess._exec command, innerCB

    @child.stdout.pipe(process.stdout)
    @child.stderr.pipe(process.stderr)


  spawn: (command, args=[], options={}, pipeClass = null)->
    log.debug "ChildProcess.spawn()", command, args

    expect(@child,"ChildProcess is already running").to.be.null
    expect(command,"Invalid @command argument").to.be.a "string"
    expect(args,"Invalid @args argument").to.be.an "array"
    expect(options,"Invalid @options").to.be.an "object"

    @command = path.basename command

    log.info("spacejam: spawning #{@command}")

    process.on 'exit', (code)=>
      log.debug "ChildProcess.process.on 'exit': @command=#{@command} @killed=#{@killed} code=#{code}"
      @kill()

    @child = ChildProcess._spawn(command, args, options)

    if pipeClass
      @pipe = new pipeClass(@child.stdout, @child.stderr, options)
    else
      @pipe = new Pipe(@child.stdout, @child.stderr)

    @child.on "exit", (code, signal)=>
      log.debug "ChildProcess.process.on 'exit': @command=#{@command} @killed=#{@killed} code=#{code} singal=#{signal}"
      @killed = true
      if code?
        log.info "spacejam: #{command} exited with code: #{code}"
      else if signal?
        log.info "spacejam: #{command} killed with signal: #{signal}"
      else
        log.error "spacejam: #{command} exited with arguments: #{arguments}"


  kill: (signal = "SIGTERM")->
    log.debug "ChildProcess.kill() signal=#{signal} @command=#{@command} @killed=#{@killed}"
    return if @killed
    log.info "spacejam: killing", @command
    @killed = true
    try
      # Providing a negative pid will kill the entire process group,
      # i.e. the process and all it's children
      # See man kill for more info
      #process.kill(-@child.pid, signal)
      @child?.kill(signal)

    catch err
      log.warn "spacejam: Error: While killing #{@command} with pid #{@child.pid}:\n", err


module.exports = ChildProcess
