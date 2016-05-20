chai = require("chai")
expect = chai.expect

describe "main", ->
  it "should export all public classes",->
    npmExports = require "../../lib/main"
    expect(npmExports).to.be.an 'object'
    expect(npmExports.Spacejam).to.be.a 'function'
    expect(npmExports.Meteor).to.be.a 'function'
    expect(npmExports.Phantomjs).to.be.a 'function'
