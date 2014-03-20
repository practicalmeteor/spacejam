(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var WebApp = Package.webapp.WebApp;
var main = Package.webapp.main;
var WebAppInternals = Package.webapp.WebAppInternals;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;
var MongoInternals = Package['mongo-livedata'].MongoInternals;

/* Package-scope variables */
var Autoupdate;

(function () {

///////////////////////////////////////////////////////////////////////////////////
//                                                                               //
// packages/autoupdate/autoupdate_server.js                                      //
//                                                                               //
///////////////////////////////////////////////////////////////////////////////////
                                                                                 //
// Publish the current client version to the client.  When a client              // 1
// sees the subscription change and that there is a new version of the           // 2
// client available on the server, it can reload.                                // 3
//                                                                               // 4
// By default the current client version is identified by a hash of              // 5
// the client resources seen by the browser (the HTML, CSS, code, and            // 6
// static files in the `public` directory).                                      // 7
//                                                                               // 8
// If the environment variable `AUTOUPDATE_VERSION` is set it will be            // 9
// used as the client id instead.  You can use this to control when              // 10
// the client reloads.  For example, if you want to only force a                 // 11
// reload on major changes, you can use a custom AUTOUPDATE_VERSION              // 12
// which you only change when something worth pushing to clients                 // 13
// immediately happens.                                                          // 14
//                                                                               // 15
// For backwards compatibility, SERVER_ID can be used instead of                 // 16
// AUTOUPDATE_VERSION.                                                           // 17
//                                                                               // 18
// The server publishes a `meteor_autoupdate_clientVersions`                     // 19
// collection.  The contract of this collection is that each document            // 20
// in the collection represents an acceptable client version, with the           // 21
// `_id` field of the document set to the client id.                             // 22
//                                                                               // 23
// An "unacceptable" client version, for example, might be a version             // 24
// of the client code which has a severe UI bug, or is incompatible              // 25
// with the server.  An "acceptable" client version could be one that            // 26
// is older than the latest client code available on the server but              // 27
// still works.                                                                  // 28
//                                                                               // 29
// One of the published documents in the collection will have its                // 30
// `current` field set to `true`.  This is the version of the client             // 31
// code that the browser will receive from the server if it reloads.             // 32
//                                                                               // 33
// In this implementation only one document is published, the current            // 34
// client version.  Developers can easily experiment with different              // 35
// versioning and updating models by forking this package.                       // 36
                                                                                 // 37
Autoupdate = {};                                                                 // 38
                                                                                 // 39
// The client hash includes __meteor_runtime_config__, so wait until             // 40
// all packages have loaded and have had a chance to populate the                // 41
// runtime config before using the client hash as our default auto               // 42
// update version id.                                                            // 43
                                                                                 // 44
Autoupdate.autoupdateVersion = null;                                             // 45
                                                                                 // 46
Meteor.startup(function () {                                                     // 47
  // Allow people to override Autoupdate.autoupdateVersion before                // 48
  // startup. Tests do this.                                                     // 49
  if (Autoupdate.autoupdateVersion === null)                                     // 50
    Autoupdate.autoupdateVersion =                                               // 51
      process.env.AUTOUPDATE_VERSION ||                                          // 52
      process.env.SERVER_ID || // XXX COMPAT 0.6.6                               // 53
      WebApp.clientHash;                                                         // 54
                                                                                 // 55
  // Make autoupdateVersion available on the client.                             // 56
  __meteor_runtime_config__.autoupdateVersion = Autoupdate.autoupdateVersion;    // 57
});                                                                              // 58
                                                                                 // 59
                                                                                 // 60
Meteor.publish(                                                                  // 61
  "meteor_autoupdate_clientVersions",                                            // 62
  function () {                                                                  // 63
    var self = this;                                                             // 64
    // Using `autoupdateVersion` here is safe because we can't get a             // 65
    // subscription before webapp starts listening, and it doesn't do            // 66
    // that until the startup hooks have run.                                    // 67
    if (Autoupdate.autoupdateVersion) {                                          // 68
      self.added(                                                                // 69
        "meteor_autoupdate_clientVersions",                                      // 70
        Autoupdate.autoupdateVersion,                                            // 71
        {current: true}                                                          // 72
      );                                                                         // 73
      self.ready();                                                              // 74
    } else {                                                                     // 75
      // huh? shouldn't happen. Just error the sub.                              // 76
      self.error(new Meteor.Error(500, "Autoupdate.autoupdateVersion not set")); // 77
    }                                                                            // 78
  },                                                                             // 79
  {is_auto: true}                                                                // 80
);                                                                               // 81
                                                                                 // 82
///////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.autoupdate = {
  Autoupdate: Autoupdate
};

})();
