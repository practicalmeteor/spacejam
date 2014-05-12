ChildProcess = require '../src/ChildProcess'
expect = require("chai").expect
global.log = require('loglevel')
log.setLevel "debug"

describe "MCTR Test", ->
  @timeout 30000
  mctrChild = new ChildProcess()

  afterEach ->
    mctrChild.kill()

  it "Run with a successful test and a settings file", (done)->
    testPort = "7040"
    args = [
      "test-packages"
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
    mctrChild.spawn("bin/spacejam",args)
    mctrChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Run with a failing test", (done)->
    mctrChild = new ChildProcess()
    testPort = "7050"
    args = [
      "test-packages"
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
    mctrChild.spawn("bin/spacejam",args)
    mctrChild.child.on "exit", (code) =>
      expect(code).to.equal 2 # test failed
      done()


  it "Run with a test that never ends", (done)->
    mctrChild = new ChildProcess()
    testPort = "7060"
    args = [
      "test-packages"
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
    mctrChild.spawn("bin/spacejam",args)
    mctrChild.child.on "exit", (code) =>
      expect(code).to.equal 4 # test timed-out
      done()


  it "Send more than one package (With * wildcard)", (done)->
    mctrChild = new ChildProcess()
    testPort = "7070"
    args = [
      "test-packages"
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
    mctrChild.spawn("bin/spacejam",args)
    mctrChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Send more than one package (separated by an space)", (done)->
    mctrChild = new ChildProcess()
    testPort = "7080"
    args = [
      "test-packages"
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
    mctrChild.spawn("bin/spacejam",args)
    mctrChild.child.on "exit", (code) =>
      expect(code).to.equal 0 # test succeeded
      done()

  it "Run with a failing meteor app", (done)->
    mctrChild = new ChildProcess()
    testPort = "7090"
    args = [
      "test-packages"
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
    mctrChild.spawn("bin/spacejam",args)
    mctrChild.child.on "exit", (code) =>
      expect(code).to.equal 3 # meteor app has errors
      done()