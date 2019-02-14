DEFAULT_PATH = process.env.PATH

fs = require('fs')
path = require 'path'
phantomjs = require("phantomjs-prebuilt")
chai = require("chai")
expect = chai.expect
sinon = require("sinon")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
require '../../lib/log'
CLI = require '../../lib/CLI'
Spacejam = require '../../lib/Spacejam'
ChildProcess = require '../../lib/ChildProcess'



describe "CLI", ->
  @timeout 60000

  processArgv = null

  cli = null
  spacejam = null
  exitStub = null
  testPackagesStub = null
  spawnSpy = null
  phantomjsScript = null

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

    process.env.PATH = DEFAULT_PATH

    process.argv = ['coffee', path.normalize __dirname + "/../bin/spacejam"]
    cli = new CLI()
    spacejam = cli.spacejam
    exitStub = sinon.stub(process, 'exit')
    testPackagesStub = sinon.stub(spacejam, 'runTests')
    phantomjsScript = 'phantomjs-test-in-console.js'

  afterEach ->
    exitStub?.restore?()
    exitStub = null
    testPackagesStub?.restore?()
    testPackagesStub = null
    spawnSpy?.restore?()
    spawnSpy = null
    spacejam = null

  it "should call Spacejam.runTests() test command and full-app mode with a empty array of packages", ->
    process.argv.push "test", "--full-app"
    cli.exec()
    expect(testPackagesStub).to.have.been.calledWith("test", {command: "test","full-app":true, packages: []})

  it "should call Spacejam.runTests() with an empty options.packages array, if no packages where provided on the command line", ->
    process.argv.push "test-packages"
    cli.exec()
    expect(testPackagesStub).to.have.been.calledWith("test-packages", {command: "test-packages", packages: []})

  it "should call Spacejam.runTests() with options.packages set to the packages provided on the command line", ->
    process.argv.push 'test-packages', '--settings', 'settings.json', 'package1', 'package2'
    cli.exec()
    expect(testPackagesStub).to.have.been.calledWith("test-packages", {command: "test-packages", settings: 'settings.json', packages: ['package1', 'package2']})

  it "should spawn phantomjs with the value of --phantomjs-options", (done)->
    log.setLevel 'debug'
    testPackagesStub.restore()
    spawnSpy = sinon.spy(ChildProcess, '_spawn')
    process.chdir(__dirname + "/../apps/leaderboard/packages/success")
    # We set mongo-url to mongodb:// so test will be faster
    process.argv.push 'test-packages', '--port', '11096', '--mongo-url', 'mongodb://', '--phantomjs-options=--ignore-ssl-errors=true --load-images=false', './'
    cli.exec()
    spacejam.on 'done', (code)=>
      try
        if code is 0 then done() else done("spacejam.done=#{code}")
        expect(spawnSpy).to.have.been.calledTwice
        expect(spawnSpy.secondCall.args[1]).to.deep.equal(['--ignore-ssl-errors=true', '--load-images=false', phantomjsScript])
      catch err
        done(err)

  it "should modify PATH to include the path to the bundled phantomjs", (done)->
    testPackagesStub.restore()
    process.chdir(__dirname + "/../apps/leaderboard/packages/success")
    # We set mongo-url to mongodb:// so test will be faster
    process.argv.push 'test-packages', '--port', '12096', '--mongo-url', 'mongodb://', '--phantomjs-options=--ignore-ssl-errors=true --load-images=false', './'
    cli.exec()
    spacejam.on 'done', (code)=>
      try
        if code is 0 then done() else done("spacejam.done=#{code}")

        firstPathEntry = process.env.PATH.split(path.delimiter)[0]
        expect(firstPathEntry).to.equal(path.dirname(phantomjs.path))
      catch err
        done(err)

  it "should not modify PATH if --use-system-phantomjs is given", (done)->
    testPackagesStub.restore()
    process.chdir(__dirname + "/../apps/leaderboard/packages/success")
    # We set mongo-url to mongodb:// so test will be faster
    process.argv.push 'test-packages', '--port', '13096', '--mongo-url', 'mongodb://', '--use-system-phantomjs', '--phantomjs-options=--ignore-ssl-errors=true --load-images=false', './'
    console.log(process.argv.join(" "))
    cli.exec()
    spacejam.on 'done', (code)=>
      try
        if code is 0 then done() else done("spacejam.done=#{code}")

        expect(process.env.PATH).to.equal(DEFAULT_PATH)
      catch err
        done(err)
