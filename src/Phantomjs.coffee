expect = require('chai').expect
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
_ = require "underscore"

class Phantomjs extends EventEmitter

  childProcess: null


  constructor:(@rc)->
    log.debug "Phantomjs.constructor()"
    expect(@rc.root_url).to.be.a 'string'


  run: =>
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


module.exports = Phantomjs

