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



  # It is a function not an object because of design for testability, so we can modify process.env before each tests.
  defaultOpts: ->
    {
      "port"        : process.env.PORT || 4096
      "root-url"    : process.env.ROOT_URL || null
      "mongo-url"   : process.env.MONGO_URL || null
      "settings"    : null
      "production"  : false
      "once"        : false
    }



  runOpts: ->
  {

  }



  # See defaultOpts why it is a function an not an object.
  testPackagesOpts: ->
    {
      "app": null
      "driver-package": "test-in-console"
      "app-packages": true #TODO Add Support for testing all packages within an app that are not symlinks
      "timeout": 120000 # 2 minutes
      "meteor-ready-text": "=> App running at:"
      "meteor-error-text": "Waiting for file change."
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
    expect(opts,"@opts should be an object.").to.be.an "object"
    expect(parseCommandLine,"@parseCommandLine should be a boolean.").to.be.a "boolean"

    expect(@childProcess,"Meteor's child process is already running").to.be.null
    opts = _.extend(@testPackagesOpts(),opts)
    opts = _.extend(@defaultOpts(),opts)

    packages = opts._[1..] # Get packages from command line

    if parseCommandLine
      opts = require("rc")("spacejam",opts)
    else
      opts = require("rc")("spacejam",opts,->)

    expect(+opts["port"],"--port is not a number. See 'spacejam help' for more info.").to.be.ok

    opts["root-url"] ?= Meteor.getDefaultRootUrl(opts["port"])

    if !opts["app"]
      log.error "No meteor app has been specified. See 'spacejam help' for more info."
      process.exit 1

    if !packages.length > 0
      log.error "No packages to test have been specified. See 'spacejam help' for more info."
      process.exit 1


    testPackages = @_globPackages(opts["app"],packages)

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

    env = process.env
    env.ROOT_URL = opts["root-url"] if opts["root-url"]
    env.MONGO_URL = opts["mongo-url"] if opts["mongo-url"]

    options = {
      cwd: opts["app"],
      env: env,
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



  @getDefaultRootUrl: (port)->
    log.debug "Meteor.getDefaultRootUrl()",arguments
    if port
      expect(+port,"--port is not a number. See 'spacejam help' for more info.").to.be.ok

    port = port ||
      process.env.SPACEJAM_PORT ||
      process.env.PORT ||
      4096
    rootUrl = "http://localhost:#{port}/"
    return rootUrl



  # TODO: Test
  _globPackages: (app,packages)-> # Use glob to get packages that match the packages arg
    log.debug "Meteor._globPackages()",arguments
    expect(app,"@app should be a string").to.be.a "string"
    expect(packages,"@packages should be and array").to.be.an "array"

    matchedPackages = []

    globOpts = {
      cwd:"#{app}/packages"
    }
    packages.forEach (globPkg)=>
      globedPackages = glob.sync(globPkg, globOpts)

      if globedPackages.length is 0
        log.error "no packages matching #{packages} have been found"
        process.exit 1

      globedPackages.forEach (pkg)->
        matchedPackages.push(pkg)

    return matchedPackages



  hasErrorText: ( buffer )=>
    if buffer.lastIndexOf( @testPackagesOpts()["meteor-error-text"] ) isnt -1
      @emit "error"



  hasReadyText: ( buffer )=>
    if buffer.lastIndexOf( @testPackagesOpts()["meteor-ready-text"] ) isnt -1
      @emit "ready"


  # TODO: Test
  kill:->
    @childProcess?.child?.kill()


module.exports = Meteor
