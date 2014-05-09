expect = require('chai').expect
_ = require("underscore")
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
glob = require("glob")

class Meteor extends EventEmitter

  childProcess: null

  buffer:{
    stdout:""
    stderr:""
  }

  #TODO: Why static?
  defaultOpts: {
    "port"        : process.env.PORT || 4096
    "root-url"    : process.env.ROOT_URL || null
    "mongo-url"   : process.env.MONGO_URL || null
    "settings"    : null
    "production"  : false
#      "once"     : false #Ask about this
  }

  runOpts:{

  }

  testPackagesOpts:{
    "app"                 : null #TODO: App not required in test-packages, Ask abut this
    "driver-package"      : "test-in-console"
    "app-packages"        : true #TODO Add Support, Ask abut this
    "timeout"             : 120000 # 2 minutes
    "packages"            : null
    "run-phantomjs-tests" : false #TODO: Support
    "meteor_ready_text"   : "=> App running at:" #TODO: Check test-packages ready text
    "meteor_error_text"   : "Waiting for file change." #TODO: Check test-packages error text
  }

  runCommands = {
    "help": -> MeteorWrapper.printUsage()
    "run": ->
    "test-packages":->
  }


  @exec: ->
    log.debug "Meteor.exec()",arguments

  run: ->
    log.debug "Meteor.run()",arguments
    log.info("Spawning meteor")


  # @opts
  # @parseCommandLine: default true (an empty func if false)
  # TODO: extend rc options with opts argument
  testPackages: (opts,parseCommandLine)=>
    log.debug "Meteor.testPackages()",arguments
    log.info("Spawning meteor")
    expect(@childProcess,"ChildProcess is already running").to.be.null

    extendedOpts = _.extend(@defaultOpts,@testPackagesOpts)
    opts = require("rc")("mctr",extendedOpts)

    expect(+opts["port"],"Invalid @port").to.be.ok

    if !opts["app"]
      log.error "no app have been specified"
      process.exit 1

    if !opts["packages"]
      log.error "no packages to test have been specified"
      process.exit 1


    testPackages = @_globPackages(opts["app"],opts["packages"])

    args = [
      "--port"
      opts["port"]
      "--driver-package"
      opts["driver-package"]
      "--production" if opts["production"]
#      "--once" if opts["once"]
      "--settings" if opts["settings"]
      opts["settings"]
      "test-packages"
      testPackages
    ]
    # Remove undefined values from args
    args = _.without(args,undefined)
    args = _.without(args,null)
    # flatten nested testPackages array into args
    args = _.flatten(args)

    options = {
      cwd:opts["app"],
      detached:false
    }

    @childProcess = new ChildProcess()
    @childProcess.spawn("meteor",args,options)

    @childProcess.child.stdout.on "data", (data) =>
      @buffer.stdout += data
      @hasErrorText data
      @hasReadyText data

    @childProcess.child.stderr.on "data", (data) =>
      @buffer.stderr += data
      @hasErrorText data

  _globPackages: (app,packagesStr)-> # Use glob to get packages that match the opts["packages"] arg
    log.debug "Meteor._globPackages()",arguments
    expect(packagesStr,"Invalid @packagesStr").to.be.a "string"

    packages = packagesStr.split(" ")
    matchedPackages = []

    globOpts = {
      cwd:"#{app}/packages"
    }
    packages.forEach (globPkg)=>
      globedPackages = glob.sync(globPkg, globOpts)

      if globedPackages.length is 0
        log.error "no packages matching #{packagesStr} have been found"
        process.exit 1

      globedPackages.forEach (pkg)->
        matchedPackages.push(pkg)

    return matchedPackages



  hasErrorText: ( buffer )=>
    if buffer.lastIndexOf( @testPackagesOpts["meteor_error_text"] ) isnt -1
      @emit "error"


  hasReadyText: ( buffer )=>
    if buffer.lastIndexOf( @testPackagesOpts["meteor_ready_text"] ) isnt -1
      @emit "ready"

  kill:->
    @childProcess?.child?.kill()


module.exports = Meteor

