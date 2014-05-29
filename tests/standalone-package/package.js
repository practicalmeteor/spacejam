Package.describe({
  summary: "success"
});

Package.on_use(function (api, where) {
  api.use(['coffeescript','standalone-package-dep']);
  api.add_files(['success.coffee'])
});

Package.on_test(function(api) {
  api.use(['coffeescript', 'tinytest', 'standalone-package'])
  api.add_files(['success-test.coffee'],['server']);
});