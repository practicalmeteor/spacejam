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

  defaultOpts: {
    "port"        : process.env.PORT || 4096
    "root-url"    : process.env.ROOT_URL || null
    "mongo-url"   : process.env.MONGO_URL || null
    "settings"    : null
    "production"  : false
    "once"        : false
  }

  runOpts:{

  }

  testPackagesOpts:{
    "app"                 : null
    "driver-package"      : "test-in-console"
    "app-packages"        : true #TODO Add Support
    "timeout"             : 120000 # 2 minutes
    "packages"            : null
    "meteor-ready-text"   : "=> App running at:"
    "meteor-error-text"   : "Waiting for file change."
  }



  @exec: ->
    log.debug "Meteor.exec()",arguments
    return new Meteor()



  run: ->
    log.debug "Meteor.run()",arguments
    log.info("Spawning meteor")

  # @opts
  # @parseCommandLine
  testPackages: (opts,parseCommandLine=true)=>
    log.debug "Meteor.testPackages()"
    log.info("Spawning meteor")

    expect(@childProcess,"ChildProcess is already running").to.be.null
    opts = _.extend(_.clone(@defaultOpts),opts)
    opts = _.extend(_.clone(@testPackagesOpts),opts)
    opts = require("rc")("spacejam",opts,parseCommandLine || ->)

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
      "--once" if opts["once"]
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

    @childProcess.child?.stdout.on "data", (data) =>
      @buffer.stdout += data
      @hasErrorText data
      @hasReadyText data

    @childProcess.child?.stderr.on "data", (data) =>
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
    if buffer.lastIndexOf( @testPackagesOpts["meteor-error-text"] ) isnt -1
      @emit "error"


  hasReadyText: ( buffer )=>
    if buffer.lastIndexOf( @testPackagesOpts["meteor-ready-text"] ) isnt -1
      @emit "ready"

  kill:->
    @childProcess?.child?.kill()


module.exports = Meteor

