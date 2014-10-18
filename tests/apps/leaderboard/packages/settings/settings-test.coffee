Tinytest.add "Settings - test",(test)->
  test.equal Meteor.settings.TEST_SETTING, "spacejam"