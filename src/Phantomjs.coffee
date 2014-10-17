expect = require('chai').expect
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
path = require 'path'
phantomjs = require 'phantomjs'
process.env.PATH = path.dirname(phantomjs.path) + ':' + process.env.PATH
_ = require "underscore"
log.debug "PATH="+process.env.PATH

class Phantomjs extends EventEmitter

  childProcess: null


  run: (url)=>
    log.debug "Phantomjs.run()"
    log.info("spawning phantomjs")
    expect(url,"Invalid @url").to.be.a 'string'
    expect(@childProcess,"ChildProcess is already running").to.be.null

    env = _.extend process.env, {ROOT_URL: url}

    args = ["phantom-runner.js"]
    options = {
      cwd: __dirname+"/../lib",
      detached:false
      env: env
    }

    @childProcess = new ChildProcess()
    @childProcess.spawn("phantomjs",args,options)

    @childProcess.child.on "exit", (code, signal) =>
      @emit "exit", code, signal

  kill: (signal="SIGINT")->
    log.debug "Phantomjs.kill()"
    @childProcess?.kill(signal)


module.exports = Phantomjs

