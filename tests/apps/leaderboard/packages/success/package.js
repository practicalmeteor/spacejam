Package.describe({
  summary: "success"
});

Package.onUse(function (api) {
  api.use(['coffeescript']);

  api.addFiles(['success.coffee'])
});

Package.onTest(function(api) {
  api.use(['coffeescript', 'tinytest', 'success']);

  api.addFiles('success-test.coffee');
});
