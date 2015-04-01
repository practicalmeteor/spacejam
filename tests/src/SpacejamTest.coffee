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


describe "Spacejam", ->
  @timeout 60000

  spacejam = null

  before ->

  beforeEach ->
    delete process.env.PORT
    delete process.env.ROOT_URL
    delete process.env.MONGO_URL
    delete process.env.PACKAGE_DIRS

    spacejam = new Spacejam()

  afterEach ->
    spacejam = null
