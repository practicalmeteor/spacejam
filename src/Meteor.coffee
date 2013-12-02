expect = require('chai').expect
spawn = require('child_process').spawn
EventEmitter = require('events').EventEmitter

class Meteor extends EventEmitter

  runCalled: false

  child:{}
  buffer:
    stdout:""
    stderr:""


  constructor:(@rc)->
    expect(@rc.port).to.be.a 'number'
    if @rc.root_url is null
      @rc.root_url = "http://localhost:#{@rc.port}/"

    unless @rc.packages
      log.error "no packages to test have been specified"


  run: =>
    log.info("spawning meteor")
    expect(@runCalled).to.be.false
    @runCalled = true
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

    @child = spawn("meteor",args,options)
    @child.stdout.setEncoding('utf8');
    @child.stderr.setEncoding('utf8');
    
    @child.stdout.on "data", (data) =>
      @buffer.stdout += data
      log.info data
      @hasErrorText @buffer.stdout


    @child.stderr.on "data", (data) =>
      @buffer.stderr += data
      log.error data
      @hasErrorText @buffer.stderr

    @child.on "exit", (code,signal) =>
      if code?
        log.info "Meteor exited with code: " + code
      else if signal?
        log.info "Meteor killed with signal: " + signal
      else
        log.error "Meteor exited: " + args



  hasErrorText: ( buffer )->
    if buffer.lastIndexOf( @rc.meteor_error_text ) isnt -1
      @emit "error"


  hasReadyText: ( buffer )->
    if buffer.lastIndexOf( @rc.meteor_ready_text ) isnt -1
      @emit "ready"


module.exports = Meteor

