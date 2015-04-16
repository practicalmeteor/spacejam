fs = require('fs')
Pipe = require("./Pipe")

class XunitFilePipe extends Pipe
  constructor: (@stdout, @stderr, @options)->
    @stdout.setEncoding "utf8"
    @stderr.setEncoding "utf8"

    outputFile = @options.pipeToFile
    outputStream = fs.createWriteStream(outputFile, {
      flags: 'w'
      encoding: 'utf8'
    })
    meteorMagicStatePattern = /^##_meteor_magic##state:.*$/gm
    meteorMagicXunitPattern = /^##_meteor_magic##xunit: (.*)$/gm

    @stdout.on "data", (data)=>
      dataWithoutState = data

      stateMatch = data.match(meteorMagicStatePattern)
      if stateMatch
        dataWithoutState = data.replace(meteorMagicStatePattern, '')
        stateMatch.forEach (stateMessage) ->
          process.stderr.write stateMessage + '\n'

      found = dataWithoutState.match(meteorMagicXunitPattern)
      if found
        found.forEach (matched) ->
          xmlOnly = matched.replace(meteorMagicXunitPattern, '$1')
          outputStream.write xmlOnly
      else
        process.stderr.write data

    @stderr.on "data", (data)=>
      process.stderr.write data

module.exports = XunitFilePipe
