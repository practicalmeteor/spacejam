fs = require('fs')
chai = require("chai")
expect = chai.expect
Readable = require('stream').Readable
tmp = require('tmp')
isCoffee = require './isCoffee'
if isCoffee
  XunitFilePipe = require '../../src/XunitFilePipe'
else
  XunitFilePipe = require '../../lib/XunitFilePipe'

describe "XunitFilePipe", ->

  it "should correctly filter xunit XML and state data", (done) ->
    fakeStdout = new Readable()
    fakeStdout.push('##_meteor_magic##xunit: bar\n##_meteor_magic##state: foo')
    fakeStdout.push(null)
    tmpFile = tmp.tmpNameSync()
    xunitFilePipe = new XunitFilePipe(fakeStdout, process.stderr, {pipeToFile: tmpFile})
    setTimeout =>
      actual = fs.readFileSync(tmpFile, {encoding:'utf8'})
      expect(actual).to.equal 'bar\n'
      fs.unlinkSync(tmpFile)
      done()
    , 10
