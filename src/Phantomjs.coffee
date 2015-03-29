_ = require "underscore"
expect = require('chai').expect
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
Pipe = require './Pipe'
XunitFilePipe = require './XunitFilePipe'
path = require 'path'
phantomjs = require 'phantomjs'
process.env.PATH = path.dirname(phantomjs.path) + ':' + process.env.PATH
isCoffee = __filename.indexOf('.coffee') > 0


class Phantomjs extends EventEmitter

  childProcess: null

  run: (url, options = '--load-images=no --ssl-protocol=TLSv1', script = "phantomjs-test-in-console", xunitOutput = '')=>
    log.debug "Phantomjs.run()", arguments
    expect(url, "Invalid url").to.be.a 'string'
    expect(options, "Invalid options").to.be.a 'string'
    expect(script, "Invalid script").to.be.a 'string'
    expect(xunitOutput, "Invalid xunit output").to.be.a 'string'
    expect(@childProcess,"ChildProcess is already running").to.be.null

    env = _.extend process.env, {ROOT_URL: url}

    script += if isCoffee then '.coffee' else '.js'
    log.debug("script=#{__dirname}/#{script}")
    spawnArgs = options.split(' ')
    spawnArgs.push(script)
    if xunitOutput
      # set platform to xunit (see phantomjs-test-in-console)
      spawnArgs.push('xunit')
    spawnOptions = {
      cwd: __dirname,
      detached: false
      env: env
      pipeToFile: xunitOutput
    }

    @childProcess = new ChildProcess()
    pipeClass = Pipe
    if xunitOutput
      pipeClass = XunitFilePipe
    @childProcess.spawn("phantomjs", spawnArgs, spawnOptions, pipeClass)

    @childProcess.child.on "exit", (code, signal) =>
      @emit "exit", code, signal

  kill: (signal = "SIGTERM")->
    log.debug "Phantomjs.kill()"
    @childProcess?.kill(signal)


module.exports = Phantomjs

