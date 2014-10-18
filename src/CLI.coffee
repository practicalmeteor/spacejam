fs = require("fs")
_ = require("underscore")
SpaceJam = require './SpaceJam'

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

  spacejam: null

  constructor: ->
    log.debug "CLI.constructor()"
    process.on 'SIGTERM', (code)=>
      log.info "spacejam: exiting with code #{code}"
      @spacejam?.killChildren()

  exec: ->
    log.debug "CLI.exec()"

    opts = require("rc")("spacejam", {})

    command = opts._[0]
    log.debug "command: #{command}"
    if command is 'help'
      @printHelp()
      return

    if not _.has(@commands, command)
      log.error "spacejam: Error: \n'#{command}' is not a recognized command\n" if command
      @printHelp()

    @spacejam = new SpaceJam()
    @spacejam.on 'done', (code)=>
      process.exit code

    try
      @spacejam[@commands[command]](opts)
    catch err
      console.trace err
      process.exit 1



  printHelp: ->
    log.debug "CLI.printHelp()"
    process.stdout.write require('../bin/help.txt')


module.exports = CLI.get()
