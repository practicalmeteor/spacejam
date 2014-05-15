global.log = require("loglevel")
chai = require("chai")
expect = chai.expect
sinon = require("sinon")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
Meteor = require "../src/Meteor"
ChildProcess = require "../src/ChildProcess"

#TODO give all tests 30000 other than the timeout test

describe "Meteor class Test", ->
  @timeout 30000

  meteor = null

  spawnStub = null

  globPackagesStub = null

  env = process.env

  spawnOptions = { cwd: "app", detached: false ,env: env }

  before ->
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL

  beforeEach ->
    meteor = new Meteor()
    spawnStub = sinon.stub(ChildProcess.prototype,"spawn")
    globPackagesStub = sinon.stub(meteor,"_globPackages")
    globPackagesStub.returns ["one","two"]



  afterEach ->
    spawnStub?.restore()



  it "Spawns meteor with correct arguments", (done)->
    opts = {app:"app","_":["","packages"]}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 process.env.PORT || 4096,
                 "--driver-package",
                 "test-in-console",
                 "test-packages",
                 "one",
                 "two"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,spawnOptions])
    done()



  it "Spawns meteor with correct arguments (--settings)", (done)->
    opts = {app:"app","_":["","packages"],settings:"settings.json"}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 process.env.PORT || 4096,
                 "--driver-package",
                 "test-in-console",
                 "--settings",
                 "settings.json",
                 "test-packages",
                 "one",
                 "two"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,spawnOptions])
    done()



  it "Spawns meteor with correct arguments (--driver-package)", (done)->
    opts = {app:"app","_":["","packages"],"driver-package":"test-in-browser"}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 process.env.PORT || 4096,
                 "--driver-package",
                 "test-in-browser",
                 "test-packages",
                 "one",
                 "two"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,spawnOptions])
    done()



  it "Spawns meteor with correct arguments (--once)", (done)->
    opts = {app:"app","_":["","packages"],once:true}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 process.env.PORT || 4096,
                 "--driver-package",
                 "test-in-console",
                 "--once",
                 "test-packages",
                 "one",
                 "two"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,spawnOptions])
    done()



  it "Spawns meteor with correct arguments (--production)", (done)->
    opts = {app:"app","_":["","packages"],production:true}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 process.env.PORT || 4096,
                 "--driver-package",
                 "test-in-console",
                 "--production",
                 "test-packages",
                 "one",
                 "two"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,spawnOptions])
    done()



  it "Spawns meteor with root-url and mongo-url args overwrite env", (done)->
    expectedSpawnOptions = spawnOptions
    mongoUrl = "mongodb://localhost/mydb"
    rootUrl = "http://localhost:5000/"
    opts = {app:"app","_":["","packages"],"root-url":rootUrl,"mongo-url":mongoUrl}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 process.env.PORT || 4096,
                 "--driver-package",
                 "test-in-console",
                 "test-packages",
                 "one",
                 "two"
    ]
    expectedSpawnOptions.env.ROOT_URL = rootUrl
    expectedSpawnOptions.env.MONGO_URL = mongoUrl
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,expectedSpawnOptions])
    done()
