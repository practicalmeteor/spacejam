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

  options: null

  mongodb: null

  defaultOptions: ->
    {
      "dir": "."
      "port": 4096
      "packages": []
      "driver-package": "test-in-console"
      "meteor-ready-text": "=> App running at:"
      "meteor-error-text": "Waiting for file change."
    }


  @getPackageVersion: ->
    log.debug "Meteor.getPackageVersion()"
    if not fs.existsSync('package.js')
      throw new Error("Missing package.js in current working directory.")
    require './PackageJSStubs'
    require "#{process.cwd()}/package.js"
    expect(Package.description?.version).to.be.a('string').that.is.ok
    return Package.description.version

  # => Exited with code:
  # => Your application has errors. Waiting for file change.
  # => Your application is crashing. Waiting for file change.
  # => Modified -- restarting.
  # => App running at: http://ronenvm:3000/
  # => Meteor server restarted
  # => Errors prevented startup:

  # @options
  # @parseCommandLine
  testPackages: (options = {})=>
    log.debug "Meteor.testPackages()", arguments
    expect(options, "options should be an object.").to.be.an "object"
    expect(@childProcess, "Meteor's child process is already running").to.be.null

    @options = _.extend(@defaultOptions(), options)

    # Shortcut option to run meteor with practicalmeteor:mocha test driver package
    if @options["mocha"]?
      @options['driver-package'] = "practicalmeteor:mocha-spacejam-reporter"

    log.debug 'meteor options:', @options

    cwd = path.resolve(@options.dir);

    log.debug "meteor cwd=#{cwd}"

    expect(@options['driver-package'], "options.driver-package is missing").to.be.ok

    expect(+@options.port, "options.port is not a number.").to.be.ok

    @options["root-url"] ?= "http://localhost:#{@options.port}/"

    expect(@options.packages, "options.packages is not an array of package names").to.be.an 'array'

    if @options.packages.length > 0
      packagesToTest = @_globPackages(@options.packages)
      expect(packagesToTest).to.have.length.above 0

    args = [
      'test-packages'
      '--driver-package'
      @options['driver-package']
    ]
    args.push(["--release", @options.release]) if @options.release
    args.push(["--port", @options.port])
    args.push("--production") if @options.production
    args.push(["--settings", @options.settings]) if @options.settings
    args.push(packagesToTest) if packagesToTest?.length > 0

    # flatten nested testPackages array into args
    args = _.flatten(args)

    log.debug 'meteor args=', args

    env = _.clone(process.env)
    env.ROOT_URL = @options["root-url"]
    if @options["mongo-url"]
      env.MONGO_URL = @options["mongo-url"]
    else
      delete env.MONGO_URL if env.MONGO_URL?


    options = {
      cwd: cwd,
      env: env,
      detached: false
    }

    @childProcess = new ChildProcess()
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
          log.warn "spacjam: Warning: No packages matching #{pkgArg} have been found. Will add it to the meteor command line anyway, in case it's in PACKAGE_DIRS."
          # TODO: Support globs in PACKAGE_DIRS too.
          matchedPackages.push(pkgArg)

    return matchedPackages


  hasStartedMongoDBText: (buffer)=>
    if buffer.lastIndexOf('Started MongoDB') isnt -1
      @mongodb = new MeteorMongodb(@childProcess.child.pid)
      @emit "mongodb ready"


  hasErrorText: (buffer)=>
    if buffer.lastIndexOf( @defaultOptions()["meteor-error-text"] ) isnt -1
      @emit "error"


  hasReadyText: (buffer)=>
    if buffer.lastIndexOf( @defaultOptions()["meteor-ready-text"] ) isnt -1
      @emit "ready"


  hasMongodb: ->
    log.debug "Meteor.hasMongodb()"
    return @mongodb.hasMongodb() if @mongodb
    return false


  # TODO: Test
  kill: (signal="SIGTERM")->
    log.debug "Meteor.kill()", arguments, "@childProcess?=", @childProcess?, "@mongodb?=", @mongodb?
    @childProcess?.kill(signal)
    @mongodb?.kill()

module.exports = Meteor
