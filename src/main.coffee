global.log = require("loglevel")
log.setLevel("debug")

meteorWrapper = require './MeteorWrapper'

meteorWrapper.exec()