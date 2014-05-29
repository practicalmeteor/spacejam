expect = require("chai").expect
ChildProcess = require '../src/ChildProcess'
SpaceJam = require '../src/SpaceJam'

path = require 'path'
spacejamBin = require.resolve("../bin/spacejam")
log.info spacejamBin


describe "SpaceJam Test", ->
  @timeout 40000

  spacejamChild = new ChildProcess()

  testApp1 = "tests/leaderboard/"

  testApp2 = "tests/todos/"

  standAlonePackage = "tests/standalone-package"



  before ->
    log.setLevel "debug"
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.PACKAGE_DIRS


  afterEach ->
    spacejamChild?.kill()


  it "Run with with default options and no env, outside a Meteor app", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    args = [
      "test-packages"
      "success"
    ]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal 1
      done()



  it "Run with with default options and no env, outside a Meteor app with --app arg", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    args = [
      "test-packages"
      "success"
      "--app"
      testApp1
    ]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Run with with an standalone packages as option (fails if deps are not found)", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    args = [
      "test-packages"
      standAlonePackage
    ]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.METEOR_ERROR
      done()



  it "Run with with an standalone packages as option", (done)->
    @timeout 30000
    process.env.PACKAGE_DIRS = __dirname
    spacejamChild = new ChildProcess()
    args = [
      "test-packages"
      standAlonePackage
    ]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Run with with default options and no env, inside a Meteor app", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    args = [
      "test-packages"
      "success"
    ]
    spacejamChild.spawn(spacejamBin,args,{cwd:testApp1})
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()


  it "Run with a successful test and a settings file", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7040"
    args = [
      "test-packages"
      "settings"
      "--settings"
      "settings.json"
      "--port"
      testPort
    ]
    spacejamChild.spawn(spacejamBin,args,{cwd:testApp1})
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Run with a failing test", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7050"
    args = [
      "test-packages"
      "failure"
      "--port"
      testPort
    ]
    spacejamChild.spawn(spacejamBin,args,{cwd:testApp1})
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_FAILED
      done()



  it "Run with a test that never ends", (done)->
    @timeout 15000
    spacejamChild = new ChildProcess()
    testPort = "7060"
    args = [
      "test-packages"
      "timeout"
      "--timeout"
      "10000"
      "--port"
      testPort
    ]
    spacejamChild.spawn(spacejamBin,args,{cwd:testApp1})
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_TIMEOUT
      done()



  it "Send more than one package (With * wildcard)", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7070"
    args = [
      "test-packages"
      "success*"
      "--settings"
      "settings.json"
      "--port"
      testPort
    ]
    spacejamChild.spawn(spacejamBin,args,{cwd:testApp1})
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Send more than one package (separated by an space)", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7080"
    args = [
      "test-packages"
      "success"
      "settings"
      "--settings"
      "settings.json"
      "--port"
      testPort
    ]
    spacejamChild.spawn(spacejamBin,args,{cwd:testApp1})
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()



  it "Run with a failing meteor app", (done)->
    @timeout 30000
    spacejamChild = new ChildProcess()
    testPort = "7090"
    args = [
      "test-packages"
      "appfails"
      "--port"
      testPort
    ]
    spacejamChild.spawn(spacejamBin,args,{cwd:testApp2})
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.METEOR_ERROR
      done()
