Package.describe({
  name: "success",
  summary: "spacejam test - package with passing tests",
  version: "0.9.5"
});

Package.onUse(function (api) {
  api.versionsFrom('0.9.0');

  api.use(['coffeescript','standalone-package-dep']);

  api.addFiles(['success.coffee'])
});

Package.onTest(function(api) {
  api.use(['coffeescript', 'tinytest', 'standalone-package']);

  api.addFiles(['success-test.coffee'],['server']);
});
