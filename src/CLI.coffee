require './log'
fs = require("fs")
path = require("path")
_ = require("underscore")
expect = require("chai").expect
Spacejam = require './Spacejam'
Meteor = require './Meteor'

require.extensions['.txt'] = (module, filename)->
  module.exports = fs.readFileSync(filename, 'utf8')


class CLI

  instance = null

  @get: ->
    instance ?= new CLI()

  commands: {
    "test-packages" : "testPackages"
    "test-in-velocity" : "testInVelocity"
  }
  
  options: null

  spacejam: null

  pidPath: null

  constructor: ->
    @spacejam = new Spacejam()
    log.debug "CLI.constructor()"
    process.on 'SIGPIPE', (code)=>
      log.info "spacejam: Received a SIGPIPE signal. Killing all child processes..."
      @spacejam?.killChildren()
#
#    process.on 'SIGINT', (code)=>
#      log.info "spacejam: exiting with code #{code}"
#      @spacejam?.killChildren()

  # If the pid-file exists and the process is alive, exit with 1.
  # Otherwise, create the pid-file and write our pid into it and return to continue normal startup.
  pidFileInit: (pidFile)->
    log.debug "CLI.checkAndCreatePidFile()", arguments
    expect(pidFile).to.be.a('string').that.has.length.above(0)
    pidPath = path.resolve(pidFile)
    if fs.existsSync(pidPath)
      pid = +fs.readFileSync(pidPath)
      log.info "spacejam: Found pid file #{pidFile} with pid #{pid}, checking if process is alive."
      try
        # Check for the existence of the process without killing it, by sending signal 0.
        process.kill(pid, 0)
        # process is alive, otherwise an exception would have been thrown, so we need to exit.
        log.warn "spacejam: process with pid #{pid} is already running, exiting."
        process.exit(Spacejam.DONE.ALREADY_RUNNING)
      catch err
        log.trace err
        log.warn "spacejam: pid file #{pidFile} exists, but process is dead, ignoring it."

    log.info "spacejam: Saving pid #{process.pid} to #{pidPath}"
    fs.writeFileSync(pidPath, "#{process.pid}")
    @pidPath = pidPath
    process.on 'exit', @onProcessExit
    return


  onProcessExit: (code)=>
    log.info "spacejam: spacejam is exiting with code #{code}, deleting pid file."
    try
      fs.unlinkSync(@pidPath)
    catch err
      log.trace err
      log.error("spacejam: Error deleting pid file #{@pidPath}", err)


  exec: ->
    log.debug "CLI.exec()"
    expect(@options, "You can only call CLI.exec() once").to.be.null

    @options = require("rc")("spacejam", {})

    @pidFileInit(@options['pid-file']) if @options['pid-file']?

    command = @options._[0]
    log.debug "command: #{command}"
    if command is 'help'
      @printHelp()
      process.exit(0)
    else if command is 'package-version'
      version = Meteor.getPackageVersion()
      console.log(version)
      process.exit(0)

    if not _.has(@commands, command)
      log.error "spacejam: Error: \n'#{command}' is not a recognized command\n" if command
      @printHelp()

    @options.packages = @options._.slice(1)
    delete @options._

    log.debug "CLI.exec() options:", @options

    @spacejam.on 'done', (code)=>
      process.exit code

    try
      @spacejam[@commands[command]](@options)
    catch err
      console.trace err
      process.exit 1



  printHelp: ->
    log.debug "CLI.printHelp()"
    process.stdout.write require('../bin/help.txt')


module.exports = CLI
