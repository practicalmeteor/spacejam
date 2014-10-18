chai = require("chai")
expect = chai.expect
sinon = require("sinon")
_ = require("underscore")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
isCoffee = require './isCoffee'
if isCoffee
  Meteor = require "../../src/Meteor"
  ChildProcess = require "../../src/ChildProcess"
else
  Meteor = require "../../lib/Meteor"
  ChildProcess = require "../../lib/ChildProcess"
ps = require('ps-node')
path = require "path"


describe "Meteor.coffee", ->
  @timeout 30000

  meteor = null

  spawnStub = null

  defaultTestPort = 4096

  env = null

  packageToTest = 'success'

  expectedSpawnOptions = null

  expectedSpawnArgs = null

  childProcessMockObj = {
    on:->
    stdout:
      on:->
    stderr:
      on:->
  }


  before ->
    log.setLevel "info"
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL


  beforeEach ->
    process.chdir(__dirname + "/../apps/leaderboard")

    env = _.clone process.env

    meteor = new Meteor()
    expectedSpawnArgs = ['test-packages', '--driver-package', 'test-in-console']
    spawnStub = sinon.stub(ChildProcess.prototype, "spawn")
    ChildProcess.prototype.child = childProcessMockObj

    if isCoffee
      process.argv = ['coffee', path.normalize __dirname + "/../../bin/spacejam.coffee"]
    else
      process.argv = ['node', path.normalize __dirname + "/../../bin/spacejam"]
    process.argv.push "test-packages"


  afterEach ->
    ChildProcess.prototype.child = null
    spawnStub?.restore()
    spawnStub = null


  getExpectedSpawnOptions = (port, rootUrl, mongoUrl)->
    expectedSpawnOptions = { cwd: ".", detached: false, env: env }
    rootUrl ?= "http://localhost:#{port}/"
    expectedSpawnOptions.env.ROOT_URL = rootUrl
    expectedSpawnOptions.env.MONGO_URL = mongoUrl if mongoUrl?
    return expectedSpawnOptions


  testPackages = ()->
    for arg in arguments
      process.argv.push arg
    opts = require("rc")("spacejam", {})
    meteor.testPackages(opts)


  it "testPackages() - should spawn meteor with no package arguments",->
    testPackages()
    expectedSpawnArgs.push("--port", defaultTestPort)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])


  it "testPackages() - should spawn meteor with a package name argument",->
    testPackages(packageToTest)
    expectedSpawnArgs.push("--port", defaultTestPort, packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])


  it "testPackages() - should spawn meteor with a ROOT_URL set to http://localhost:--port/",->
    rootUrl = "http://localhost:5000/"
    testPackages "--port", "5000"
    expectedSpawnArgs.push("--port", 5000)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(5000, rootUrl)])


  it "testPackages() - should ignore env ROOT_URL",->
    process.env.ROOT_URL = "http://localhost:5000/"
    testPackages()
    expectedSpawnArgs.push("--port", defaultTestPort)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(defaultTestPort)])


  it "testPackages() - should spawn meteor with a --settings argument",->
    testPackages "--settings", "settings.json", packageToTest
    expectedSpawnArgs.push("--port", defaultTestPort, "--settings", "settings.json", packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])



  it "testPackages() - should spawn meteor with a --production argument",->
    testPackages packageToTest, "--production"
    expectedSpawnArgs.push("--port", defaultTestPort, "--production", packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])



  it "testPackages() - should spawn meteor with a --release argument",->
    releaseToTest = '0.9.0'
    testPackages "--release", releaseToTest, packageToTest
    expectedSpawnArgs.push "--release", releaseToTest, "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])


  it "testPackages() - should spawn meteor with ROOT_URL set to --root-url",->
    rootUrl = "http://test.meteor.com/"
    testPackages "--root-url", rootUrl, packageToTest
    expectedSpawnArgs.push "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096, rootUrl)])
    expect(spawnStub.args[0][2].env.ROOT_URL).to.equal rootUrl


  it "testPackages() - should ignore env MONGO_URL",->
    process.env.MONGO_URL = "mongodb://localhost/mydb"
    testPackages()
    delete process.env.MONGO_URL
    expectedSpawnArgs.push "--port", defaultTestPort
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])


  it "testPackages() - should spawn meteor with MONGO_URL set to --mongo-url",->
    mongoUrl = "mongodb://localhost/mydb"
    testPackages "--mongo-url", mongoUrl, packageToTest
    expectedSpawnArgs.push "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096, null, mongoUrl)])
    expect(spawnStub.args[0][2].env.MONGO_URL).to.equal mongoUrl


  it "kill() - should kill internal mongodb child processes", (done)->
    @timeout 60000
    process.argv.push packageToTest
    spawnStub.restore()
    spawnStub = null
    ChildProcess.prototype.child = null

    testPackages()

    meteor.on "ready",->
      pid = meteor.childProcess.child.pid
      lookUpMongodChilds pid,(err, resultList )->
        expect(err,"could not find mongod children").not.to.be.ok
        expect(resultList,"Found more than one mongod child").have.length.of 1
        meteor.kill()
        # This should never be called from a test. meteor is responsible for calling this. why was it called again?
        #meteor.meteorMongodb.kill()
        # BlackBook testing only, we dont care how mongoDB is killed only that its dead so no need to register to implementation type of events
        #meteor.meteorMongodb.once "kill-done",->
        timerId = setInterval ->
          lookUpMongodChilds pid,(err, resultList )->
            if err
              expect(resultList,"the mongod children were not killed").not.to.be.ok
              clearInterval(timerId)
              done()
        ,500



lookUpMongodChilds =(pid,cb)->
    ps.lookup
      command: 'mongod',
      psargs: '--ppid '+pid
    , cb
