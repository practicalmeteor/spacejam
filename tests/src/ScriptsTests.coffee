expect = require("chai").expect
isCoffee = require './isCoffee'
if isCoffee
  ChildProcess = require '../../src/ChildProcess'
else
  ChildProcess = require '../../lib/ChildProcess'
path = require 'path'
_ = require('underscore')

describe "scripts", ->

  spacejamBinDir = path.resolve(__dirname, "../../bin")
  meteorStubDir = path.resolve(__dirname, "../bin")

  child = null

  execOptions = null

  validateExpectedEnv = (env, expectedEnv)->
    for name, value of expectedEnv
      expect(env[name], "process.env.#{name}").to.equal value

  # The meteor stub process prints out a json with the command
  # line and env it was executed with. We verify it is what
  # we expected
  execRun = (done, args, expectedArgs, expectedEnv = {})->
    child.exec "#{spacejamBinDir}/mrun #{args}", execOptions, (err, stdout, stderr)=>
      try
        expect(err).to.be.null
        output = JSON.parse(stdout)
        actualArgs = output.argv.slice(2).join(' ')
        expect(actualArgs).to.deep.equal(expectedArgs)
        validateExpectedEnv(output.env, expectedEnv)
        done()
      catch err
        done(err)

  execTestPackages = (done, args, expectedArgs, expectedEnv = {})->
    cmdLine = "#{spacejamBinDir}/mtp #{args}"
    child.exec cmdLine, execOptions, (err, stdout, stderr)=>
      try
        expect(err).to.be.null
        output = JSON.parse(stdout)
        actualArgs = output.argv.slice(2).join(' ')
        expectedEnv.METEOR_TEST_PACKAGES = '1' # This should always exist.
        expectedEnv.PORT ?= '3100' # Env vars are strings
        expectedEnv.ROOT_URL ?= 'http://localhost:3100/'
        expectedArgs = "test-packages --port #{expectedEnv.PORT} #{expectedArgs}"
        expect(actualArgs).to.deep.equal(expectedArgs)
        validateExpectedEnv(output.env, expectedEnv)
        done()
      catch err
        done(err)

  beforeEach ->
    childEnv = _.clone(process.env)
    childEnv.PATH = "#{meteorStubDir}:#{childEnv.PATH}"
    delete childEnv.PORT
    delete childEnv.ROOT_URL
    delete childEnv.MONGO_URL
    delete childEnv.METEOR_SETTINGS_PATH
    delete childEnv.METEOR_APP_HOME
    delete childEnv.METEOR_TEST_PACKAGES
    delete childEnv.TEST_PORT
    delete childEnv.TEST_ROOT_URL
    delete childEnv.TEST_MONGO_URL
    delete childEnv.TEST_METEOR_SETTINGS_PATH

    execOptions =
      env: childEnv

    child = new ChildProcess()

  afterEach ->
    try
      child?.kill('SIGTERM')
    finally
      child = null

  describe "mrun", ->

    it "should launch meteor with the provided command line arguments", (done)->
      execRun(done, '--port 4000', '--port 4000')

    it "should launch meteor with --settings $METEOR_SETTINGS_PATH", (done)->
      settingsPath = __dirname + '/settings.json'
      execOptions.env.METEOR_SETTINGS_PATH = settingsPath
      expectedArgs = "--settings #{settingsPath} --port 4000"
      execRun(done, '--port 4000', expectedArgs)

    it "should cd to and run meteor in $METEOR_APP_HOME", (done)->
      settingsPath = __dirname + '/settings.json'
      execOptions.env.METEOR_APP_HOME = path.resolve(__dirname, '../apps/leaderboard')
      expectedArgs = "--port 4000"
      expectedEnv =
        PWD: execOptions.env.METEOR_APP_HOME
      execRun(done, '--port 4000', expectedArgs, expectedEnv)

  describe "mtp", ->

    it "should launch meteor with --port 3100 and set ROOT_URL to 'http://localhost:3100/' by default", (done)->
      execTestPackages(
        done,
        '--production',
        '--production'
      )

    it "should launch meteor with --port $TEST_PORT, set PORT to $TEST_PORT and ROOT_URL to 'http://localhost:$TEST_PORT/'", (done)->
      execOptions.env.TEST_PORT = 3200
      expectedEnv =
        PORT: '3200' # Env vars are strings
        ROOT_URL: 'http://localhost:3200/'
      execTestPackages(
        done,
        '--production',
        '--production',
        expectedEnv
      )

    it "should launch meteor with ROOT_URL set to TEST_ROOT_URL", (done)->
      execOptions.env.TEST_PORT = 3300
      execOptions.env.TEST_ROOT_URL = 'https://myvm/'
      expectedEnv =
        PORT: '3300'
        ROOT_URL: 'https://myvm/'
      execTestPackages(
        done,
        '--production',
        '--production',
        expectedEnv
      )

    it "should launch meteor with MONGO_URL set to TEST_MONGO_URL", (done)->
      execOptions.env.TEST_MONGO_URL = 'mongodb://user:pass@mongohq.com/testdb'
      expectedEnv =
        MONGO_URL: execOptions.env.TEST_MONGO_URL
      execTestPackages(
        done,
        '--production',
        '--production',
        expectedEnv
      )

    it "should launch meteor with --settings $METEOR_SETTINGS_PATH", (done)->
      settingsPath = __dirname + '/settings.json'
      execOptions.env.METEOR_SETTINGS_PATH = settingsPath
      execTestPackages(
        done,
        '--release 1.0',
        "--settings #{settingsPath} --release 1.0"
      )

    it "should launch meteor with --settings $TEST_METEOR_SETTINGS_PATH", (done)->
      settingsPath = __dirname + '/test-settings.json'
      execOptions.env.TEST_METEOR_SETTINGS_PATH = settingsPath
      execTestPackages(
        done,
        '--release 1.0',
        "--settings #{settingsPath} --release 1.0"
      )
