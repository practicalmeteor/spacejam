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

describe "Meteor class Test", ->
  @timeout 30000

  meteor = null

  spawnStub = null

  defaultTestPort = 4096

  testPackage = __dirname+"/leaderboard/packages/success"

  env = process.env

  expectedSpawnOptions = null

  childProcessMockObj = {
    on:->
    stdout:
      on:->
    stderr:
      on:->
  }



  before ->
    log.setLevel "debug"
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.SPACEJAM_PORT



  beforeEach ->
    meteor = new Meteor()
    expectedSpawnOptions = { cwd: ".", detached: false, env: env }
    spawnStub = sinon.stub(ChildProcess.prototype,"spawn")
    ChildProcess.prototype.child = childProcessMockObj

    process.argv = ['coffee', path.normalize __dirname + "/../bin/spacejam"]
    process.argv.push "test-packages"


  afterEach ->
    spawnStub?.restore()


  after ->
    ChildProcess.prototype.child = null


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



  it "testPackages() - Spawns meteor (with no packages arg)",->
    meteor.testPackages({})
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])


  it "testPackages() - Spawns meteor with correct arguments",->
    process.argv.push testPackage
    meteor.testPackages({})
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--app)",->
    process.argv = process.argv.concat ["--app","app",testPackage]
    meteor.testPackages({})
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
                         testPackage
    ]
    expectedSpawnOptions.cwd = "app"
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--settings)",->
    process.argv = process.argv.concat ["--settings","settings.json",testPackage]
    meteor.testPackages({})
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
                         testPackage
                         "--settings",
                         "settings.json",
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



#  xit "testPackages() - Spawns meteor with correct arguments (--driver-package)",->
#    opts = {"driver-package":"test-in-browser"}
#    meteor.testPackages(opts)
#    expectedSpawnArgs = ["--port",
#                         defaultTestPort,
#                         "--driver-package",
#                         "test-in-browser",
#                         "test-packages",
#                         testPackage
#    ]
#    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--once)",->
    process.argv = process.argv.concat [testPackage,"--once"]
    meteor.testPackages({})
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
                         testPackage
                         "--once",
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--production)",->
    process.argv = process.argv.concat [testPackage,"--production"]
    meteor.testPackages({})
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
                         testPackage
                         "--production",
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--release)",->
    testRelease = 8.0
    process.argv = process.argv.concat [testPackage,"--release",testRelease]
    meteor.testPackages({})
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
                         testPackage
                         "--release",
                         testRelease,
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



#  it "testPackages() - Spawns meteor with correct arguments (--deploy)",->
#    deployServer = "spacejamtest.meteor.com"
#    opts = {deploy:deployServer}
#    meteor.testPackages(opts)
#    expectedSpawnArgs = ["--port",
#                         defaultTestPort,
#                         "--driver-package",
#                         meteor.driverPackage,
#                         "--deploy",
#                         deployServer,
#                         "test-packages",
#                         testPackage
#    ]
#    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])
#


  it "Spawns meteor with root-url and mongo-url args overwrite env",->
    mongoUrl = "mongodb://localhost/mydb"
    rootUrl = "http://localhost:5000/"
    process.argv = process.argv.concat [testPackage,"--root-url",rootUrl,"--mongo-url",mongoUrl]
    meteor.testPackages({})
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
                         testPackage
    ]
    expectedSpawnOptions.env.ROOT_URL = rootUrl
    expectedSpawnOptions.env.MONGO_URL = mongoUrl
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "Kills internal mongodb children", (done)->
    @timeout 30000
    process.argv.push testPackage
    delete process.env.MONGO_URL
    spawnStub.restore()
    ChildProcess.prototype.child = null

    meteor.testPackages({})

    meteor.on "ready",->
      pid = meteor.childProcess.child.pid
      lookUpMongodChilds pid,(err, resultList )->
        expect(err,"could not find mongod children").not.to.be.ok
        expect(resultList,"Found more than one mongod child").have.length.of 1
        meteor.kill()
        #meteor.meteorMongodb.kill()
        #meteor.meteorMongodb.once "kill-done",->
        setInterval ->
          lookUpMongodChilds pid,(err, resultList )->
            if err
              expect(resultList,"the mongod children were not killed").not.to.be.ok
              done()
        ,500



lookUpMongodChilds =(pid,cb)->
    ps.lookup
      command: 'mongod',
      psargs: '--ppid '+pid
    , cb

