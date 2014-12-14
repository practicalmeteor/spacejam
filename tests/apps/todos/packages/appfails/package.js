Package.describe({
  summary: "appfails"
});

Package.onUse(function (api) {
  api.use(['coffeescript']);

  api.addFiles(['appfails.coffee']);
});

Package.onTest(function(api) {
  api.use(['coffeescript', 'tinytest', 'appfails']);

  api.addFiles('appfails-test.coffee');
});
