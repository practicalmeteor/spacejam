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

  testPackagesOptions:
    "timeout"   : 120000
    "crash-spacejam-after": 0

  meteor: null

  waitForMeteorMongodbKillDone: false

  phantomjs: null

  doneCode: null

  childrenKilled: false

  @DONE:
    TEST_SUCCESS: 0
    TEST_FAILED: 2
    METEOR_ERROR: 3
    TEST_TIMEOUT: 4


  testPackages: (options = {})->
    log.debug "SpaceJam.testPackages()", options
    expect(options).to.be.an "object"
    expect(@meteor, "Meteor is already running").to.be.null

    options = _.extend @testPackagesOptions, options
    log.debug options

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

    @meteor.on "mongodb ready", =>
      log.info "spacejam: meteor mongodb is ready"
      @waitForMeteorMongodbKillDone = true
      @meteor.mongodb.on "kill-done", @onMeteorMongodbKillDone

    @meteor.on "ready", =>
      log.info "spacejam: meteor is ready"

      @runPhantom(@meteor.options["root-url"], options['phantomjs-script'])

    @meteor.on "error", =>
      log.error "spacejam: meteor has errors"

      # If timeout > 0 it means we should run the tests only once
      @killChildren(SpaceJam.DONE.METEOR_ERROR) if options.timeout > 0

    try
      @meteor.testPackages(options)
    catch err
      console.trace err
      @emit "done", 1
      return

    if +options.timeout > 0
      setTimeout =>
        log.error "spacejam: Error: tests timed out after #{options.timeout} milliseconds."
        @killChildren( SpaceJam.DONE.TEST_TIMEOUT )
      , +options.timeout

    if +options["crash-spacejam-after"] > 0
      setTimeout =>
        throw new Error("Testing spacejam crash")
      , +options["crash-spacejam-after"]


  testInVelocity: (options = {})->
    log.debug "SpaceJam.testInVelocity()", options
    expect(options).to.be.an "object"
    expect(@meteor, "Meteor is already running").to.be.null

    process.env.VELOCITY_URL = options['velocity-url'] || process.env.ROOT_URL || "http://localhost:3000/"
    options['driver-package'] = "spacejamio:test-in-velocity"
    options.timeout = 0
    options['phantomjs-script'] = 'phantomjs-test-in-velocity'

    @testPackages(options);


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

    if not @childrenKilled
      @meteor?.kill()
      @phantomjs?.kill()
    @childrenKilled = true
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
