ChildProcess = require './src/ChildProcess'

jsMochaCmdLine = "mocha --colors --reporter spec tests/lib/*Test*.js"

mochaCmdLine = "mocha --colors --compilers coffee:coffee-script/register --reporter spec tests/src/*Test*.coffee"

task "compile", "Compile coffee-script library sources", ->
  child = new ChildProcess()
  child.exec "coffee -o lib -c src"
  child = new ChildProcess()
  child.exec "coffee -o tests/lib -c tests/src"


task "test", "Run tests", ->
  invoke 'compile'
  child = new ChildProcess()
  child.exec mochaCmdLine


task "test-js", "Run tests", ->
  invoke 'compile'
  child = new ChildProcess()
  child.exec jsMochaCmdLine


task "test-wait", "Run tests and wait for file changes", ->
  invoke 'compile'
  child = new ChildProcess()
  child.exec mochaCmdLine + " -w"
