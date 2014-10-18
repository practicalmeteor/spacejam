chai = require("chai")
expect = chai.expect
isCoffee = require './isCoffee'

describe "main.coffee", ->
  it "should export all public classes",->
    if isCoffee
      npmExports = require "../../src/main"
    else
      npmExports = require "../../lib/main"
    expect(npmExports).to.be.an 'object'
    expect(npmExports.SpaceJam).to.be.a 'function'
    expect(npmExports.Meteor).to.be.a 'function'
    expect(npmExports.Phantomjs).to.be.a 'function'
