_ = require("underscore")
chai = require("chai")
expect = chai.expect
sinon = require("sinon")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
Meteor = require "../../lib/Meteor"
ChildProcess = require "../../lib/ChildProcess"
ps = require('psext')
path = require "path"


describe "Meteor", ->
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


  afterEach ->
    ChildProcess.prototype.child = null
    spawnStub?.restore?()
    spawnStub = null

  getExpectedSpawnOptions = (port, rootUrl, mongoUrl, cwd = process.cwd())->
    expectedSpawnOptions = {cwd: cwd, detached: false, env: env}
    rootUrl ?= "http://localhost:#{port}/"
    expectedSpawnOptions.env.METEOR_TEST_PACKAGES = '1'
    expectedSpawnOptions.env.ROOT_URL = rootUrl
    expectedSpawnOptions.env.MONGO_URL = mongoUrl if mongoUrl?
    return expectedSpawnOptions

  describe "getTestArgs()", ->

    beforeEach ->
      @options = {
        "driver-package": "package"
        "release": 'release'
        "port": '3000'
        "settings": 'settings'
        "production": true,
        "packages": ['pkg1', 'pkg2']
      }
      meteor.options = @options


    it "get common args for test and test-packages command", ->
      options = {
        "driver-package": "package"
        "release": 'release'
        "port": '3000'
        "settings": 'settings'
        "production": true
        "packages": ['pkg1', 'pkg2']
      }

      args = meteor.getTestArgs('test', options)

      expect(args).to.be.deep.equal([
        "test",
        "--driver-package", "package",
        "--release", "release",
        "--port", "3000",
        "--settings", "settings"
        "--production"
      ])



    it "create args for test-packages command", ->

      args = meteor.getTestArgs('test-packages', @options)

      expect(args).to.be.deep.equal([
        "test-packages",
        "--driver-package", "package",
        "--release", "release",
        "--port", "3000",
        "--settings", "settings"
        "--production",
        "pkg1", "pkg2"
      ])

    it "create args for test command", ->

      _.extend(@options,{
        "test-app-path": "/tmp/app"
        "full-app": true
      })


      args = meteor.getTestArgs('test', @options)

      expect(args).to.be.deep.equal( [
        "test",
        "--driver-package", "package",
        "--release", "release",
        "--port", "3000",
        "--settings", "settings",
        "--production",
        "--test-app-path", "/tmp/app",
        "--full-app"
      ])

    it "use package practicalmeteor:mocha if mocha practicalmeteor:mocha-console-runner as driver-package", ->

      expectedArgs = [
        "test",
        "--driver-package", "practicalmeteor:mocha",
        "--release", "release",
        "--port", "3000",
        "--settings", "settings",
        "--production",
        "--test-app-path", "/tmp/app",
        "--full-app"
      ]

      opts = _.extend(_.clone(@options),{
        "test-app-path": "/tmp/app"
        "full-app": true,
        "mocha": true
      });
      
      args = meteor.getTestArgs('test', opts)

      expect(args, "--mocha").to.be.deep.equal(expectedArgs)

      opts = _.extend(_.clone(@options),{
        "test-app-path": "/tmp/app"
        "full-app": true,
        "xunit": true,
        "mocha": true
      });

      args = meteor.getTestArgs('test', opts)

      expect(args, "--xunit").to.be.deep.equal(expectedArgs)

      opts = _.extend(_.clone(@options),{
        "test-app-path": "/tmp/app"
        "full-app": true,
        "driver-package": "practicalmeteor:mocha-console-runner"
      });

      args = meteor.getTestArgs('test', opts)

      expect(args, "--driver-package=practicalmeteor:mocha-console-runner").to.be.deep.equal(expectedArgs)


  describe "runTestCommand", ->

    beforeEach ->
      @expectedSpawnArgs = [
        "test",
        "--driver-package", "practicalmeteor:mocha"
        "--port", defaultTestPort
      ]
      @expectedSpawnOptions = getExpectedSpawnOptions(4096)
      @expectedSpawnOptions.env.MOCHA_REPORTER = 'console'

    it  "should spawn meteor with env var MOCHA_REPORTER to console if mocha option or practicalmeteor:mocha as driver-package", ->

      meteor.runTestCommand("test",{"mocha": true})
      expect(spawnStub.args[0]).to.eql(["meteor", @expectedSpawnArgs, @expectedSpawnOptions])

      meteor = new Meteor()
      meteor.runTestCommand("test",{"driver-package": "practicalmeteor:mocha"})
      expect(spawnStub.args[0]).to.eql(["meteor", @expectedSpawnArgs, @expectedSpawnOptions])


    it "should spawn meteor with env var MOCHA_REPORTER to console with practicalmeteor:mocha-console-runner as driver-package", ->
      meteor.runTestCommand("test", {"driver-package": "practicalmeteor:mocha-console-runner"})
      expect(spawnStub.args[0]).to.eql(["meteor", @expectedSpawnArgs, @expectedSpawnOptions])

  it  "testApp - should spawn meteor with correct arguments", ->
    meteor.testApp({"full-app": true})
    expectedSpawnArgs = [
      "test",
      "--driver-package", "test-in-console"
      "--port", defaultTestPort
      "--full-app"
    ]
    expect(spawnStub.args[0]).to.eql(["meteor", expectedSpawnArgs, getExpectedSpawnOptions(4096)])

  it "testPackages() - should spawn meteor with no package arguments",->
    meteor.testPackages()
    expectedSpawnArgs.push("--port", defaultTestPort)
    expect(spawnStub.args[0]).to.eql(["meteor", expectedSpawnArgs, getExpectedSpawnOptions(4096)])


  it "testPackages() - should spawn meteor with a package name argument",->
    meteor.testPackages({packages: [packageToTest]})
    expectedSpawnArgs.push("--port", defaultTestPort, packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])


  it "testPackages() - should spawn meteor with an absolute path to a --dir relative path",->
    meteor.testPackages({dir: '../todos'})
    expectedSpawnArgs.push("--port", defaultTestPort)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096, null, null, path.resolve("../todos"))])

  it "testPackages() - should spawn meteor with an absolute path to a --dir absolute path",->
    meteor.testPackages({dir: path.resolve("../todos")})
    expectedSpawnArgs.push("--port", defaultTestPort)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096, null, null, path.resolve("../todos"))])

  it "testPackages() - should spawn meteor with a ROOT_URL set to http://localhost:--port/",->
    rootUrl = "http://localhost:5000/"
    meteor.testPackages({port: 5000})
    expectedSpawnArgs.push("--port", 5000)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(5000, rootUrl)])


  it "testPackages() - should ignore env ROOT_URL",->
    process.env.ROOT_URL = "http://localhost:5000/"
    meteor.testPackages()
    expectedSpawnArgs.push("--port", defaultTestPort)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(defaultTestPort)])


  it "testPackages() - should spawn meteor with a --settings argument",->
    meteor.testPackages({settings: "settings.json", packages: [packageToTest]})
    expectedSpawnArgs.push("--port", defaultTestPort, "--settings", "settings.json", packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])



  it "testPackages() - should spawn meteor with a --production argument",->
    meteor.testPackages({packages: [packageToTest], production: true})
    expectedSpawnArgs.push("--port", defaultTestPort, "--production", packageToTest)
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])



  it "testPackages() - should spawn meteor with a --release argument",->
    releaseToTest = '0.9.0'
    meteor.testPackages({release: releaseToTest, packages: [packageToTest]})
    expectedSpawnArgs.push "--release", releaseToTest, "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])


  it "testPackages() - should spawn meteor with ROOT_URL set to --root-url",->
    rootUrl = "http://test.meteor.com/"
    meteor.testPackages({"root-url": rootUrl, packages: [packageToTest]})
    expectedSpawnArgs.push "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096, rootUrl)])
    expect(spawnStub.args[0][2].env.ROOT_URL).to.equal rootUrl


  it "testPackages() - should ignore env MONGO_URL",->
    process.env.MONGO_URL = "mongodb://localhost/mydb"
    meteor.testPackages()
    delete process.env.MONGO_URL
    expectedSpawnArgs.push "--port", defaultTestPort
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096)])


  it "testPackages() - should spawn meteor with MONGO_URL set to --mongo-url",->
    mongoUrl = "mongodb://localhost/mydb"
    meteor.testPackages({"mongo-url": mongoUrl, packages: [packageToTest]})
    expectedSpawnArgs.push "--port", defaultTestPort, packageToTest
    expect(spawnStub.args[0]).to.eql(["meteor",expectedSpawnArgs,getExpectedSpawnOptions(4096, null, mongoUrl)])
    expect(spawnStub.args[0][2].env.MONGO_URL).to.equal mongoUrl


  it "kill() - should kill internal mongodb child processes", (done)->
    @timeout 120000
    spawnStub.restore()
    spawnStub = null
    ChildProcess.prototype.child = null

    meteor.testPackages({packages: [packageToTest]})

    meteor.on "ready", =>
      try
        pid = meteor.childProcess.child.pid
        expect(meteor.mongodb.mongodChilds).to.have.length 1
        mongoPid = meteor.mongodb.mongodChilds[0].pid
        expect(mongoPid).to.be.ok
        meteor.kill()
        timerId = setInterval =>
          try
            process.kill(mongoPid, 0)
          catch
            # mondogb is dead
            clearInterval timerId
            done()
        , 500
      catch e1
        done(e1)
