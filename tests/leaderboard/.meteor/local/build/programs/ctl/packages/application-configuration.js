(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;
var EJSON = Package.ejson.EJSON;
var Follower = Package['follower-livedata'].Follower;

/* Package-scope variables */
var AppConfig;

(function () {

////////////////////////////////////////////////////////////////////////////////////////
//                                                                                    //
// packages/application-configuration/config.js                                       //
//                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////
                                                                                      //
var Future = Npm.require("fibers/future");                                            // 1
                                                                                      // 2
AppConfig = {};                                                                       // 3
                                                                                      // 4
                                                                                      // 5
AppConfig.findGalaxy = _.once(function () {                                           // 6
  if (!('GALAXY' in process.env || 'ULTRAWORLD_DDP_ENDPOINT' in process.env)) {       // 7
    return null;                                                                      // 8
  }                                                                                   // 9
  return Follower.connect(process.env.ULTRAWORLD_DDP_ENDPOINT || process.env.GALAXY); // 10
});                                                                                   // 11
                                                                                      // 12
var ultra = AppConfig.findGalaxy();                                                   // 13
                                                                                      // 14
var subFuture = new Future();                                                         // 15
var subFutureJobs = new Future();                                                     // 16
if (ultra) {                                                                          // 17
  ultra.subscribe("oneApp", process.env.GALAXY_APP, subFuture.resolver());            // 18
  ultra.subscribe("oneJob", process.env.GALAXY_JOB, subFutureJobs.resolver());        // 19
}                                                                                     // 20
                                                                                      // 21
var Apps;                                                                             // 22
var Jobs;                                                                             // 23
var Services;                                                                         // 24
var collectionFuture = new Future();                                                  // 25
                                                                                      // 26
Meteor.startup(function () {                                                          // 27
  if (ultra) {                                                                        // 28
    Apps = new Meteor.Collection("apps", {                                            // 29
      connection: ultra                                                               // 30
    });                                                                               // 31
    Jobs = new Meteor.Collection("jobs", {                                            // 32
      connection: ultra                                                               // 33
    });                                                                               // 34
    Services = new Meteor.Collection('services', {                                    // 35
      connection: ultra                                                               // 36
    });                                                                               // 37
    // allow us to block on the collections being ready                               // 38
    collectionFuture.return();                                                        // 39
  }                                                                                   // 40
});                                                                                   // 41
                                                                                      // 42
// XXX: Remove this once we allow the same collection to be new'd from multiple       // 43
// places.                                                                            // 44
AppConfig._getAppCollection = function () {                                           // 45
  collectionFuture.wait();                                                            // 46
  return Apps;                                                                        // 47
};                                                                                    // 48
                                                                                      // 49
AppConfig._getJobsCollection = function () {                                          // 50
  collectionFuture.wait();                                                            // 51
  return Jobs;                                                                        // 52
};                                                                                    // 53
                                                                                      // 54
                                                                                      // 55
var staticAppConfig;                                                                  // 56
                                                                                      // 57
try {                                                                                 // 58
  if (process.env.APP_CONFIG) {                                                       // 59
    staticAppConfig = JSON.parse(process.env.APP_CONFIG);                             // 60
  } else {                                                                            // 61
    var settings;                                                                     // 62
    try {                                                                             // 63
      if (process.env.METEOR_SETTINGS) {                                              // 64
        settings = JSON.parse(process.env.METEOR_SETTINGS);                           // 65
      }                                                                               // 66
    } catch (e) {                                                                     // 67
      Log.warn("Could not parse METEOR_SETTINGS as JSON");                            // 68
    }                                                                                 // 69
    staticAppConfig = {                                                               // 70
      settings: settings,                                                             // 71
      packages: {                                                                     // 72
        'mongo-livedata': {                                                           // 73
          url: process.env.MONGO_URL,                                                 // 74
          oplog: process.env.MONGO_OPLOG_URL                                          // 75
        }                                                                             // 76
      }                                                                               // 77
    };                                                                                // 78
  }                                                                                   // 79
} catch (e) {                                                                         // 80
  Log.warn("Could not parse initial APP_CONFIG environment variable");                // 81
};                                                                                    // 82
                                                                                      // 83
AppConfig.getAppConfig = function () {                                                // 84
  if (!subFuture.isResolved() && staticAppConfig) {                                   // 85
    return staticAppConfig;                                                           // 86
  }                                                                                   // 87
  subFuture.wait();                                                                   // 88
  var myApp = Apps.findOne(process.env.GALAXY_APP);                                   // 89
  if (!myApp) {                                                                       // 90
    throw new Error("there is no app config for this app");                           // 91
  }                                                                                   // 92
  var config = myApp.config;                                                          // 93
  return config;                                                                      // 94
};                                                                                    // 95
                                                                                      // 96
AppConfig.getStarForThisJob = function () {                                           // 97
  if (ultra) {                                                                        // 98
    subFutureJobs.wait();                                                             // 99
    var job = Jobs.findOne(process.env.GALAXY_JOB);                                   // 100
    if (job) {                                                                        // 101
      return job.star;                                                                // 102
    }                                                                                 // 103
  }                                                                                   // 104
  return null;                                                                        // 105
};                                                                                    // 106
                                                                                      // 107
AppConfig.configurePackage = function (packageName, configure) {                      // 108
  var appConfig = AppConfig.getAppConfig(); // Will either be based in the env var,   // 109
                                         // or wait for galaxy to connect.            // 110
  var lastConfig =                                                                    // 111
        (appConfig && appConfig.packages &&                                           // 112
         appConfig.packages[packageName]) || {};                                      // 113
                                                                                      // 114
  // Always call the configure callback "soon" even if the initial configuration      // 115
  // is empty (synchronously, though deferred would be OK).                           // 116
  // XXX make sure that all callers of configurePackage deal well with multiple       // 117
  // callback invocations!  eg, email does not                                        // 118
  configure(lastConfig);                                                              // 119
  var configureIfDifferent = function (app) {                                         // 120
    if (!EJSON.equals(                                                                // 121
           app.config && app.config.packages && app.config.packages[packageName],     // 122
           lastConfig)) {                                                             // 123
      lastConfig = app.config.packages[packageName];                                  // 124
      configure(lastConfig);                                                          // 125
    }                                                                                 // 126
  };                                                                                  // 127
  var subHandle;                                                                      // 128
  var observed = new Future();                                                        // 129
                                                                                      // 130
  // This is not required to finish, so defer it so it doesn't block anything         // 131
  // else.                                                                            // 132
  Meteor.defer( function () {                                                         // 133
    // there's a Meteor.startup() that produces the various collections, make         // 134
    // sure it runs first before we continue.                                         // 135
    collectionFuture.wait();                                                          // 136
    subHandle = Apps.find(process.env.GALAXY_APP).observe({                           // 137
      added: configureIfDifferent,                                                    // 138
      changed: configureIfDifferent                                                   // 139
    });                                                                               // 140
    observed.return();                                                                // 141
  });                                                                                 // 142
                                                                                      // 143
  return {                                                                            // 144
    stop: function () {                                                               // 145
      observed.wait();                                                                // 146
      subHandle.stop();                                                               // 147
    }                                                                                 // 148
  };                                                                                  // 149
};                                                                                    // 150
                                                                                      // 151
AppConfig.configureService = function (serviceName, version, configure) {             // 152
                                                                                      // 153
  // Collect all the endpoints for this service, from both old- and new-format        // 154
  // documents, and call the `configure` callback with all the service endpoints      // 155
  // that we know about.                                                              // 156
  var callConfigure = function (doc) {                                                // 157
    var serviceDocs = Services.find({                                                 // 158
      name: serviceName,                                                              // 159
      version: version                                                                // 160
    });                                                                               // 161
    var endpoints = [];                                                               // 162
    serviceDocs.forEach(function (serviceDoc) {                                       // 163
      if (serviceDoc.providers) {                                                     // 164
        _.each(serviceDoc.providers, function (endpoint, app) {                       // 165
          endpoints.push(endpoint);                                                   // 166
        });                                                                           // 167
      } else {                                                                        // 168
        endpoints.push(serviceDoc.endpoint);                                          // 169
      }                                                                               // 170
    });                                                                               // 171
    configure(endpoints);                                                             // 172
  };                                                                                  // 173
                                                                                      // 174
  if (ultra) {                                                                        // 175
    // there's a Meteor.startup() that produces the various collections, make         // 176
    // sure it runs first before we continue.                                         // 177
    collectionFuture.wait();                                                          // 178
    // First try to subscribe to the new format service registrations; if that        // 179
    // sub doesn't exist, then ultraworld hasn't updated to the new format yet,       // 180
    // so try the old format `servicesByName` sub instead.                            // 181
    ultra.subscribe('services', serviceName, version, {                               // 182
      onError: function (err) {                                                       // 183
        if (err.error === 404) {                                                      // 184
          ultra.subscribe('servicesByName', serviceName);                             // 185
        }                                                                             // 186
      }                                                                               // 187
    });                                                                               // 188
    return Services.find({                                                            // 189
      name: serviceName,                                                              // 190
      version: version                                                                // 191
    }).observe({                                                                      // 192
      added: callConfigure,                                                           // 193
      changed: callConfigure,                                                         // 194
      removed: callConfigure                                                          // 195
    });                                                                               // 196
  }                                                                                   // 197
                                                                                      // 198
};                                                                                    // 199
                                                                                      // 200
////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['application-configuration'] = {
  AppConfig: AppConfig
};

})();
