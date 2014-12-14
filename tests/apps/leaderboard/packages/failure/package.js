Package.describe({
  summary: "failure"
});

Package.onUse(function (api) {
  api.use(['coffeescript']);

  api.addFiles(['failure.coffee'])
});

Package.onTest(function(api) {
  api.use(['coffeescript', 'tinytest', 'failure']);

  api.addFiles('failure-test.coffee');
});
