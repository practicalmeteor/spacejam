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
    args = [
      "--app"
      "tests/leaderboard/"
      "--packages"
      "success"
      "--settings"
      "settings.json"
      "--timeout"
      "10000"
      "--port"
      "7040"
      "--log_level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Run with a failing test", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app"
      "tests/leaderboard/"
      "--packages"
      "failure"
      "--timeout"
      "10000"
      "--port"
      "7050"
      "--log_level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 2 # test failed
      done()


  it "Run with a test that never ends", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app"
      "tests/leaderboard/"
      "--packages"
      "timeout"
      "--timeout"
      "10000"
      "--port"
      "7060"
      "--log_level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 4 # test timed-out
      done()


  it "Send more than one package (With * wildcard)", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app"
      "tests/leaderboard/"
      "--packages"
      "success*"
      "--settings"
      "settings.json"
      "--timeout"
      "10000"
      "--port"
      "7080"
      "--log_level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Send more than one package (separated by an space)", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app"
      "tests/leaderboard/"
      "--packages"
      "success success2"
      "--settings"
      "settings.json"
      "--timeout"
      "10000"
      "--port"
      "7080"
      "--log_level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Run with a failing meteor app", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app"
      "tests/todos/"
      "--packages"
      "appfails"
      "--timeout"
      "10000"
      "--port"
      "7070"
      "--log_level"
      "debug"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 3 # meteor app has errors
      done()