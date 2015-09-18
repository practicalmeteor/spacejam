fs = Npm.require("fs")
path = Npm.require("path")


class SpacejamCommand

  instance = null

  @get: ->
    instance ?= new SpacejamCommand()

  commands: {
    "test-packages" : "testPackages"
  }

  options: null

  spacejam: null

  pidPath: null

  constructor: ->
    CLI.registerCommand("spacejam", @exec, {}, true)

    @spacejam = new practical.spacejam.Spacejam()
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


  exec: (options)=>
    log.debug "CLI.exec()"
    expect(@options, "You can only call CLI.exec() once").to.be.null

    @options = options

    command = @options._[0]
    log.debug "command: #{command}"
    if command is 'help'
      @printHelp()
      process.exit(0)
    else if command is 'package-version'
      version = practical.spacejam.Meteor.getPackageVersion()
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
      console.log(@commands[command])
      @spacejam[@commands[command]](@options)
    catch err
      console.trace err
      process.exit 1



  printHelp: ->
    log.debug "CLI.printHelp()"
    helpPath = path.resolve(__meteor_bootstrap__.serverDir, "assets/packages/practicalmeteor_spacejam/bin/help.txt")
    process.stdout.write fs.readFileSync(helpPath, 'utf8')

SpacejamCommand.get()