require('./log')
expect = require("chai").expect
_ = require("underscore")
EventEmitter = require('events').EventEmitter
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")


class SpaceJam extends EventEmitter

  instance = null
  @get: ->
    instance ?= new SpaceJam()

  opts:
    "timeout"   : 120000
    "crash-spacejam-after": 0

  meteor: null

  waitForMeteorMongodbKillDone: false

  phantomjs: null

  doneCode: null

  @DONE:
    TEST_SUCCESS: 0
    TEST_FAILED: 2
    METEOR_ERROR: 3
    TEST_TIMEOUT: 4


  testPackages: (opts = {})->
    log.debug "SpaceJam.testPackages()", arguments
    expect(opts).to.be.an "object"
    expect(@meteor,"Meteor is already running").to.be.null

    opts = _.extend @opts, opts
    log.debug opts

    try
      @meteor = new Meteor()
    catch err
      console.trace err
      @emit "done", 1
      return


    @meteor.on "exit", (code)=>
      @meteor = null
      if code
        @killChildren SpaceJam.DONE.METEOR_ERROR

    @meteor.on "ready", =>
      log.info "spacejam: meteor is ready"
      @waitForMeteorMongodbKillDone = @meteor.hasMongodb()
      if @waitForMeteorMongodbKillDone
        @meteor.mongodb.on "kill-done", @onMeteorMongodbKillDone

      @runPhantom(@meteor.opts["root-url"])

    @meteor.on "error", =>
      log.error "spacejam: meteor has errors, exiting"
      @waitForMeteorMongodbKillDone = @meteor.hasMongodb()
      if @waitForMeteorMongodbKillDone
        @meteor.mongodb.on "kill-done", @onMeteorMongodbKillDone
      @killChildren(SpaceJam.DONE.METEOR_ERROR)

    try
      @meteor.testPackages(opts)
    catch err
      console.trace err
      @emit "done", 1
      return

    setTimeout =>
      log.error "Tests timed out after #{opts.timeout} milliseconds."
      @killChildren( SpaceJam.DONE.TEST_TIMEOUT )
    , opts["timeout"]


    if +opts["crash-spacejam-after"] > 0
      setTimeout(->
        throw new Error("Testing spacejam crash")
      ,+opts["crash-spacejam-after"])


  runPhantom: (url)->
    log.debug "SpaceJam.runPhantom()",arguments
    expect(url).to.be.a "string"

    @phantomjs = new Phantomjs()

    @phantomjs.on "exit", (code, signal)=>
      @phantomjs = null
      @meteor?.kill()
      if code?
        @done code

    @phantomjs.run(url)


  onMeteorMongodbKillDone: =>
    log.debug "SpaceJam.onMeteorMongodbKillDone()", @doneCode
    @emit "done", @doneCode


  #Kill all running child_process instances
  killChildren: (code = 1)->
    log.debug "SpaceJam.killChildren()",arguments
    expect(code,"Invalid exit code").to.be.a "number"

    @meteor?.kill()
    @phantomjs?.kill()
    @done(code)


  done: (code)->
    log.debug "SpaceJam.done()", arguments
    expect(code, "Invalid done code").to.be.a "number"

    log.debug 'SpaceJam.done() @meteor?=' + @meteor?
    @waitForMeteorMongodbKillDone = @meteor?.hasMongodb()
    log.debug 'SpaceJam.done() @waitForMeteorMongodbKillDone=' + @waitForMeteorMongodbKillDone
    @emit "done", code if not @waitForMeteorMongodbKillDone
    log.debug 'SpaceJam.done() waiting for mongodb to exit before calling done'
    @doneCode = code


module.exports = SpaceJam
