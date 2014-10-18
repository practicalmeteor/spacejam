Package.describe({
  summary: "timeout"
});

Package.on_use(function (api, where) {
  api.use(['coffeescript']);
  api.add_files(['timeout.coffee'])
});

Package.on_test(function(api) {
  api.use(['coffeescript', 'tinytest', 'timeout'])
  api.add_files(['timeout-test.coffee'],['server']);
});