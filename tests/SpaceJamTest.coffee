expect = require("chai").expect
ChildProcess = require '../src/ChildProcess'
SpaceJam = require '../src/SpaceJam'

path = require 'path'
spacejamBin = require.resolve("../bin/spacejam.coffee")
log.info spacejamBin


describe "spacejam test-packages", ->
  @timeout 60000

  spacejamChild = null

  testApp1 = "leaderboard"

  testApp2 = "todos"

  standAlonePackage = "packages/standalone-package"



  before ->
    log.setLevel "info"

  beforeEach ->
    process.chdir(__dirname + "/leaderboard")
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.PACKAGE_DIRS

    spacejamChild = new ChildProcess()



  afterEach ->
    try
      spacejamChild?.kill()
    finally
      spacejamChild = null


  it "should exit with 0 if tests pass for a meteor app package", (done)->
    spacejamChild = new ChildProcess()
    args = ["test-packages", "success"]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()


  it "should exit with 0 if tests pass for a standalone package", (done)->
    process.chdir(__dirname + "/standalone-package")
    process.env.PACKAGE_DIRS = __dirname
    spacejamChild = new ChildProcess()
    args = ["test-packages", "./"]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()


  it "should exit with 1, if not in a meteor app or package folder", (done)->
    process.chdir(__dirname)
    spacejamChild = new ChildProcess()
    args = ["test-packages", "success"]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal 1
      done()


  it "should exit with 3, if package could not be found", (done)->
    spacejamChild = new ChildProcess()
    args = ["test-packages", standAlonePackage]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.METEOR_ERROR
      done()


  it "should exit with 2, if tests failed", (done)->
    spacejamChild = new ChildProcess()
    testPort = "6096"
    args = ["test-packages", "--port", testPort, "failure"]
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_FAILED
      done()


  it "should exit with 4, if --timeout has passed", (done)->
    spacejamChild = new ChildProcess()
    testPort = "7096"
    args = ["test-packages", "--timeout", "10000", "--port", testPort, 'timeout']
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with the wrong code").to.equal SpaceJam.ERR_CODE.TEST_TIMEOUT
      done()


  it "should exit with 2, if the meteor app crashes", (done)->
    process.chdir(__dirname + "/todos")
    spacejamChild = new ChildProcess()
    testPort = "8096"
    args = ["test-packages", "--port", testPort, 'appfails']
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code).to.equal SpaceJam.ERR_CODE.METEOR_ERROR
      done()


  it "should exit with 0, in case of a complete test, with a settings file, multiple packages, including wildcards in package names", (done)->
    spacejamChild = new ChildProcess()
    testPort = "10096"
    args = ["test-packages", "--settings", "settings.json", "--port", testPort, 'packages/settings', 'success*']
    spacejamChild.spawn(spacejamBin,args)
    spacejamChild.child.on "exit", (code) =>
      expect(code,"spacejam exited with errors").to.equal SpaceJam.ERR_CODE.TEST_SUCCESS
      done()
