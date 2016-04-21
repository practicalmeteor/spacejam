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
    "test" : "testApp"
    "test-packages" : "testPackages"
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
    @options.command = command
    delete @options._

    log.debug "CLI.exec() options:", @options

    @spacejam.on 'done', (code)=>
      if Spacejam.DONE_MESSAGE[code]?
        exitMsg = "spacejam: #{Spacejam.DONE_MESSAGE[code]}. Exiting."
      else
        exitMsg = "spacejam: Unknown error with exit code '#{code}'. Exiting."
      log.error exitMsg
      process.exit code

    try
      @spacejam.runTests(command, @options)
    catch err
      console.trace err
      log.error "spacejam: Usage or initialization error. Exiting."
      process.exit 1



  printHelp: ->
    log.debug "CLI.printHelp()"
    process.stdout.write require('../bin/help.txt')


module.exports = CLI
