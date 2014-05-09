expect = require('chai').expect
_ = require("underscore")
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter
glob = require("glob")

class Meteor extends EventEmitter

  childProcess: null
  buffer:
    stdout:""
    stderr:""

  constructor:(@opts)->
    expect(+@opts["port"]).to.be.ok

    unless @opts["app"]
      log.error "no app have been specified"
      process.exit 1

    unless @opts["packages"]
      log.error "no packages to test have been specified"
      process.exit 1



  run: =>
    log.debug "Meteor.run()",arguments
    log.info("spawning meteor")
    expect(@childProcess).to.be.null

    testPackages = @_globPackages(@opts["packages"])

    args = [
      "--port"
      @opts["port"]
      "--driver-package"
      @opts["driver-package"]
      "--production" if @opts["production"]
#      "--once" if @opts["once"]
      "--settings" if @opts["settings"]
      @opts["settings"]
      "test-packages"
      testPackages
    ]
    # Remove undefined values from args
    args = _.without(args,undefined)
    args = _.without(args,null)
    # flatten nested testPackages array into args
    args = _.flatten(args)

    options = {
      cwd:@opts["app"],
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


  _globPackages: (packagesStr)-> # Use glob to get packages that match the @opts["packages"] arg
    log.debug "Meteor._globPackages()",arguments
    expect(packagesStr).to.be.a "string"

    packages = packagesStr.split(" ")
    matchedPackages = []

    globOpts = {
      cwd:"#{@opts['app']}/packages"
    }
    packages.forEach (globPkg)=>
      globedPackages = glob.sync(globPkg, globOpts)

      if globedPackages.length is 0
        log.error "no packages matching #{@opts['packages']} have been found"
        process.exit 1

      globedPackages.forEach (pkg)->
        matchedPackages.push(pkg)

    return matchedPackages



  hasErrorText: ( buffer )=>
    if buffer.lastIndexOf( @opts["meteor_error_text"]) isnt -1
      @emit "error"


  hasReadyText: ( buffer )=>
    if buffer.lastIndexOf( @opts["meteor_ready_text"]) isnt -1
      @emit "ready"

  kill:->
    @childProcess?.child?.kill()


module.exports = Meteor

