global.log = require('loglevel')

logLevelOpts = require("rc")("spacejam",{
  "log-level" : "info"
})
log.setLevel logLevelOpts["log-level"]
