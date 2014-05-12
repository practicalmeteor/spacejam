global.log = require("loglevel")
log.setLevel("debug")

meteorWrapper = require './SpaceJam'

meteorWrapper.exec()