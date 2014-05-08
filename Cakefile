require 'coffee-script/register'
ChildProcess = require "./src/ChildProcess"
global.log = require("loglevel")

task "compile", "Compile library", ->
  child = new ChildProcess()
  child.exec "coffee -o lib -c src/*.coffee", "compile"


task "test", "Run unit tests", ->
  child = new ChildProcess()
  child.exec "mocha --colors --compilers coffee:coffee-script  --reporter spec tests/*Test.coffee", "test"