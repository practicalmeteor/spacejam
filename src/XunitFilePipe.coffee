fs = Npm.require('fs')

class practical.spacejam.XunitFilePipe extends practical.spacejam.Pipe

  constructor: (@stdout, @stderr, @options)->
    @stdout.setEncoding "utf8"
    @stderr.setEncoding "utf8"

    outputFile = @options.pipeToFile
    outputStream = fs.createWriteStream(outputFile, {
      flags: 'w'
      encoding: 'utf8'
    })

    @stdoutBuffer = ''

    @stdout.on "data", (data)=>
      @stdoutBuffer += data
      lines = @stdoutBuffer.split('\n')
      return if lines.length is 1 # No complete lines received yet
      @stdoutBuffer = lines.pop() # Save last incomplete line in stdout buffer
      for line in lines
        if line.indexOf('##_meteor_magic##xunit: ') is 0
          outputStream.write line.substr(24) + '\n'
        else
          process.stdout.write line + '\n'

    @stderr.on "data", (data)=>
      process.stderr.write data

