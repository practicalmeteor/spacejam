ChildProcess = require './lib/ChildProcess'

mochaCmdLine = "mocha --colors --compilers coffee:coffee-script/register --reporter spec tests/lib/*Test.coffee"

task "compile", "Compile coffee-script library sources", ->
  child = new ChildProcess()
  child.exec "coffee -o lib -c lib"
  child = new ChildProcess()
  child.exec "coffee -o tests/lib -c tests/lib"


task "test", "Run tests", ->
  child = new ChildProcess()
  child.exec mochaCmdLine


task "test-wait", "Run tests and wait for file changes", ->
  invoke 'compile'
  child = new ChildProcess()
  child.exec mochaCmdLine + " -w"
