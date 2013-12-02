testRunner = require './TestRunner'

testRunner.run()

#log.debug(rc)
#
##sleep = spawn("sleep",['3'])
##sleep.on "exit", (code)->
##  log.info("sleep exited with code: ",code)
#
#ls    = spawn('ls', ['-lh', '/usr']);
#buffer = ""
#
#ls.stdout.on "data", (data) ->
#  buffer += data
##  console.log "stdout: " + data
#
#ls.stderr.on "data", (data) ->
#  console.log "stderr: " + data
#
#ls.on "close", (code) ->
#  console.log(buffer)
#  console.log "child process exited with code " + code
#

#process.on 'exit', ->
#  console.log('Process terminated')
