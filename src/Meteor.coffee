require('./log')
expect = require('chai').expect
_ = require("underscore")
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
MeteorMongodb = require("./MeteorMongodb.coffee")
glob = require("glob")
fs = require("fs")
path = require "path"

class Meteor extends EventEmitter

  childProcess: null

  buffer:{
    stdout:""
    stderr:""
  }

  driverPackage: "test-in-console"

  opts: null

  meteorMongodb: null


  # It is a function not an object because of design for testability, so we can modify process.env before each tests.
  baseOpts: ->
    {
      "port"        : process.env.PORT || 4096
      "root-url"    : process.env.ROOT_URL || null
      "mongo-url"   : process.env.MONGO_URL || null
      "settings"    : null
      "production"  : false
      "production"  : false
      "production"  : false
      "once"        : false
    }



  runOpts: ->
  {

  }



  # See baseOpts why it is a function an not an object.
  testPackagesOpts: ->
    {
      "app": "."
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
    # @testPackagesOpts overwrite @baseOpts
    @opts = _.extend(@baseOpts(), @testPackagesOpts())

    # input opts take higher precedence
    @opts = _.extend(@opts, opts)

    # command line opts take even higher precedence
    if parseCommandLine
      @opts = require("rc")("spacejam",@opts)
    else
      @opts = require("rc")("spacejam",@opts,->)

    expect(+@opts["port"],"--port is not a number. See 'spacejam help' for more info.").to.be.ok

    @opts["root-url"] ?= Meteor.getDefaultRootUrl(@opts["port"])

    packages = @opts._[1..] # Get packages from command line

    _testPackages = null
    if packages.length > 0
      _testPackages = @_globPackages(@opts["app"],packages)

      if !_testPackages.length > 0
        log.warn "Package not found"
        @emit "exit",1
        return

    args = [
      "--port"
      @opts["port"]
      "--driver-package"
      @driverPackage
      "test-packages"
    ]
    args.push(_testPackages) if _testPackages
    args.push("--production") if @opts["production"]
    args.push("--once") if @opts["once"]
    args.push(["--settings",@opts["settings"]]) if @opts["settings"]
    args.push(["--release",@opts["release"]]) if @opts["release"]
    args.push(["--deploy",@opts["deploy"]]) if @opts["deploy"]

    # Remove undefined values from args
    args = _.without(args,undefined)
    args = _.without(args,null)
    # flatten nested testPackages array into args
    args = _.flatten(args)

    env = process.env
    env.ROOT_URL = @opts["root-url"]
    env.MONGO_URL = @opts["mongo-url"] if @opts["mongo-url"]

    options = {
      cwd: @opts["app"],
      env: env,
      detached:false
    }

    @childProcess = new ChildProcess()
    @childProcess.spawn("meteor",args,options)

    @childProcess.child.on "exit", (code,signal) =>
      @emit "exit",code,signal

    @childProcess.child.stdout.on "data", (data) =>
      @buffer.stdout += data
      @hasErrorText data
      @hasReadyText data

    @childProcess.child.stderr.on "data", (data) =>
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

    appPath = path.resolve(app)
    meteorPath = "#{appPath}/.meteor"

    if fs.existsSync(meteorPath)
      cwd = "#{appPath}/packages"
    else
      cwd = appPath

    globOpts = {
      cwd: cwd
    }
    packages.forEach (globPkg)=>
      globedPackages = glob.sync(globPkg, globOpts)
      if globedPackages.length > 0
        globedPackages.forEach (pkg)->
          matchedPackages.push(pkg)
####
#      else
#        log.warn "No packages matching #{packages} have been found."
#        if app is "."
#          log.warn "Make sure you are running spacejam from a meteor app folder. If not, use --app to specify app folder."
####

    return matchedPackages



  hasErrorText: ( buffer )=>
    if buffer.lastIndexOf( @testPackagesOpts()["meteor-error-text"] ) isnt -1
      @meteorMongodb = new MeteorMongodb(@childProcess.child.pid,=>
        @emit "error"
      )




  hasReadyText: ( buffer )=>
    if buffer.lastIndexOf( @testPackagesOpts()["meteor-ready-text"] ) isnt -1
      @meteorMongodb = new MeteorMongodb(@childProcess.child.pid,=>
        @emit "ready"
      )


  hasMongodb: ->
    log.debug "Meteor.hasMongodb()"
    return @meteorMongodb.hasMongodb()


  # TODO: Test
  kill: (signal="SIGINT")->
    log.debug "Meteor.kill()",arguments
    @childProcess?.kill(signal)
    @meteorMongodb?.kill()

module.exports = Meteor
