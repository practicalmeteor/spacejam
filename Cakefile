require 'coffee-script/register'
global.log = require('loglevel')
ChildProcess = require "./src/ChildProcess"

option '-l', '--log-level [level]', 'log level, one of TRACE|DEBUG|INFO|WARN|ERROR'

task "compile", "Compile library", ->
  child = new ChildProcess()
  child.spawn "coffee -o lib -c src/*.coffee"


task "test", "Run unit tests", (options)->
  child = new ChildProcess()
  child.exec "mocha --colors --compilers coffee:coffee-script --reporter spec tests/*Test.coffee", "test"


task "test-wait", "Run unit tests and wait for file changes", ->
  child = new ChildProcess()
  child.exec "mocha --colors --compilers coffee:coffee-script --reporter spec tests/*Test.coffee -w", "test-wait"