chai = require("chai")
expect = chai.expect
sinon = require("sinon")
sinonChai = require("sinon-chai")
chai.use(sinonChai)
isCoffee = require './isCoffee'
if isCoffee
  SpaceJam = require '../../src/SpaceJam'
else
  SpaceJam = require '../../lib/SpaceJam'


describe "SapceJam.coffee", ->
  @timeout 60000

  spacejam = null

  before ->

  beforeEach ->
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.PACKAGE_DIRS

    spacejam = new SpaceJam()

  describe "testInVelocity", ->

    it "should call testPackages with package-driver=test-in-velocity", ()->
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
