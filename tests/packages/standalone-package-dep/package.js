Package.describe({
  name: "standalone-package-dep",
  version: "1.0.1"
});

Package.onUse(function (api) {
  api.versionsFrom('0.9.0');

  api.use(['coffeescript']);

  api.addFiles(['success.coffee'])
});

Package.onTest(function(api) {
  api.use(['coffeescript', 'tinytest', 'standalone-package-dep']);

  api.addFiles('success-test.coffee');
});
