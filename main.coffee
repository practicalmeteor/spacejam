appname = "mctr" # meteor console test runner
log = require('loglevel')
spawn = require('child_process').spawn
Meteor = require("./Meteor")


rc = require('rc')(appname, {
    #defaults go here.
    log_level:"debug"
    port:4096
    root_url:"http://localhost:3000"
    app_path:null
    settings_path:"settings.json"
    timeout:120000 # 2 minutes
    packages:null
  })

log.setLevel(rc.log_level)

meteor = new Meteor(rc,log)


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
