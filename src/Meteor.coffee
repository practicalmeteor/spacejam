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

    unless @rc.app_path
      log.error "no app have been specified"
      process.exit 1

    unless @rc.packages
      log.error "no packages to test have been specified"
      process.exit 1



  run: =>
    log.info("spawning meteor")
    expect(@childProcess).to.be.null
    args = [
      "-p"
      @rc.port
      "test-packages"
      "--driver-package"
      "test-in-console"
    ]
    if @rc.settings_path?
      args.push "--settings"
      args.push @rc.settings_path

    options = {
      cwd:@rc.app_path,
      detached:false
    }
    globOpts = {
      cwd:"#{@rc.app_path}/packages"
    }

    glob @rc.packages, globOpts, (err, packages)=> # Use glob to get packages that match the @rc.packages arg
      expect(err).to.be.null
      if packages.length is 0
        log.error "no packages matching #{@rc.packages} have been found"
        process.exit 1

      packages.forEach (pkg)-> # Append matching packages in the args array after 'test-packages'
        args.splice args.indexOf("test-packages")+1,0,pkg

      @childProcess = new ChildProcess()
      @childProcess.spawn("meteor",args,options)

      @childProcess.child.stdout.on "data", (data) =>
        @buffer.stdout += data
        @hasErrorText data
        @hasReadyText data

      @childProcess.child.stderr.on "data", (data) =>
        @buffer.stderr += data
        @hasErrorText data



  hasErrorText: ( buffer )=>
    if buffer.lastIndexOf( @rc.meteor_error_text ) isnt -1
      @emit "error"


  hasReadyText: ( buffer )=>
    if buffer.lastIndexOf( @rc.meteor_ready_text ) isnt -1
      @emit "ready"

  kill:->
    @childProcess?.child?.kill()


module.exports = Meteor

