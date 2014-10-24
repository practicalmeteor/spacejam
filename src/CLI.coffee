require './log'
fs = require("fs")
_ = require("underscore")
expect = require("chai").expect
Spacejam = require './Spacejam'

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

  exec: ->
    log.debug "CLI.exec()"
    expect(@options, "You can only call CLI.exec() once").to.be.null

    @options = require("rc")("spacejam", {})

    command = @options._[0]
    log.debug "command: #{command}"
    if command is 'help'
      @printHelp()
      return

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
