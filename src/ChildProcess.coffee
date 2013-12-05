expect = require('chai').expect
log = require('loglevel')
_exec = require("child_process").exec
_spawn = require("child_process").spawn

class ChildProcess
  child: null

  constructor:->
    log.debug "ChildProcess.constructor", arguments

  exec: (command, taskName)->
    log.debug "ChildProcess.exec()", arguments
    expect(@child).to.be.null
    expect(command).to.be.a 'string'
    expect(taskName).to.be.a 'string'

    @child = _exec command, (err, stdout, stderr) =>
      if err?.code? and err.code isnt 0
        console.error "#{taskName} exit code: "+err.code
        process.exit(err.code)
      if err?.signal? and err.signal isnt 0
        console.error "#{taskName} termination signal: "+err.signal
        process.exit(1)

    @child.stdout.on 'data',(data)->
      console.info(data)

    @child.stderr.on 'data',(data)->
      console.error(data)

  spawn: (command,args,options)->
    log.debug "ChildProcess.spawn() ",command
    expect(@child).to.be.null
    expect(command).to.be.a 'string'
    if args?
      expect(args).to.be.an 'array'

    if options?
      expect(options).to.be.an 'object'

    @child = _spawn(command,args,options)

    @child.stdout.setEncoding('utf8');
    @child.stderr.setEncoding('utf8');

    @child.stdout.on "data", (data) =>
      log.info data

    @child.stderr.on "data", (data) =>
      log.error data

    @child.on "exit", (code,signal) =>
      if code?
        log.info "#{command} exited with code: " + code
      else if signal?
        log.info "#{command} killed with signal: " + signal
      else
        log.error "#{command} exited: " + args

  kill: (signal)->
    @child.kill(signal)

module.exports = ChildProcess
###
    exec: (command,options,cb)->
    log.debug "ChildProcess.exec() ",command
    expect(@child).to.be.null
    expect(command).to.be.a 'string'

    if options?
      expect(options).to.be.an 'object'

    if cb?
      expect(cb).to.be.a 'function'

    @child = _exec(command,options,cb)

    @child.stdout.setEncoding('utf8');
    @child.stderr.setEncoding('utf8');

    @child.stdout.on "data", (data) =>
      log.info data

    @child.stderr.on "data", (data) =>
      log.error data

    @child.on "exit", (code,signal) =>
      if code?
        log.info "#{command} exited with code: " + code
      else if signal?
        log.info "#{command} killed with signal: " + signal
      else
        log.error "#{command} exited: " + args
###