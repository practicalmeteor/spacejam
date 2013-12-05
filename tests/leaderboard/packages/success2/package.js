Package.describe({
  summary: "success2"
});

Package.on_use(function (api, where) {
  api.use(['coffeescript']);
  api.add_files(['success.coffee'])
});

Package.on_test(function(api) {
  api.use(['coffeescript', 'tinytest', 'success2'])
  api.add_files(['success-test.coffee'],['server']);
});