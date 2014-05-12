require 'coffee-script/register'
ChildProcess = require "./src/ChildProcess"

task "compile", "Compile library", ->
  child = new ChildProcess()
  child.spawn "coffee -o lib -c src/*.coffee"


task "test", "Run unit tests", ->
  child = new ChildProcess()
  child.exec  "mocha --colors --compilers coffee:coffee-script --reporter spec tests/*Test.coffee", "test"