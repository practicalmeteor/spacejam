Package.describe({
  summary: "appfails"
});

Package.on_use(function (api, where) {
  api.use(['coffeescript']);
  api.add_files(['appfails.coffee']);
});

Package.on_test(function(api) {
  api.use(['coffeescript', 'tinytest', 'appfails']);
  api.add_files(['appfails-test.coffee'],['server']);
});