expect = require('chai').expect
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
path = require 'path'
phantomjs = require 'phantomjs'
process.env.PATH += ':' + path.dirname(phantomjs.path)
_ = require "underscore"

class Phantomjs extends EventEmitter

  childProcess: null


  constructor:(@rc)->
    expect(@rc.root_url).to.be.a 'string'


  run: =>
    log.debug "Phantomjs.run()"
    log.info("spawning phantomjs")
    expect(@childProcess).to.be.null

    env = _.extend process.env, {ROOT_URL: @rc.root_url}

    args = ["phantom-runner.js"]
    options = {
      cwd: __dirname+"/../lib",
      detached:false
      env: env
    }

    @childProcess = new ChildProcess()
    @childProcess.spawn("phantomjs",args,options)

    @childProcess.child.on "exit", (code,signal) =>
      @emit "exit",code,signal

  kill:->
    log.debug "Phantomjs.kill()"
    @childProcess?.child?.kill()


module.exports = Phantomjs

