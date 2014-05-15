global.log = require("loglevel")
ChildProcess = require '../src/ChildProcess'
SpaceJam = require '../src/SpaceJam'
expect = require("chai").expect

describe "SpaceJam Test", ->
  @timeout 30000

  spacejamChild = new ChildProcess()

#  before ->
#    delete process.env.PORT
#    delete process.env.ROOT_URL
#    delete process.env.MONGO_URL


  afterEach ->
    spacejamChild?.kill()

  it "Run with a successful test and a settings file", (done)->
    testPort = "7040"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
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
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Run with a failing test", (done)->
    spacejamChild = new ChildProcess()
    testPort = "7050"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "failure"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.TEST_FAILED
      done()



  it "Run with a test that never ends", (done)->
    spacejamChild = new ChildProcess()
    testPort = "7060"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "timeout"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.TEST_TIMEOUT
      done()



  it "Send more than one package (With * wildcard)", (done)->
    spacejamChild = new ChildProcess()
    testPort = "7070"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
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
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Send more than one package (separated by an space)", (done)->
    spacejamChild = new ChildProcess()
    testPort = "7080"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "success"
      "success2"
      "--settings"
      "settings.json"
      "--timeout"
      "10000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Run with a failing meteor app", (done)->
    spacejamChild = new ChildProcess()
    testPort = "7090"
    args = [
      "test-packages"
      "--app"
      "tests/todos/"
      "--root-url"
      "http://localhost:#{testPort}/"
      "appfails"
      "--timeout"
      "30000"
      "--port"
      testPort
      "--log-level"
      "debug"
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.METEOR_ERROR
      done()
