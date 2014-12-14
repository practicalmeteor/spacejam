Tinytest.add "settings",(test)->
  if Meteor.isServer
    test.equal Meteor.settings.serverSetting, "server"
  else
    test.equal Meteor.settings.public.clientSetting, "client"
