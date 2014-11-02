global.log = require('loglevel')

logLevelOpts = require("rc")("spacejam",{
  "log-level" : "info"
})

#originalFactory = log.methodFactory
#
#log.methodFactory = (methodName, logLevel)=>
#  console.error 'loglevel=', level
#  rawMethod = originalFactory(methodName, level)
#  return (message)=>
#    rawMethod("spacejam: " + message)
#
log.setLevel logLevelOpts["log-level"]
