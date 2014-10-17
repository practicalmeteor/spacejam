chai = require("chai")
expect = chai.expect
sinon = require("sinon")
_ = require("underscore")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
Meteor = require "../src/Meteor"
ChildProcess = require "../src/ChildProcess"
ps = require('ps-node')
path = require "path"


describe "Meteor.coffee", ->
  @timeout 30000

  meteor = null

  spawnStub = null

  defaultTestPort = 4096

  env = process.env

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


  beforeEach ->
    process.chdir(__dirname + "/leaderboard")
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.SPACEJAM_PORT

    meteor = new Meteor()
    expectedSpawnOptions = { cwd: ".", detached: false, env: env }
    expectedSpawnArgs = ['test-packages', "--driver-package", meteor.driverPackage]
    spawnStub = sinon.stub(ChildProcess.prototype, "spawn")
    ChildProcess.prototype.child = childProcessMockObj

    process.argv = ['coffee', path.normalize __dirname + "/../bin/spacejam"]
    process.argv.push "test-packages"


  afterEach ->
    ChildProcess.prototype.child = null
    spawnStub?.restore()
    spawnStub = null



  after ->



  it "exec()",->
    meteorInstance = Meteor.exec()
    expect(meteorInstance,"exec() did not return a Meteor instance").to.be.an.instanceOf(Meteor)



  it "getDefaultRootUrl()",->
    returnedRootUrl = Meteor.getDefaultRootUrl()
    expect(returnedRootUrl,"Returned root url should be the default").to.equal("http://localhost:#{defaultTestPort}/")

    process.env.SPACEJAM_PORT = 5000
    returnedRootUrl = Meteor.getDefaultRootUrl()
    expect(returnedRootUrl,"Returned root url should use the $SPACEJAM_PORT env var").to.equal("http://localhost:#{process.env.SPACEJAM_PORT}/")
    delete process.env.SPACEJAM_PORT

    process.env.PORT = 6000
    returnedRootUrl = Meteor.getDefaultRootUrl()
    expect(returnedRootUrl,"Returned root url should use the $PORT env var").to.equal("http://localhost:#{process.env.PORT}/")
    delete process.env.PORT

    returnedRootUrl = Meteor.getDefaultRootUrl(8000)
    expect(returnedRootUrl,"Returned root url should use the @port param if any").to.equal("http://localhost:8000/")



  it "testPackages() - should spawn meteor with no package arguments",->
    meteor.testPackages({})
    expectedSpawnArgs.push("--port", defaultTestPort)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])


  it "testPackages() - should spawn meteor with a package name argument",->
    process.argv.push packageToTest
    meteor.testPackages({})
    expectedSpawnArgs.push("--port", defaultTestPort, packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - should spawn meteor with a --settings argument",->
    process.argv.push "--settings", "settings.json", packageToTest
    meteor.testPackages({})
    expectedSpawnArgs.push("--port", defaultTestPort, "--settings", "settings.json", packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - should spawn meteor with a --production argument",->
    process.argv.push packageToTest, "--production"
    meteor.testPackages({})
    expectedSpawnArgs.push("--port", defaultTestPort, "--production", packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - should spawn meteor with a --release argument",->
    releaseToTest = '0.9.0'
    process.argv.push "--release", releaseToTest, packageToTest
    meteor.testPackages({})
    expectedSpawnArgs.push "--release", releaseToTest, "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])


  it "testPackages() - should spawn meteor with ROOT_URL set to --root-url",->
    rootUrl = "http://localhost:5000/"
    process.argv.push "--root-url", rootUrl, packageToTest
    meteor.testPackages({})
    expectedSpawnArgs.push "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])
    expect(spawnStub.args[0][2].env.ROOT_URL).to.equal rootUrl


  it "testPackages() - should spawn meteor with MONGO_URL set to --mongo-url",->
    mongoUrl = "mongodb://localhost/mydb"
    process.argv.push "--mongo-url", mongoUrl, packageToTest
    meteor.testPackages({})
    expectedSpawnArgs.push "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])
    expect(spawnStub.args[0][2].env.MONGO_URL).to.equal mongoUrl


  it "kill() - should kill internal mongodb child processes", (done)->
    @timeout 60000
    process.argv.push packageToTest
    spawnStub.restore()
    spawnStub = null
    delete process.env.MONGO_URL if process.env.MONGO_URL
    ChildProcess.prototype.child = null

    meteor.testPackages({})

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
