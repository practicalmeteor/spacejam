ChildProcess = require '../src/ChildProcess'
expect = require("chai").expect
log = require('loglevel')
log.setLevel "debug"
describe "TestRunner Test", ->
  @timeout 30000
  testRunnerChild = new ChildProcess()

  afterEach ->
    testRunnerChild.kill()

  it "Run with a successful test and a settings file", (done)->
    testPort = "7040"
    args = [
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "--packages"
      "success"
      "--settings"
      "settings.json"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Run with a failing test", (done)->
    testRunnerChild = new ChildProcess()
    testPort = "7050"
    args = [
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "--packages"
      "failure"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 2 # test failed
      done()


  it "Run with a test that never ends", (done)->
    testRunnerChild = new ChildProcess()
    testPort = "7060"
    args = [
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "--packages"
      "timeout"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 4 # test timed-out
      done()


  it "Send more than one package (With * wildcard)", (done)->
    testRunnerChild = new ChildProcess()
    testPort = "7070"
    args = [
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "--packages"
      "success*"
      "--settings"
      "settings.json"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Send more than one package (separated by an space)", (done)->
    testRunnerChild = new ChildProcess()
    testPort = "7080"
    args = [
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "--packages"
      "success success2"
      "--settings"
      "settings.json"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Run with a failing meteor app", (done)->
    testRunnerChild = new ChildProcess()
    testPort = "7090"
    args = [
      "--app"
      "tests/todos/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "--packages"
      "appfails"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 3 # meteor app has errors
      done()