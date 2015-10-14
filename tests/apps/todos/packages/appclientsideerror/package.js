Package.describe({
  summary: "appfails"
});

Package.onUse(function (api) {
  api.addFiles(['appfails.js']);
});

Package.onTest(function(api) {
  api.addFiles('appfails-test.js', 'client');
});
