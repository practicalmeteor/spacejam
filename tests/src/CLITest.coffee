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
