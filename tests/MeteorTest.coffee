chai = require("chai")
expect = chai.expect
sinon = require("sinon")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
Meteor = require "../src/Meteor"
ChildProcess = require "../src/ChildProcess"

describe "Meteor class Test", ->
  @timeout 30000

  meteor = null

  spawnStub = null

  globPackagesStub = null

  defaultTestPort = 4096

  defaultDriverPackage = "test-in-console"

  testPackage = "package"

  env = process.env

  expectedSpawnOptions = { cwd: "app", detached: false, env: env }



  before ->
    log.setLevel "error"
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.SPACEJAM_PORT



  beforeEach ->
    meteor = new Meteor()
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
    opts = {app:"app","_":["","packages"]}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         defaultDriverPackage,
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--settings)",->
    opts = {app:"app","_":["","packages"],settings:"settings.json"}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         defaultDriverPackage,
                         "--settings",
                         "settings.json",
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--driver-package)",->
    opts = {app:"app","_":["","packages"],"driver-package":"test-in-browser"}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         "test-in-browser",
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--once)",->
    opts = {app:"app","_":["","packages"],once:true}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         defaultDriverPackage,
                         "--once",
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--production)",->
    opts = {app:"app","_":["","packages"],production:true}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         defaultDriverPackage,
                         "--production",
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--release)",->
    testRelease = "8.0"
    opts = {app:"app","_":["","packages"],release:testRelease}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         defaultDriverPackage,
                         "--release",
                         testRelease,
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "testPackages() - Spawns meteor with correct arguments (--deploy)",->
    deployServer = "spacejamtest.meteor.com"
    opts = {app:"app","_":["","packages"],deploy:deployServer}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         defaultDriverPackage,
                         "--deploy",
                         deployServer,
                         "test-packages",
                         testPackage
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,expectedSpawnOptions])



  it "Spawns meteor with root-url and mongo-url args overwrite env",->
    _expectedSpawnOptions = expectedSpawnOptions
    mongoUrl = "mongodb://localhost/mydb"
    rootUrl = "http://localhost:5000/"
    opts = {app:"app","_":["","packages"],"root-url":rootUrl,"mongo-url":mongoUrl}
    meteor.testPackages(opts)
    expectedSpawnArgs = ["--port",
                         defaultTestPort,
                         "--driver-package",
                         defaultDriverPackage,
                         "test-packages",
                         testPackage
    ]
    _expectedSpawnOptions.env.ROOT_URL = rootUrl
    _expectedSpawnOptions.env.MONGO_URL = mongoUrl
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,_expectedSpawnOptions])

