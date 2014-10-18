Package.describe({
  summary: "settings"
});

Package.on_use(function (api, where) {
  api.use(['coffeescript']);
  api.add_files(['settings.coffee'])
});

Package.on_test(function(api) {
  api.use(['coffeescript', 'tinytest', 'settings'])
  api.add_files(['settings-test.coffee'],['server']);
});