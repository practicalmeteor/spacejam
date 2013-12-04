ChildProcess = require '../src/ChildProcess'
expect = require("chai").expect
log = require('loglevel')
log.setLevel "debug"
describe "TestRunner Test", ->
  @timeout 30000
  testRunnerChild = new ChildProcess()

  afterEach ->
    testRunnerChild.child.kill()

  it "Test run with a failing meteor app", (done)->
    args = [
      "--app_path"
      "tests/todos/"
      "--packages"
      ""
      "--timeout"
      "5000"
      "--port"
      "4060"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 2 # meteor app has errors
      done()

  it "Test run with a successful test", (done)->
    args = [
      "--app_path"
      "tests/leaderboard/"
      "--packages"
      "success"
      "--timeout"
      "5000"
      "--port"
      "4070"
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
      "4080"
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
      "4090"
    ]
    testRunnerChild.spawn("bin/mctr",args)
    testRunnerChild.child.on "exit", (code) =>
      expect(code).to.equal 6 # test timed-out
      done()

  after ->