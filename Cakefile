ChildProcess = require './src/ChildProcess'

mochaCmdLine = "mocha --colors --compilers coffee:coffee-script --reporter spec tests/*Test.coffee"

task "compile", "Compile coffee-script library sources", ->
  child = exec "coffee -o lib -c src/*.coffee"
  console.log child.pid


task "test", "Run tests", ->
  childProcess = new ChildProcess()
  childProcess.exec mochaCmdLine, "mocha"
  console.log "mocha pid: " + childProcess.child.pid


task "test-wait", "Run tests and wait for file changes", ->
  childProcess = new ChildProcess()
  childProcess.exec mochaCmdLine + " -w", "mocha"
  console.log "mocha pid: " + childProcess.child.pid
