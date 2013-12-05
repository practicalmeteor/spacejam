ChildProcess = require '../src/ChildProcess'
expect = require("chai").expect
log = require('loglevel')
log.setLevel "debug"
describe "TestRunner Test", ->
  @timeout 30000
  testRunnerChild = new ChildProcess()

  afterEach ->
    testRunnerChild.kill()

  it "Test run with a successful test", (done)->
    args = [
      "--app_path"
      "tests/leaderboard/"
      "--packages"
      "success"
      "--timeout"
      "5000"
      "--port"
      "7040"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 4 # test succeeded
      done()

  it "Test run with a failing test", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app_path"
      "tests/leaderboard/"
      "--packages"
      "failure"
      "--timeout"
      "5000"
      "--port"
      "7050"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 5 # test failed
      done()


  it "Test run with a test that never ends", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app_path"
      "tests/leaderboard/"
      "--packages"
      "timeout"
      "--timeout"
      "5000"
      "--port"
      "7060"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 6 # test timed-out
      done()


  it "Test run with more than one package", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app_path"
      "tests/leaderboard/"
      "--packages"
      "success"
      "success2"
      "--timeout"
      "5000"
      "--port"
      "7080"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 4 # test succeeded
      done()

  it "Test run with a failing meteor app", (done)->
    testRunnerChild = new ChildProcess()
    args = [
      "--app_path"
      "tests/todos/"
      "--packages"
      "appfails"
      "--timeout"
      "10000"
      "--port"
      "7070"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 2 # meteor app has errors
      done()