chai = require("chai")
expect = chai.expect


describe "main.coffee", ->
  it "should export all public classes",->
    npmExports = require "../../src/main"
    expect(npmExports).to.be.an 'object'
    expect(npmExports.SpaceJam).to.be.a 'function'
    expect(npmExports.Meteor).to.be.a 'function'
    expect(npmExports.Phantomjs).to.be.a 'function'
