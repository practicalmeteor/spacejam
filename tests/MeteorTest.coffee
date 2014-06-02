chai = require("chai")
expect = chai.expect
sinon = require("sinon")
_ = require("underscore")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
Meteor = require "../src/Meteor"
ChildProcess = require "../src/ChildProcess"
ps = require('ps-node')


describe "Meteor class Test", ->
  @timeout 30000

  meteor = null

  spawnStub = null

  globPackagesStub = null

  defaultTestPort = 4096

  testPackage = __dirname+"/leaderboard/packages/success"

  env = process.env

  expectedSpawnOptions = null



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
    globPackagesStub = sinon.stub(meteor,"_globPackages")
    globPackagesStub.returns [testPackage]



  afterEach ->
    spawnStub?.restore()



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




  it "testPackages() - Spawns meteor with correct arguments",->
    opts = {"_":["","packages"]}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--app)",->
    opts = {"_":["","packages"],app:"app"}
    meteor.testPackages(opts)
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
    opts = {"_":["","packages"],settings:"settings.json"}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "--settings",
                         "settings.json",
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



#  xit "testPackages() - Spawns meteor with correct arguments (--driver-package)",->
#    opts = {"_":["","packages"],"driver-package":"test-in-browser"}
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
    opts = {"_":["","packages"],once:true}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "--once",
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--production)",->
    opts = {"_":["","packages"],production:true}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "--production",
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--release)",->
    testRelease = "8.0"
    opts = {"_":["","packages"],release:testRelease}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         meteor.driverPackage,
                         "--release",
                         testRelease,
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



#  it "testPackages() - Spawns meteor with correct arguments (--deploy)",->
#    deployServer = "spacejamtest.meteor.com"
#    opts = {"_":["","packages"],deploy:deployServer}
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
    opts = {"_":["","packages"],"root-url":rootUrl,"mongo-url":mongoUrl}
    meteor.testPackages(opts)
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



  it "Kills internal mongodb childs", (done)->
    @timeout 30000
    delete process.env.MONGO_URL
    spawnStub.restore()
    globPackagesStub.returns(testPackage)
    meteor.testPackages({})

    meteor.on "ready",->
      pid = meteor.childProcess.child.pid
      lookUpMongodChilds pid,(err, resultList )->
        expect(err,"could not find mongod childs").not.to.be.ok
        expect(resultList,"Found more than one mongod child").have.length.of 1
        meteor.kill()
        meteor.meteorMongodb.kill()
        meteor.meteorMongodb.once "kill-done",->
          lookUpMongodChilds pid,(err, resultList )->
            expect(err,"found mongod childs").not.to.be.null
            expect(resultList,"the mongod childs were not killed").not.to.be.ok
            done()




lookUpMongodChilds =(pid,cb)->
    ps.lookup
      command: 'mongod',
      psargs: '--ppid '+pid
    , cb

