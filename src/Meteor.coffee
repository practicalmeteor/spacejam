expect = require('chai').expect
ChildProcess = require './ChildProcess'
EventEmitter = require('events').EventEmitter

class Meteor extends EventEmitter

  childProcess: null
  buffer:
    stdout:""
    stderr:""


  constructor:(@rc)->
    expect(@rc.port).to.be.a 'number'


    unless @rc.packages
      log.error "no packages to test have been specified"


  run: =>
    log.info("spawning meteor")
    expect(@childProcess).to.be.null
    #meteor --settings $METEOR_TEST_SETTINGS_PATH test-packages packages/lavaina-base --driver-package test-in-console -p $PORT
    args = [
      "-p"
      @rc.port
      "test-packages"
      @rc.packages
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

    @childProcess = new ChildProcess()
    @childProcess.spawn("meteor",args,options)
    
    @childProcess.child.stdout.on "data", (data) =>
      @buffer.stdout += data
      @hasErrorText @buffer.stdout
      @hasReadyText @buffer.stdout

    @childProcess.child.stderr.on "data", (data) =>
      @buffer.stderr += data
      @hasErrorText @buffer.stderr



  hasErrorText: ( buffer )=>
    log.debug buffer.lastIndexOf( @rc.meteor_error_text )
    if buffer.lastIndexOf( @rc.meteor_error_text ) isnt -1
      @emit "error"


  hasReadyText: ( buffer )=>
    log.debug "hasReadyText"
    if buffer.lastIndexOf( @rc.meteor_ready_text ) isnt -1
      @emit "ready"

  kill:->
    @childProcess?.child?.kill()


module.exports = Meteor

