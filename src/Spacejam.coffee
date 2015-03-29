require('./log')
expect = require("chai").expect
_ = require("underscore")
EventEmitter = require('events').EventEmitter
Meteor = require("./Meteor")
Phantomjs = require("./Phantomjs")


class Spacejam extends EventEmitter

  instance = null

  @get: ->
    instance ?= new Spacejam()

  defaultOptions: ->
    {
      'phantomjs-script': 'phantomjs-test-in-console'
      'phantomjs-options': '--load-images=no --ssl-protocol=TLSv1'
    }

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
    ALREADY_RUNNING: 5


  constructor: ->
    log.debug "Spacejam.constructor()"


  testPackages: (options = {})->
    log.debug "Spacejam.testPackages()", options
    expect(options).to.be.an "object"
    expect(options.timeout).to.be.a 'number' if options.timeout?
    expect(options['crash-spacejam-after']).to.be.a 'number' if options['crash-spacejam-after']?

    expect(@meteor, "Meteor is already running").to.be.null

    options = _.extend @defaultOptions(), options
    log.debug options

    try
      @meteor = new Meteor()
      @phantomjs = new Phantomjs()
    catch err
      console.trace err
      @emit "done", 1
      return


    @meteor.on "exit", (code)=>
      log.debug "Spacejam.meteor.on 'exit':", arguments
      @meteor = null
      if code
        @killChildren Spacejam.DONE.METEOR_ERROR

    @meteor.on "mongodb ready", =>
      log.info "spacejam: meteor mongodb is ready"
      @waitForMeteorMongodbKillDone = true
      @meteor.mongodb.on "kill-done", @onMeteorMongodbKillDone

    @meteor.on "ready", =>
      log.info "spacejam: meteor is ready"

      @runPhantom(@meteor.options["root-url"], options['phantomjs-options'], options['phantomjs-script'], options['xunit-output'])

    @meteor.on "error", =>
      log.error "spacejam: meteor has errors"
      @killChildren(Spacejam.DONE.METEOR_ERROR) if not options.watch

    try
      @meteor.testPackages(options)
    catch err
      console.trace err
      @emit "done", 1
      return

    if options.timeout? and +options.timeout > 0
      setTimeout =>
        log.error "spacejam: Error: tests timed out after #{options.timeout} milliseconds."
        @killChildren( Spacejam.DONE.TEST_TIMEOUT )
      , +options.timeout

    if options['crash-spacejam-after']? and +options['crash-spacejam-after'] > 0
      setTimeout =>
        throw new Error("Testing spacejam crashing.")
      , +options['crash-spacejam-after']


  testInVelocity: (options = {})->
    log.debug "Spacejam.testInVelocity()", options
    expect(options).to.be.an "object"
    expect(@meteor, "Meteor is already running").to.be.null

    process.env.VELOCITY_URL = options['velocity-url'] || process.env.ROOT_URL || "http://localhost:3000/"
    options['driver-package'] = "spacejamio:test-in-velocity"
    options.watch = true
    options['phantomjs-script'] = 'phantomjs-test-in-velocity'

    @testPackages(options);


  runPhantom: (url, options, script, xunitOutput)->
    log.debug "Spacejam.runPhantom()",arguments
    expect(url).to.be.a "string"
    expect(@phantomjs).to.be.ok

    @phantomjs.on "exit", (code, signal)=>
      @phantomjs = null
      @meteor?.kill()
      if code?
        @done code

    @phantomjs.run(url, options, script, xunitOutput)


  onMeteorMongodbKillDone: =>
    log.debug "Spacejam.onMeteorMongodbKillDone()", @doneCode
    @emit "done", @doneCode


  #Kill all running child_process instances
  killChildren: (code = 1)->
    log.debug "Spacejam.killChildren()",arguments
    expect(code,"Invalid exit code").to.be.a "number"

    if not @childrenKilled
      @meteor?.kill()
      @phantomjs?.kill()
    @childrenKilled = true
    @done(code)


  done: (code)->
    log.debug "Spacejam.done()", arguments
    expect(code, "Invalid done code").to.be.a "number"

    log.debug 'Spacejam.done() @meteor?=' + @meteor?
    @waitForMeteorMongodbKillDone = @meteor?.hasMongodb()
    log.debug 'Spacejam.done() @waitForMeteorMongodbKillDone=' + @waitForMeteorMongodbKillDone
    @emit "done", code if not @waitForMeteorMongodbKillDone
    log.debug 'Spacejam.done() waiting for mongodb to exit before calling done'
    @doneCode = code


module.exports = Spacejam
