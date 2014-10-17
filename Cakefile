ChildProcess = require './src/ChildProcess'

mochaCmdLine = "mocha --colors --compilers coffee:coffee-script/register --reporter spec tests/*Test.coffee"

task "compile", "Compile coffee-script library sources", ->
  child = new ChildProcess()
  child.exec "coffee -o lib -c src", "coffee"


task "test", "Run tests", ->
  child = new ChildProcess()
  child.exec mochaCmdLine, "mocha"


task "test-wait", "Run tests and wait for file changes", ->
  child = new ChildProcess()
  child.exec mochaCmdLine + " -w", "mocha"
