Package.describe({
  summary: "failure"
});

Package.on_use(function (api, where) {
  api.use(['coffeescript']);
  api.add_files(['failure.coffee'])
});

Package.on_test(function(api) {
  api.use(['coffeescript', 'tinytest', 'failure'])
  api.add_files(['failure-test.coffee'],['server']);
});