expect = require('chai').expect
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
glob = require("glob")

class Meteor extends EventEmitter

  childProcess: null
  buffer:
    stdout:""
    stderr:""

  constructor:(@rc)->
    expect(@rc.port).to.be.a 'number'

    unless @rc.app
      log.error "no app have been specified"
      process.exit 1

    unless @rc.packages
      log.error "no packages to test have been specified"
      process.exit 1



  run: =>
    log.debug "Meteor.run()",arguments
    log.info("spawning meteor")
    expect(@childProcess).to.be.null

    testPackages = @_globPackages(@rc.packages)

    args = [
      "-p"
      @rc.port
      "--driver-package"
      "test-in-console"
      "test-packages"
    ]

    args = args.concat(testPackages)

    if @rc.settings?
      args.push "--settings"
      args.push @rc.settings

    options = {
      cwd:@rc.app,
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


  _globPackages: (packagesStr)-> # Use glob to get packages that match the @rc.packages arg
    log.debug "Meteor._globPackages()",arguments
    expect(packagesStr).to.be.a "string"

    packages = packagesStr.split(" ")
    matchedPackages = []

    globOpts = {
      cwd:"#{@rc.app}/packages"
    }
    packages.forEach (globPkg)=>
      globedPackages = glob.sync(globPkg, globOpts)

      if globedPackages.length is 0
        log.error "no packages matching #{@rc.packages} have been found"
        process.exit 1

      globedPackages.forEach (pkg)->
        matchedPackages.push(pkg)

    return matchedPackages



  hasErrorText: ( buffer )=>
    if buffer.lastIndexOf( @rc.meteor_error_text ) isnt -1
      @emit "error"


  hasReadyText: ( buffer )=>
    if buffer.lastIndexOf( @rc.meteor_ready_text ) isnt -1
      @emit "ready"

  kill:->
    @childProcess?.child?.kill()


module.exports = Meteor

