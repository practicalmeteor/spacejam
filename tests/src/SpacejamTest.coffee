chai = require("chai")
expect = chai.expect
sinon = require("sinon")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
path = require "path"
isCoffee = require './isCoffee'
if isCoffee
  Spacejam = require '../../src/Spacejam'
else
  Spacejam = require '../../lib/Spacejam'


describe "Sapcejam.coffee", ->
  @timeout 60000

  spacejam = null

  before ->

  beforeEach ->
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.PACKAGE_DIRS

    spacejam = new Spacejam()

  describe "testInVelocity", ->

    it "should call testPackages with the correct options", ()->
      stub = sinon.stub(spacejam, 'testPackages')
      expectedOptions =
        'driver-package': "spacejamio:test-in-velocity"
        timeout:  0
        'phantomjs-script': 'phantomjs-test-in-velocity'
      spacejam.testInVelocity()
      expect(stub).to.have.been.calledWithExactly(expectedOptions)

    it "should set VELOCITY_URL to http://localhost:3000/ by default", ()->
      stub = sinon.stub(spacejam, 'testPackages')
      spacejam.testInVelocity()
      expect(process.env.VELOCITY_URL).to.equal "http://localhost:3000/"

    it "should set VELOCITY_URL to ROOT_URL", ()->
      stub = sinon.stub(spacejam, 'testPackages')
      process.env.ROOT_URL = "http://vm:4000"
      spacejam.testInVelocity()
      expect(process.env.VELOCITY_URL).to.equal "http://vm:4000"

    it "should set VELOCITY_URL to options.velocity-url", ()->
      stub = sinon.stub(spacejam, 'testPackages')
      spacejam.testInVelocity({"velocity-url": "http://vm:3000"})
      expect(process.env.VELOCITY_URL).to.equal "http://vm:3000"

    it "should run Phantomjs with the correct arguments", (done)->
      # cd to spacejam root
      process.env.PACKAGE_DIRS = path.resolve(__dirname, '../../packages')
      process.chdir(path.resolve(__dirname, '../apps/leaderboard'))
      options = {packages: ['success']}
      spacejam.testInVelocity(options)
      spy = sinon.spy(spacejam.phantomjs, 'run')
      spacejam.meteor.on "ready", =>
        try
          log.debug 'SpacejamTest on meteor ready'
          expect(spy).to.have.been.calledWith('http://localhost:4096/', 'phantomjs-test-in-velocity')
          done()
        catch err
          done(err)
