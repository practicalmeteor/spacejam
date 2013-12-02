Package.describe({
  summary: "success"
});

Package.on_use(function (api, where) {
  api.use(['coffeescript']);
  api.add_files(['success.coffee'])
});

Package.on_test(function(api) {
  api.use(['coffeescript', 'tinytest', 'success'])
  api.add_files(['success-test.coffee']);
});