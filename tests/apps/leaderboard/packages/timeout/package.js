Package.describe({
  summary: "timeout"
});

Package.onUse(function (api) {
  api.use(['coffeescript']);

  api.addFiles(['timeout.coffee'])
});

Package.onTest(function(api) {
  api.use(['coffeescript', 'tinytest', 'timeout']);

  api.addFiles('timeout-test.coffee');
});
