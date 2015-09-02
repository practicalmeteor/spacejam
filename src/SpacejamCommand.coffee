#log = new ObjectLogger("SpacejamCommand", 'debug')

class SpacejamCommand

  instance = null

  @get:->
    instance ?= new SpacejamCommand()

  constructor: ->
    CLI.registerCommand("spacejam", @execute)
    console.log("nani?")


  execute: (options) =>
#    try
#      log.enter('execute', options)
      console.log("Yes of course!")

#    finally
#      log.return()


SpacejamCommand.get()
