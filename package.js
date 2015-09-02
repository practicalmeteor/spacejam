Package.describe({
    name: "practicalmeteor:spacejam",
    summary: "An npm package to test your meteor packages from the command line using phantomjs. Use in continuous integration environments.",
    version: "1.2.2_1",
    git: "https://github.com/practicalmeteor/spacejam.git"
});

Package.onUse(function(api) {
    api.versionsFrom("1.0");
    api.use(["coffeescript", 'practicalmeteor:mcli']);
    api.addFiles(['src/SpacejamCommand.coffee'], 'server');

    api.addFiles(['src/ChildProcess.coffee'], 'server');
    api.addFiles(['src/CLI.coffee'], 'server');
    api.addFiles(['src/log.coffee'], 'server');
    api.addFiles(['src/main.coffee'], 'server');
    api.addFiles(['src/Meteor.coffee'], 'server');
    api.addFiles(['src/MeteorMongodb.coffee'], 'server');
    api.addFiles(['src/PackageJSStubs.coffee'], 'server');
    api.addFiles(['src/Phantomjs.coffee'], 'server');
    api.addFiles(['src/phantomjs-test-in-console.coffee'], 'server');
    api.addFiles(['src/Pipe.coffee'], 'server');
    api.addFiles(['src/Spacejam.coffee'], 'server');
    api.addFiles(['src/SpacejamCommand.coffee'], 'server');
    api.addFiles(['src/XunitFilePipe.coffee'], 'server');

});
