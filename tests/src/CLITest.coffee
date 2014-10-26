fs = require('fs')
path = require 'path'
chai = require("chai")
expect = chai.expect
sinon = require("sinon")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
isCoffee = require './isCoffee'
if isCoffee
  CLI = require '../../src/CLI'
  Spacejam = require '../../src/Spacejam'
else
  CLI = require '../../lib/CLI'
  Spacejam = require '../../lib/Spacejam'


describe "CLI", ->
  @timeout 30000

  processArgv = null

  cli = null

  testPackagesStub = null

  before ->
    processArgv = process.argv

  after ->
    process.argv = processArgv

  beforeEach ->
    process.chdir(__dirname + "/../apps/leaderboard")
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.PACKAGE_DIRS

    process.argv = ['coffee', path.normalize __dirname + "/../bin/spacejam"]
    cli = new CLI()
    spacejam = cli.spacejam
    testPackagesStub = sinon.stub(spacejam, 'testPackages')

  it "should call Spacejam.testPackages() with an empty options.packages array, if no packages where provided on the command line", ->
    process.argv.push "test-packages"
    cli.exec()
    expect(testPackagesStub).to.have.been.calledWith({packages: []})

  it "should call Spacejam.testPackages() with options.packages set to the packages provided on the command line", ->
    process.argv.push 'test-packages', '--settings', 'settings.json', 'package1', 'package2'
    cli.exec()
    expect(testPackagesStub).to.have.been.calledWith({settings: 'settings.json', packages: ['package1', 'package2']})

  describe 'pidFileInit', ->

    exitStub = null
    pidFile = pidPath = null

    beforeEach ->
      process.chdir(__dirname)
      pidFile = 'test.pid'
      pidPath = path.resolve('test.pid')
      fs.unlinkSync(pidPath) if fs.existsSync(pidFile)
      exitStub = sinon.stub(process, 'exit')

    afterEach ->
      exitStub?.restore()
      # So we don't get exception of deleting a pid file that doesn't exist, during mocha exit
      # because during the test, a listener was added
      process.removeListener 'exit', cli.onProcessExit if cli?

    it 'should create a pid file and delete it on exit', ->
      cli.pidFileInit(pidFile)
      expect(fs.existsSync(pidFile)).to.be.true
      pid = +fs.readFileSync(pidFile)
      expect(pid).to.equal process.pid
      cli.onProcessExit(0)
      expect(fs.existsSync(pidFile)).to.be.false

    it 'should exit, if the pid file exists and the pid is alive', ->
      fs.writeFileSync(pidPath, "#{process.pid}")
      cli.pidFileInit(pidFile)
      expect(exitStub).to.have.been.calledWith(Spaacejam.DONE.ALREADY_RUNNING)

    it 'should not exit, if the pid file exists but the pid is dead', ->
      fs.writeFileSync(pidPath, "50000")
      cli.pidFileInit(pidFile)
      expect(exitStub).to.have.not.been.called
      pid = +fs.readFileSync(pidFile)
      expect(pid).to.equal process.pid
      cli.onProcessExit(0)
