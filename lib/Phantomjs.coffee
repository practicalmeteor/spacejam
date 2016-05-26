_ = require "underscore"
expect = require('chai').expect
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
path = require 'path'
phantomjs = require 'phantomjs-prebuilt'

DEFAULT_PATH = process.env.PATH


class Phantomjs extends EventEmitter

  childProcess: null

  run: (url, options = '--load-images=no --ssl-protocol=TLSv1', script = "phantomjs-test-in-console.js", pipeClass = undefined, pipeClassOptions = undefined, useSystemPhantomjs = false)=>
    log.debug "Phantomjs.run()", arguments
    expect(@childProcess,"ChildProcess is already running").to.be.null
    expect(url, "Invalid url").to.be.a 'string'
    expect(options, "Invalid options").to.be.a 'string'
    expect(script, "Invalid script").to.be.a 'string'
    expect(pipeClass, "Invalid pipeClass").to.be.a 'function' if pipeClass?
    expect(pipeClassOptions, "Invalid pipeClassOptions").to.be.an 'object' if pipeClassOptions?
    expect(useSystemPhantomjs, "Invalid useSystemPhantomjs").to.be.a 'boolean'

    env = _.extend process.env, {ROOT_URL: url}

    log.debug("script=#{__dirname}/#{script}")
    spawnArgs = options.split(' ')
    spawnArgs.push(script)
    log.debug 'spawnArgs:', spawnArgs
    spawnOptions =
      cwd: __dirname
      detached: false
      env: env
    log.debug 'spawnOptions:', spawnOptions

    # Use the relative path to phantomjs
    # unless you prefer to use the env PATH (--use-system-phantomjs)
    program = "phantomjs";
    if useSystemPhantomjs
      process.env.PATH = DEFAULT_PATH
    else
      program = path.join(path.dirname(phantomjs.path), program)

    @childProcess = new ChildProcess()
    @childProcess.spawn(program, spawnArgs, spawnOptions, pipeClass, pipeClassOptions)

    @childProcess.child.on "exit", (code, signal) =>
      @emit "exit", code, signal

  kill: (signal = "SIGTERM")->
    log.debug "Phantomjs.kill()"
    @childProcess?.kill(signal)


module.exports = Phantomjs

