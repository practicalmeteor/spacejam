expect = require("chai").expect
ChildProcess = require '../src/ChildProcess'
SpaceJam = require '../src/SpaceJam'

describe "SpaceJam Test", ->
  @timeout 40000

  spacejamChild = new ChildProcess()

  before ->
    log.setLevel "debug"
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL


  afterEach ->
    spacejamChild?.kill()


  it "Run with with default options and no env", (done)->
    @timeout 30000
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "success"
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()

  it "Run with a successful test and a settings file", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7040"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "settings"
      "--settings"
      "settings.json"
      "--port"
      testPort
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Run with a failing test", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7050"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "failure"
      "--port"
      testPort
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_FAILED
      done()



  it "Run with a test that never ends", (done)->
    @timeout 15000
    spacejamChild = new ChildProcess()
    testPort = "7060"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "timeout"
      "--timeout"
      "10000"
      "--port"
      testPort
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_TIMEOUT
      done()



  it "Send more than one package (With * wildcard)", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7070"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "success*"
      "--settings"
      "settings.json"
      "--port"
      testPort
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Send more than one package (separated by an space)", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7080"
    args = [
      "test-packages"
      "--app"
      "tests/leaderboard/"
      "success"
      "settings"
      "--settings"
      "settings.json"
      "--port"
      testPort
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Run with a failing meteor app", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7090"
    args = [
      "test-packages"
      "--app"
      "tests/todos/"
      "appfails"
      "--port"
      testPort
    ]
    spacejamChild.spawn("bin/spacejam",args)
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.METEOR_ERROR
      done()
