global.log = require('loglevel')

logLevelOpts = require("rc")("spacejam",{
  "log-level" : "debug"
})
log.setLevel logLevelOpts["log-level"]

log.info "log-level=" + logLevelOpts["log-level"]
