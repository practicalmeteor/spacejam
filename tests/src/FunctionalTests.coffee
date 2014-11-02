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
      spacejamChild2?.kill('SIGPIPE')
    finally
      spacejamChild = null

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

  describe "test-in-velocity", ->

    it "should never exit", (done)->
      process.env.PACKAGE_DIRS = path.normalize __dirname + '/../../packages'
      log.debug "PACKAGE_DIRS=#{process.env.PACKAGE_DIRS}"
      spacejamChild = new ChildProcess()
      testPort = "11096"
      args = ["test-in-velocity", "--port", testPort, 'success']
      spacejamChild.spawn(spacejamBin,args)

      onExit = (code) =>
        clearTimeout(timeoutId)
        done("spacejam test-in-velocity should never exit")
      spacejamChild.child.on "exit", onExit

      timeoutId = setTimeout =>
        try
          spacejamChild.child.removeListener 'exit', onExit
          spacejamChild.kill('SIGPIPE')
          done()
        catch err
          done(err)
      , 45000

  describe "package-version", ->

    it "should print the package version", (done)->

      process.chdir(__dirname + "/../packages/standalone-package")
      log.info(process.cwd())
      spacejamChild = new ChildProcess()
      spacejamChild.exec "#{spacejamBin} package-version", 'spacejam', (err, stdout, stderr)=>
        try
          expect(err).to.be.null
          expect(stdout.toString()).to.contain '0.9.5'
          done()
        catch err
          done(err)

#    it "should create a pid-file or exit if it already exists and pid is running", (done)->
#      process.env.PACKAGE_DIRS = path.normalize __dirname + '/../../packages'
#      log.debug "PACKAGE_DIRS=#{process.env.PACKAGE_DIRS}"
#      spacejamChild = new ChildProcess()
#      testPort = "12096"
#      args = ["test-in-velocity", "--pid-file", 'test.pid', "--port", testPort, 'success']
#      spacejamChild.spawn(spacejamBin,args)
#
#      spacejamChild.child.on "exit", (code) =>
#        done("1st spacejam should never exit")
#
#      setTimeout ->
#        spacejamChild2 = new ChildProcess()
#        spacejamChild2.spawn(spacejamBin,args)
#        spacejamChild2.child.on "exit", (code) =>
#          try
#            expect(code).to.equal Spacejam.DONE.ALREADY_RUNNING
#            done()
#          catch err
#            done(err)
#        setTimeout ->
#          try
#            done("2nd spacejam should already have exited")
#          catch
#        , 5000
#      , 5000
