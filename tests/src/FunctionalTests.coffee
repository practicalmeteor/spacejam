expect = require("chai").expect
isCoffee = require './isCoffee'
if isCoffee
  CLI = require '../../src/CLI'
  ChildProcess = require '../../src/ChildProcess'
  Spacejam = require '../../src/Spacejam'
else
  CLI = require '../../lib/CLI'
  ChildProcess = require '../../lib/ChildProcess'
  Spacejam = require '../../lib/Spacejam'
path = require 'path'
if isCoffee
  spacejamBin = require.resolve("../../bin/spacejam.coffee")
else
  spacejamBin = require.resolve("../../bin/spacejam")
log.info spacejamBin


describe "spacejam", ->
  @timeout 60000

  spacejamChild = null

  spacejamChild2 = null

  testApp1 = "leaderboard"

  testApp2 = "todos"

  standAlonePackage = "../packages/standalone-package"

  before ->
    log.debug "spacejam.before"

  beforeEach ->
    log.debug "spacejam.beforeEach"
    process.chdir(__dirname + "/../apps/leaderboard")
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.PACKAGE_DIRS

    spacejamChild = new ChildProcess()

  afterEach ->
    log.debug "spacejam.afterEach"
    try
      spacejamChild?.kill('SIGPIPE')
    finally
      spacejamChild = null

    try
      spacejamChild2?.kill('SIGPIPE')
    finally
      spacejamChild2 = null

  describe "test-packages", ->

    it "should exit with 0 if tests pass for a meteor app package", (done)->
      spacejamChild = new ChildProcess()
      args = ["test-packages", "success"]
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        expect(code,"spacejam exited with errors").to.equal Spacejam.DONE.TEST_SUCCESS
        done()


    it "should exit with 0 if tests pass for a standalone package", (done)->
      process.chdir(__dirname + "/../packages/standalone-package")
      process.env.PACKAGE_DIRS = path.normalize __dirname + '/../packages'
      spacejamChild = new ChildProcess()
      args = ["test-packages", "./"]
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        expect(code,"spacejam exited with errors").to.equal Spacejam.DONE.TEST_SUCCESS
        done()

    it "should execute multiple independent package tests provided by path while not in a meteor app or package folder", (done)->
      process.chdir(path.resolve(__dirname, ".."))
      spacejamChild = new ChildProcess()
      args = ["test-packages", "packages/standalone-package-dep", 'apps/leaderboard/packages/success']
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        try
          expect(code,"spacejam exited with errors").to.equal Spacejam.DONE.TEST_SUCCESS
          done()
        catch err
          done(err)

    it "should exit with 3, if meteor couldn't find package", (done)->
      process.chdir(__dirname)
      spacejamChild = new ChildProcess()
      args = ["test-packages", "success"]
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        expect(code,"spacejam exited with the wrong code").to.equal Spacejam.DONE.METEOR_ERROR
        done()


    it "should exit with 3, if package could not be found", (done)->
      spacejamChild = new ChildProcess()
      args = ["test-packages", standAlonePackage]
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        expect(code,"spacejam exited with errors").to.equal Spacejam.DONE.METEOR_ERROR
        done()


    it "should exit with 2, if tests failed", (done)->
      spacejamChild = new ChildProcess()
      testPort = "6096"
      args = ["test-packages", "--port", testPort, "failure"]
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        expect(code,"spacejam exited with the wrong code").to.equal Spacejam.DONE.TEST_FAILED
        done()


    it "should exit with 4, if --timeout has passed", (done)->
      spacejamChild = new ChildProcess()
      testPort = "7096"
      args = ["test-packages", "--timeout", "30000", "--port", testPort, 'timeout']
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        expect(code,"spacejam exited with the wrong code").to.equal Spacejam.DONE.TEST_TIMEOUT
        done()


    it "should exit with 2, if the meteor app crashes", (done)->
      @timeout 90000
      process.chdir(__dirname + "/../apps/todos")
      spacejamChild = new ChildProcess()
      testPort = "8096"
      args = ["test-packages", "--port", testPort, 'appfails']
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        expect(code).to.equal Spacejam.DONE.METEOR_ERROR
        done()


    it "should exit with 0, in case of a complete test, with a settings file, multiple packages, including wildcards in package names", (done)->
      spacejamChild = new ChildProcess()
      testPort = "10096"
      args = ["test-packages", "--settings", "settings.json", "--port", testPort, 'packages/settings', 'success*']
      spacejamChild.spawn(spacejamBin,args)
      spacejamChild.child.on "exit", (code) =>
        expect(code,"spacejam exited with errors").to.equal Spacejam.DONE.TEST_SUCCESS
        done()

  describe "package-version", ->

    it "should print the package version", (done)->
      process.chdir(__dirname + "/../packages/standalone-package")
      spacejamChild = new ChildProcess()
      spacejamChild.exec "#{spacejamBin} package-version", null, (err, stdout, stderr)=>
        try
          expect(err).to.be.null
          expect(stdout.toString()).to.contain '0.9.5'
          done()
        catch err
          done(err)
