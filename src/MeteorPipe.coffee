Pipe = require("./Pipe")
_ = require("underscore")

class MeteorPipe extends Pipe

  @startingMongoDBText: "Starting MongoDB..."

  @startedMongoDBText: "Started MongoDB."

  #@startingMongoDBSpinner: ['-', '\\', '|', '/']

  #@startingMongoDBTexts = []
  #for spinner in MeteorPipe.startingMongoDBSpinner
  #  MeteorPipe.startingMongoDBTexts.push MeteorPipe.startingMongoDBText+spinner


  startingMongoDBTextPrinted: false
  startedMongoDBTextPrinted: false

  constructor: (@stdout,@stderr)->
    @stdout.setEncoding "utf8"
    @stderr.setEncoding "utf8"

    @stdout.on "data", (data)=>
      if not @startingMongoDBTextPrinted
        if data.indexOf MeteorPipe.startingMongoDBText >= 0
          log.debug "Found startingMongoDBText for the first time"
          log.info data
          @startingMongoDBTextPrinted = true
          return
      else if data.indexOf MeteorPipe.startingMongoDBText >= 0
        log.debug "Found startingMongoDBText again"
        return
      log.debug "Not Found startingMongoDBText, printing"
      log.info data


    @stderr.on "data", (data)=>
      log.error data

module.exports = MeteorPipe
