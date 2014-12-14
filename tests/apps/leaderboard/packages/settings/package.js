Package.describe({
  summary: "settings"
});

Package.onUse(function (api) {
  api.use(['meteor', 'coffeescript']);

  api.addFiles(['settings.coffee'])
});

Package.onTest(function(api) {
  api.use(['meteor', 'coffeescript', 'tinytest', 'settings']);

  api.addFiles('settings-test.coffee');
});
