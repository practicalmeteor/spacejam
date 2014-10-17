require('./log')
expect = require('chai').expect
_ = require("underscore")
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
MeteorMongodb = require("./MeteorMongodb")
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

  mongodb: null


  # It is a function not an object because of design for testability, so we can modify process.env before each tests.
  baseOpts: ->
    {
      "port"        : process.env.PORT || 4096
      "root-url"    : process.env.ROOT_URL || null
      "mongo-url"   : process.env.MONGO_URL || null
      "settings"    : null
      "production"  : false
      "release"     : null
    }



  # See baseOpts why it is a function an not an object.
  testPackagesOpts: ->
    {
      "timeout": 120000 # 2 minutes
      "meteor-ready-text": "=> App running at:"
      "meteor-error-text": "Waiting for file change."
    }



  # @opts
  # @parseCommandLine
  testPackages: (opts, parseCommandLine = true)=>
    log.debug "Meteor.testPackages()"
    expect(opts,"@opts should be an object.").to.be.an "object"
    expect(parseCommandLine,"@parseCommandLine should be a boolean.").to.be.a "boolean"
    expect(@childProcess, "Meteor's child process is already running").to.be.null

    # @testPackagesOpts overwrite @baseOpts
    @opts = _.extend(@baseOpts(), @testPackagesOpts())

    # input opts take higher precedence
    @opts = _.extend(@opts, opts)

    # command line opts take even higher precedence
    if parseCommandLine
      @opts = require("rc")("spacejam",@opts)
    else
      @opts = require("rc")("spacejam",@opts,->)

    if not fs.existsSync(process.cwd() + '/.meteor/packages') and not fs.existsSync('package.js')
      throw new Error("spacejam needs to be run from within a meteor app or package folder.")

    expect(+@opts.port, "--port is not a number. See 'spacejam help' for more info.").to.be.ok

    @opts["root-url"] ?= Meteor.getDefaultRootUrl(@opts.port)

    packages = @opts._[1..] # Get packages from command line

    if packages.length > 0
      _testPackages = @_globPackages(packages)
      expect(_testPackages).to.have.length.above 0

    args = [
      'test-packages'
      '--driver-package'
      @driverPackage
    ]
    args.push(["--release", @opts.release]) if @opts.release
    args.push(["--port", @opts.port])
    args.push("--production") if @opts.production
    args.push(["--settings", @opts.settings]) if @opts.settings
    args.push(_testPackages) if _testPackages

    # flatten nested testPackages array into args
    args = _.flatten(args)

    env = process.env
    env.ROOT_URL = @opts["root-url"]
    env.MONGO_URL = @opts["mongo-url"] if @opts["mongo-url"]

    options = {
      cwd: ".",
      env: env,
      detached: false
    }

    @childProcess = new ChildProcess()
    log.info("Spawning meteor")
    @childProcess.spawn("meteor",args,options)

    @childProcess.child.on "exit", (code,signal) =>
      @emit "exit",code,signal

    @childProcess.child.stdout.on "data", (data) =>
      @buffer.stdout += data
      @hasStartedMongoDBText data
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
  _globPackages: (packages)-> # Use glob to get packages that match the packages arg
    log.debug "Meteor._globPackages()",arguments
    expect(packages,"@packages should be and array").to.be.an "array"

    pkgsFolder = process.cwd() + '/packages'

    globOpts = {
      cwd: pkgsFolder
    }

    matchedPackages = []

    packages.forEach (pkgArg)=>
      if pkgArg.indexOf(':') > 0
        # It's a package name in the new format, we'll add it as is
        # TODO: Support globs for this too, by looking up package names inside package.js
        matchedPackages.push(pkgArg)
      else if pkgArg.indexOf('/') >= 0
        # It's a path to a package, we'll add it as is too
        # TODO: Support globs for this too
        matchedPackages.push(pkgArg)
      else
        # It's a package name, let's find matching package names, if it includes wildcards
        globedPackages = glob.sync(pkgArg, globOpts)
        if globedPackages.length > 0
          globedPackages.forEach (pkg)->
            matchedPackages.push(pkg)
        else
          log.warn "Warning: No packages matching #{pkgArg} have been found. Will add it to the meteor command line anyway, in case it's in PACKAGE_DIRS."
          # TODO: Support globs in PACKAGE_DIRS too.
          matchedPackages.push(pkgArg)

    return matchedPackages


  hasStartedMongoDBText: (buffer)=>
    if buffer.lastIndexOf('Started MongoDB') isnt -1
      @mongodb = new MeteorMongodb(@childProcess.child.pid)


  hasErrorText: (buffer)=>
    if buffer.lastIndexOf( @testPackagesOpts()["meteor-error-text"] ) isnt -1
      @emit "error"


  hasReadyText: (buffer)=>
    if buffer.lastIndexOf( @testPackagesOpts()["meteor-ready-text"] ) isnt -1
      @emit "ready"


  hasMongodb: ->
    log.debug "Meteor.hasMongodb()"
    return @mongodb.hasMongodb() if @mongodb
    return false


  # TODO: Test
  kill: (signal="SIGINT")->
    log.debug "Meteor.kill()", arguments
    log.debug "Meteor.kill() @childProcess?=", @childProcess?
    log.debug "Meteor.kill() @mongodb?=", @mongodb?
    @childProcess?.kill(signal)
    @mongodb?.kill()

module.exports = Meteor
