global.log = require("loglevel")
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

  spawnOptions = { cwd: "app", detached: false }



  beforeEach ->
    meteor = new Meteor()
    spawnStub = sinon.stub(ChildProcess.prototype,"spawn")
    globPackagesStub = sinon.stub(meteor,"_globPackages")
    globPackagesStub.returns ["one","two"]



  afterEach ->
    spawnStub?.restore()



  it "Spawns meteor with correct arguments", (done)->
    opts = {app:"app",packages:"packages"}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 "3000",
                 "--driver-package",
                 "test-in-console",
                 "test-packages",
                 "one",
                 "two"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,spawnOptions])
    done()



  it "Spawns meteor with correct arguments (--settings)", (done)->
    opts = {app:"app",packages:"packages",settings:"settings.json"}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 "3000",
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
    opts = {app:"app",packages:"packages","driver-package":"test-in-browser"}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 "3000",
                 "--driver-package",
                 "test-in-browser",
                 "test-packages",
                 "one",
                 "two"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,spawnOptions])
    done()



  it "Spawns meteor with correct arguments (--once)", (done)->
    opts = {app:"app",packages:"packages",once:true}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 "3000",
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
    opts = {app:"app",packages:"packages",production:true}
    meteor.testPackages(opts)
    spawnArgs = ["--port",
                 "3000",
                 "--driver-package",
                 "test-in-console",
                 "--production",
                 "test-packages",
                 "one",
                 "two"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor",spawnArgs,spawnOptions])
    done()
