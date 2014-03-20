(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var check = Package.check.check;
var Match = Package.check.Match;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var Deps = Package.deps.Deps;
var Log = Package.logging.Log;
var Retry = Package.retry.Retry;
var Hook = Package['callback-hook'].Hook;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;

/* Package-scope variables */
var DDP, DDPServer, LivedataTest, toSockjsUrl, toWebsocketUrl, StreamServer, Server, SUPPORTED_DDP_VERSIONS, MethodInvocation, parseDDP, stringifyDDP, allConnections;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/common.js                                                                                         //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
LivedataTest = {};                                                                                                     // 1
                                                                                                                       // 2
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/stream_client_nodejs.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// @param endpoint {String} URL to Meteor app                                                                          // 1
//   "http://subdomain.meteor.com/" or "/" or                                                                          // 2
//   "ddp+sockjs://foo-**.meteor.com/sockjs"                                                                           // 3
//                                                                                                                     // 4
// We do some rewriting of the URL to eventually make it "ws://" or "wss://",                                          // 5
// whatever was passed in.  At the very least, what Meteor.absoluteUrl() returns                                       // 6
// us should work.                                                                                                     // 7
//                                                                                                                     // 8
// We don't do any heartbeating. (The logic that did this in sockjs was removed,                                       // 9
// because it used a built-in sockjs mechanism. We could do it with WebSocket                                          // 10
// ping frames or with DDP-level messages.)                                                                            // 11
LivedataTest.ClientStream = function (endpoint, options) {                                                             // 12
  var self = this;                                                                                                     // 13
  options = options || {};                                                                                             // 14
                                                                                                                       // 15
  self.options = _.extend({                                                                                            // 16
    retry: true                                                                                                        // 17
  }, options);                                                                                                         // 18
                                                                                                                       // 19
  self.client = null;  // created in _launchConnection                                                                 // 20
  self.endpoint = endpoint;                                                                                            // 21
                                                                                                                       // 22
  self.headers = self.options.headers || {};                                                                           // 23
                                                                                                                       // 24
  self._initCommon();                                                                                                  // 25
                                                                                                                       // 26
  //// Kickoff!                                                                                                        // 27
  self._launchConnection();                                                                                            // 28
};                                                                                                                     // 29
                                                                                                                       // 30
_.extend(LivedataTest.ClientStream.prototype, {                                                                        // 31
                                                                                                                       // 32
  // data is a utf8 string. Data sent while not connected is dropped on                                                // 33
  // the floor, and it is up the user of this API to retransmit lost                                                   // 34
  // messages on 'reset'                                                                                               // 35
  send: function (data) {                                                                                              // 36
    var self = this;                                                                                                   // 37
    if (self.currentStatus.connected) {                                                                                // 38
      self.client.send(data);                                                                                          // 39
    }                                                                                                                  // 40
  },                                                                                                                   // 41
                                                                                                                       // 42
  // Changes where this connection points                                                                              // 43
  _changeUrl: function (url) {                                                                                         // 44
    var self = this;                                                                                                   // 45
    self.endpoint = url;                                                                                               // 46
  },                                                                                                                   // 47
                                                                                                                       // 48
  _onConnect: function (client) {                                                                                      // 49
    var self = this;                                                                                                   // 50
                                                                                                                       // 51
    if (client !== self.client) {                                                                                      // 52
      // This connection is not from the last call to _launchConnection.                                               // 53
      // But _launchConnection calls _cleanup which closes previous connections.                                       // 54
      // It's our belief that this stifles future 'open' events, but maybe                                             // 55
      // we are wrong?                                                                                                 // 56
      throw new Error("Got open from inactive client");                                                                // 57
    }                                                                                                                  // 58
                                                                                                                       // 59
    if (self._forcedToDisconnect) {                                                                                    // 60
      // We were asked to disconnect between trying to open the connection and                                         // 61
      // actually opening it. Let's just pretend this never happened.                                                  // 62
      self.client.close();                                                                                             // 63
      self.client = null;                                                                                              // 64
      return;                                                                                                          // 65
    }                                                                                                                  // 66
                                                                                                                       // 67
    if (self.currentStatus.connected) {                                                                                // 68
      // We already have a connection. It must have been the case that we                                              // 69
      // started two parallel connection attempts (because we wanted to                                                // 70
      // 'reconnect now' on a hanging connection and we had no way to cancel the                                       // 71
      // connection attempt.) But this shouldn't happen (similarly to the client                                       // 72
      // !== self.client check above).                                                                                 // 73
      throw new Error("Two parallel connections?");                                                                    // 74
    }                                                                                                                  // 75
                                                                                                                       // 76
    self._clearConnectionTimer();                                                                                      // 77
                                                                                                                       // 78
    // update status                                                                                                   // 79
    self.currentStatus.status = "connected";                                                                           // 80
    self.currentStatus.connected = true;                                                                               // 81
    self.currentStatus.retryCount = 0;                                                                                 // 82
    self.statusChanged();                                                                                              // 83
                                                                                                                       // 84
    // fire resets. This must come after status change so that clients                                                 // 85
    // can call send from within a reset callback.                                                                     // 86
    _.each(self.eventCallbacks.reset, function (callback) { callback(); });                                            // 87
  },                                                                                                                   // 88
                                                                                                                       // 89
  _cleanup: function () {                                                                                              // 90
    var self = this;                                                                                                   // 91
                                                                                                                       // 92
    self._clearConnectionTimer();                                                                                      // 93
    if (self.client) {                                                                                                 // 94
      var client = self.client;                                                                                        // 95
      self.client = null;                                                                                              // 96
      client.close();                                                                                                  // 97
    }                                                                                                                  // 98
  },                                                                                                                   // 99
                                                                                                                       // 100
  _clearConnectionTimer: function () {                                                                                 // 101
    var self = this;                                                                                                   // 102
                                                                                                                       // 103
    if (self.connectionTimer) {                                                                                        // 104
      clearTimeout(self.connectionTimer);                                                                              // 105
      self.connectionTimer = null;                                                                                     // 106
    }                                                                                                                  // 107
  },                                                                                                                   // 108
                                                                                                                       // 109
  _launchConnection: function () {                                                                                     // 110
    var self = this;                                                                                                   // 111
    self._cleanup(); // cleanup the old socket, if there was one.                                                      // 112
                                                                                                                       // 113
    // Since server-to-server DDP is still an experimental feature, we only                                            // 114
    // require the module if we actually create a server-to-server                                                     // 115
    // connection.                                                                                                     // 116
    var FayeWebSocket = Npm.require('faye-websocket');                                                                 // 117
                                                                                                                       // 118
    // We would like to specify 'ddp' as the subprotocol here. The npm module we                                       // 119
    // used to use as a client would fail the handshake if we ask for a                                                // 120
    // subprotocol and the server doesn't send one back (and sockjs doesn't).                                          // 121
    // Faye doesn't have that behavior; it's unclear from reading RFC 6455 if                                          // 122
    // Faye is erroneous or not.  So for now, we don't specify protocols.                                              // 123
    var client = self.client = new FayeWebSocket.Client(                                                               // 124
      toWebsocketUrl(self.endpoint),                                                                                   // 125
      [/*no subprotocols*/],                                                                                           // 126
      {headers: self.headers}                                                                                          // 127
    );                                                                                                                 // 128
                                                                                                                       // 129
    self._clearConnectionTimer();                                                                                      // 130
    self.connectionTimer = Meteor.setTimeout(                                                                          // 131
      _.bind(self._lostConnection, self),                                                                              // 132
      self.CONNECT_TIMEOUT);                                                                                           // 133
                                                                                                                       // 134
    self.client.on('open', Meteor.bindEnvironment(function () {                                                        // 135
      return self._onConnect(client);                                                                                  // 136
    }, "stream connect callback"));                                                                                    // 137
                                                                                                                       // 138
    var clientOnIfCurrent = function (event, description, f) {                                                         // 139
      self.client.on(event, Meteor.bindEnvironment(function () {                                                       // 140
        // Ignore events from any connection we've already cleaned up.                                                 // 141
        if (client !== self.client)                                                                                    // 142
          return;                                                                                                      // 143
        f.apply(this, arguments);                                                                                      // 144
      }, description));                                                                                                // 145
    };                                                                                                                 // 146
                                                                                                                       // 147
    clientOnIfCurrent('error', 'stream error callback', function (error) {                                             // 148
      if (!self.options._dontPrintErrors)                                                                              // 149
        Meteor._debug("stream error", error.message);                                                                  // 150
                                                                                                                       // 151
      // XXX: Make this do something better than make the tests hang if it does                                        // 152
      // not work.                                                                                                     // 153
      self._lostConnection();                                                                                          // 154
    });                                                                                                                // 155
                                                                                                                       // 156
                                                                                                                       // 157
    clientOnIfCurrent('close', 'stream close callback', function () {                                                  // 158
      self._lostConnection();                                                                                          // 159
    });                                                                                                                // 160
                                                                                                                       // 161
                                                                                                                       // 162
    clientOnIfCurrent('message', 'stream message callback', function (message) {                                       // 163
      // Ignore binary frames, where message.data is a Buffer                                                          // 164
      if (typeof message.data !== "string")                                                                            // 165
        return;                                                                                                        // 166
                                                                                                                       // 167
      _.each(self.eventCallbacks.message, function (callback) {                                                        // 168
        callback(message.data);                                                                                        // 169
      });                                                                                                              // 170
    });                                                                                                                // 171
  }                                                                                                                    // 172
});                                                                                                                    // 173
                                                                                                                       // 174
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/stream_client_common.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// XXX from Underscore.String (http://epeli.github.com/underscore.string/)                                             // 1
var startsWith = function(str, starts) {                                                                               // 2
  return str.length >= starts.length &&                                                                                // 3
    str.substring(0, starts.length) === starts;                                                                        // 4
};                                                                                                                     // 5
var endsWith = function(str, ends) {                                                                                   // 6
  return str.length >= ends.length &&                                                                                  // 7
    str.substring(str.length - ends.length) === ends;                                                                  // 8
};                                                                                                                     // 9
                                                                                                                       // 10
// @param url {String} URL to Meteor app, eg:                                                                          // 11
//   "/" or "madewith.meteor.com" or "https://foo.meteor.com"                                                          // 12
//   or "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"                                                                 // 13
// @returns {String} URL to the endpoint with the specific scheme and subPath, e.g.                                    // 14
// for scheme "http" and subPath "sockjs"                                                                              // 15
//   "http://subdomain.meteor.com/sockjs" or "/sockjs"                                                                 // 16
//   or "https://ddp--1234-foo.meteor.com/sockjs"                                                                      // 17
var translateUrl =  function(url, newSchemeBase, subPath) {                                                            // 18
  if (! newSchemeBase) {                                                                                               // 19
    newSchemeBase = "http";                                                                                            // 20
  }                                                                                                                    // 21
                                                                                                                       // 22
  var ddpUrlMatch = url.match(/^ddp(i?)\+sockjs:\/\//);                                                                // 23
  var httpUrlMatch = url.match(/^http(s?):\/\//);                                                                      // 24
  var newScheme;                                                                                                       // 25
  if (ddpUrlMatch) {                                                                                                   // 26
    // Remove scheme and split off the host.                                                                           // 27
    var urlAfterDDP = url.substr(ddpUrlMatch[0].length);                                                               // 28
    newScheme = ddpUrlMatch[1] === "i" ? newSchemeBase : newSchemeBase + "s";                                          // 29
    var slashPos = urlAfterDDP.indexOf('/');                                                                           // 30
    var host =                                                                                                         // 31
          slashPos === -1 ? urlAfterDDP : urlAfterDDP.substr(0, slashPos);                                             // 32
    var rest = slashPos === -1 ? '' : urlAfterDDP.substr(slashPos);                                                    // 33
                                                                                                                       // 34
    // In the host (ONLY!), change '*' characters into random digits. This                                             // 35
    // allows different stream connections to connect to different hostnames                                           // 36
    // and avoid browser per-hostname connection limits.                                                               // 37
    host = host.replace(/\*/g, function () {                                                                           // 38
      return Math.floor(Random.fraction()*10);                                                                         // 39
    });                                                                                                                // 40
                                                                                                                       // 41
    return newScheme + '://' + host + rest;                                                                            // 42
  } else if (httpUrlMatch) {                                                                                           // 43
    newScheme = !httpUrlMatch[1] ? newSchemeBase : newSchemeBase + "s";                                                // 44
    var urlAfterHttp = url.substr(httpUrlMatch[0].length);                                                             // 45
    url = newScheme + "://" + urlAfterHttp;                                                                            // 46
  }                                                                                                                    // 47
                                                                                                                       // 48
  // Prefix FQDNs but not relative URLs                                                                                // 49
  if (url.indexOf("://") === -1 && !startsWith(url, "/")) {                                                            // 50
    url = newSchemeBase + "://" + url;                                                                                 // 51
  }                                                                                                                    // 52
                                                                                                                       // 53
  // XXX This is not what we should be doing: if I have a site                                                         // 54
  // deployed at "/foo", then DDP.connect("/") should actually connect                                                 // 55
  // to "/", not to "/foo". "/" is an absolute path. (Contrast: if                                                     // 56
  // deployed at "/foo", it would be reasonable for DDP.connect("bar")                                                 // 57
  // to connect to "/foo/bar").                                                                                        // 58
  //                                                                                                                   // 59
  // We should make this properly honor absolute paths rather than                                                     // 60
  // forcing the path to be relative to the site root. Simultaneously,                                                 // 61
  // we should set DDP_DEFAULT_CONNECTION_URL to include the site                                                      // 62
  // root. See also client_convenience.js #RationalizingRelativeDDPURLs                                                // 63
  url = Meteor._relativeToSiteRootUrl(url);                                                                            // 64
                                                                                                                       // 65
  if (endsWith(url, "/"))                                                                                              // 66
    return url + subPath;                                                                                              // 67
  else                                                                                                                 // 68
    return url + "/" + subPath;                                                                                        // 69
};                                                                                                                     // 70
                                                                                                                       // 71
toSockjsUrl = function (url) {                                                                                         // 72
  return translateUrl(url, "http", "sockjs");                                                                          // 73
};                                                                                                                     // 74
                                                                                                                       // 75
toWebsocketUrl = function (url) {                                                                                      // 76
  var ret = translateUrl(url, "ws", "websocket");                                                                      // 77
  return ret;                                                                                                          // 78
};                                                                                                                     // 79
                                                                                                                       // 80
LivedataTest.toSockjsUrl = toSockjsUrl;                                                                                // 81
                                                                                                                       // 82
                                                                                                                       // 83
_.extend(LivedataTest.ClientStream.prototype, {                                                                        // 84
                                                                                                                       // 85
  // Register for callbacks.                                                                                           // 86
  on: function (name, callback) {                                                                                      // 87
    var self = this;                                                                                                   // 88
                                                                                                                       // 89
    if (name !== 'message' && name !== 'reset')                                                                        // 90
      throw new Error("unknown event type: " + name);                                                                  // 91
                                                                                                                       // 92
    if (!self.eventCallbacks[name])                                                                                    // 93
      self.eventCallbacks[name] = [];                                                                                  // 94
    self.eventCallbacks[name].push(callback);                                                                          // 95
  },                                                                                                                   // 96
                                                                                                                       // 97
                                                                                                                       // 98
  _initCommon: function () {                                                                                           // 99
    var self = this;                                                                                                   // 100
    //// Constants                                                                                                     // 101
                                                                                                                       // 102
    // how long to wait until we declare the connection attempt                                                        // 103
    // failed.                                                                                                         // 104
    self.CONNECT_TIMEOUT = 10000;                                                                                      // 105
                                                                                                                       // 106
    self.eventCallbacks = {}; // name -> [callback]                                                                    // 107
                                                                                                                       // 108
    self._forcedToDisconnect = false;                                                                                  // 109
                                                                                                                       // 110
    //// Reactive status                                                                                               // 111
    self.currentStatus = {                                                                                             // 112
      status: "connecting",                                                                                            // 113
      connected: false,                                                                                                // 114
      retryCount: 0                                                                                                    // 115
    };                                                                                                                 // 116
                                                                                                                       // 117
                                                                                                                       // 118
    self.statusListeners = typeof Deps !== 'undefined' && new Deps.Dependency;                                         // 119
    self.statusChanged = function () {                                                                                 // 120
      if (self.statusListeners)                                                                                        // 121
        self.statusListeners.changed();                                                                                // 122
    };                                                                                                                 // 123
                                                                                                                       // 124
    //// Retry logic                                                                                                   // 125
    self._retry = new Retry;                                                                                           // 126
    self.connectionTimer = null;                                                                                       // 127
                                                                                                                       // 128
  },                                                                                                                   // 129
                                                                                                                       // 130
  // Trigger a reconnect.                                                                                              // 131
  reconnect: function (options) {                                                                                      // 132
    var self = this;                                                                                                   // 133
    options = options || {};                                                                                           // 134
                                                                                                                       // 135
    if (options.url) {                                                                                                 // 136
      self._changeUrl(options.url);                                                                                    // 137
    }                                                                                                                  // 138
                                                                                                                       // 139
    if (options._sockjsOptions) {                                                                                      // 140
      self.options._sockjsOptions = options._sockjsOptions;                                                            // 141
    }                                                                                                                  // 142
                                                                                                                       // 143
    if (self.currentStatus.connected) {                                                                                // 144
      if (options._force || options.url) {                                                                             // 145
        // force reconnect.                                                                                            // 146
        self._lostConnection();                                                                                        // 147
      } // else, noop.                                                                                                 // 148
      return;                                                                                                          // 149
    }                                                                                                                  // 150
                                                                                                                       // 151
    // if we're mid-connection, stop it.                                                                               // 152
    if (self.currentStatus.status === "connecting") {                                                                  // 153
      self._lostConnection();                                                                                          // 154
    }                                                                                                                  // 155
                                                                                                                       // 156
    self._retry.clear();                                                                                               // 157
    self.currentStatus.retryCount -= 1; // don't count manual retries                                                  // 158
    self._retryNow();                                                                                                  // 159
  },                                                                                                                   // 160
                                                                                                                       // 161
  disconnect: function (options) {                                                                                     // 162
    var self = this;                                                                                                   // 163
    options = options || {};                                                                                           // 164
                                                                                                                       // 165
    // Failed is permanent. If we're failed, don't let people go back                                                  // 166
    // online by calling 'disconnect' then 'reconnect'.                                                                // 167
    if (self._forcedToDisconnect)                                                                                      // 168
      return;                                                                                                          // 169
                                                                                                                       // 170
    // If _permanent is set, permanently disconnect a stream. Once a stream                                            // 171
    // is forced to disconnect, it can never reconnect. This is for                                                    // 172
    // error cases such as ddp version mismatch, where trying again                                                    // 173
    // won't fix the problem.                                                                                          // 174
    if (options._permanent) {                                                                                          // 175
      self._forcedToDisconnect = true;                                                                                 // 176
    }                                                                                                                  // 177
                                                                                                                       // 178
    self._cleanup();                                                                                                   // 179
    self._retry.clear();                                                                                               // 180
                                                                                                                       // 181
    self.currentStatus = {                                                                                             // 182
      status: (options._permanent ? "failed" : "offline"),                                                             // 183
      connected: false,                                                                                                // 184
      retryCount: 0                                                                                                    // 185
    };                                                                                                                 // 186
                                                                                                                       // 187
    if (options._permanent && options._error)                                                                          // 188
      self.currentStatus.reason = options._error;                                                                      // 189
                                                                                                                       // 190
    self.statusChanged();                                                                                              // 191
  },                                                                                                                   // 192
                                                                                                                       // 193
  _lostConnection: function () {                                                                                       // 194
    var self = this;                                                                                                   // 195
                                                                                                                       // 196
    self._cleanup();                                                                                                   // 197
    self._retryLater(); // sets status. no need to do it here.                                                         // 198
  },                                                                                                                   // 199
                                                                                                                       // 200
  // fired when we detect that we've gone online. try to reconnect                                                     // 201
  // immediately.                                                                                                      // 202
  _online: function () {                                                                                               // 203
    // if we've requested to be offline by disconnecting, don't reconnect.                                             // 204
    if (this.currentStatus.status != "offline")                                                                        // 205
      this.reconnect();                                                                                                // 206
  },                                                                                                                   // 207
                                                                                                                       // 208
  _retryLater: function () {                                                                                           // 209
    var self = this;                                                                                                   // 210
                                                                                                                       // 211
    var timeout = 0;                                                                                                   // 212
    if (self.options.retry) {                                                                                          // 213
      timeout = self._retry.retryLater(                                                                                // 214
        self.currentStatus.retryCount,                                                                                 // 215
        _.bind(self._retryNow, self)                                                                                   // 216
      );                                                                                                               // 217
    }                                                                                                                  // 218
                                                                                                                       // 219
    self.currentStatus.status = "waiting";                                                                             // 220
    self.currentStatus.connected = false;                                                                              // 221
    self.currentStatus.retryTime = (new Date()).getTime() + timeout;                                                   // 222
    self.statusChanged();                                                                                              // 223
  },                                                                                                                   // 224
                                                                                                                       // 225
  _retryNow: function () {                                                                                             // 226
    var self = this;                                                                                                   // 227
                                                                                                                       // 228
    if (self._forcedToDisconnect)                                                                                      // 229
      return;                                                                                                          // 230
                                                                                                                       // 231
    self.currentStatus.retryCount += 1;                                                                                // 232
    self.currentStatus.status = "connecting";                                                                          // 233
    self.currentStatus.connected = false;                                                                              // 234
    delete self.currentStatus.retryTime;                                                                               // 235
    self.statusChanged();                                                                                              // 236
                                                                                                                       // 237
    self._launchConnection();                                                                                          // 238
  },                                                                                                                   // 239
                                                                                                                       // 240
                                                                                                                       // 241
  // Get current status. Reactive.                                                                                     // 242
  status: function () {                                                                                                // 243
    var self = this;                                                                                                   // 244
    if (self.statusListeners)                                                                                          // 245
      self.statusListeners.depend();                                                                                   // 246
    return self.currentStatus;                                                                                         // 247
  }                                                                                                                    // 248
});                                                                                                                    // 249
                                                                                                                       // 250
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/stream_server.js                                                                                  //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var url = Npm.require('url');                                                                                          // 1
                                                                                                                       // 2
var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX ||  "";                                                // 3
                                                                                                                       // 4
StreamServer = function () {                                                                                           // 5
  var self = this;                                                                                                     // 6
  self.registration_callbacks = [];                                                                                    // 7
  self.open_sockets = [];                                                                                              // 8
                                                                                                                       // 9
  // Because we are installing directly onto WebApp.httpServer instead of using                                        // 10
  // WebApp.app, we have to process the path prefix ourselves.                                                         // 11
  self.prefix = pathPrefix + '/sockjs';                                                                                // 12
  // routepolicy is only a weak dependency, because we don't need it if we're                                          // 13
  // just doing server-to-server DDP as a client.                                                                      // 14
  if (Package.routepolicy) {                                                                                           // 15
    Package.routepolicy.RoutePolicy.declare(self.prefix + '/', 'network');                                             // 16
  }                                                                                                                    // 17
                                                                                                                       // 18
  // set up sockjs                                                                                                     // 19
  var sockjs = Npm.require('sockjs');                                                                                  // 20
  var serverOptions = {                                                                                                // 21
    prefix: self.prefix,                                                                                               // 22
    log: function() {},                                                                                                // 23
    // this is the default, but we code it explicitly because we depend                                                // 24
    // on it in stream_client:HEARTBEAT_TIMEOUT                                                                        // 25
    heartbeat_delay: 25000,                                                                                            // 26
    // The default disconnect_delay is 5 seconds, but if the server ends up CPU                                        // 27
    // bound for that much time, SockJS might not notice that the user has                                             // 28
    // reconnected because the timer (of disconnect_delay ms) can fire before                                          // 29
    // SockJS processes the new connection. Eventually we'll fix this by not                                           // 30
    // combining CPU-heavy processing with SockJS termination (eg a proxy which                                        // 31
    // converts to Unix sockets) but for now, raise the delay.                                                         // 32
    disconnect_delay: 60 * 1000,                                                                                       // 33
    // Set the USE_JSESSIONID environment variable to enable setting the                                               // 34
    // JSESSIONID cookie. This is useful for setting up proxies with                                                   // 35
    // session affinity.                                                                                               // 36
    jsessionid: !!process.env.USE_JSESSIONID                                                                           // 37
  };                                                                                                                   // 38
                                                                                                                       // 39
  // If you know your server environment (eg, proxies) will prevent websockets                                         // 40
  // from ever working, set $DISABLE_WEBSOCKETS and SockJS clients (ie,                                                // 41
  // browsers) will not waste time attempting to use them.                                                             // 42
  // (Your server will still have a /websocket endpoint.)                                                              // 43
  if (process.env.DISABLE_WEBSOCKETS)                                                                                  // 44
    serverOptions.websocket = false;                                                                                   // 45
                                                                                                                       // 46
  self.server = sockjs.createServer(serverOptions);                                                                    // 47
  if (!Package.webapp) {                                                                                               // 48
    throw new Error("Cannot create a DDP server without the webapp package");                                          // 49
  }                                                                                                                    // 50
  // Install the sockjs handlers, but we want to keep around our own particular                                        // 51
  // request handler that adjusts idle timeouts while we have an outstanding                                           // 52
  // request.  This compensates for the fact that sockjs removes all listeners                                         // 53
  // for "request" to add its own.                                                                                     // 54
  Package.webapp.WebApp.httpServer.removeListener('request', Package.webapp.WebApp._timeoutAdjustmentRequestCallback); // 55
  self.server.installHandlers(Package.webapp.WebApp.httpServer);                                                       // 56
  Package.webapp.WebApp.httpServer.addListener('request', Package.webapp.WebApp._timeoutAdjustmentRequestCallback);    // 57
                                                                                                                       // 58
  Package.webapp.WebApp.httpServer.on('meteor-closing', function () {                                                  // 59
    _.each(self.open_sockets, function (socket) {                                                                      // 60
      socket.end();                                                                                                    // 61
    });                                                                                                                // 62
  });                                                                                                                  // 63
                                                                                                                       // 64
  // Support the /websocket endpoint                                                                                   // 65
  self._redirectWebsocketEndpoint();                                                                                   // 66
                                                                                                                       // 67
  self.server.on('connection', function (socket) {                                                                     // 68
                                                                                                                       // 69
    if (Package.webapp.WebAppInternals.usingDdpProxy) {                                                                // 70
      // If we are behind a DDP proxy, immediately close any sockjs connections                                        // 71
      // that are not using websockets; the proxy will terminate sockjs for us,                                        // 72
      // so we don't expect to be handling any other transports.                                                       // 73
      if (socket.protocol !== "websocket" &&                                                                           // 74
          socket.protocol !== "websocket-raw") {                                                                       // 75
        socket.close();                                                                                                // 76
        return;                                                                                                        // 77
      }                                                                                                                // 78
    }                                                                                                                  // 79
                                                                                                                       // 80
    socket.send = function (data) {                                                                                    // 81
      socket.write(data);                                                                                              // 82
    };                                                                                                                 // 83
    socket.on('close', function () {                                                                                   // 84
      self.open_sockets = _.without(self.open_sockets, socket);                                                        // 85
    });                                                                                                                // 86
    self.open_sockets.push(socket);                                                                                    // 87
                                                                                                                       // 88
    // XXX COMPAT WITH 0.6.6. Send the old style welcome message, which                                                // 89
    // will force old clients to reload. Remove this once we're not                                                    // 90
    // concerned about people upgrading from a pre-0.7.0 release. Also,                                                // 91
    // remove the clause in the client that ignores the welcome message                                                // 92
    // (livedata_connection.js)                                                                                        // 93
    socket.send(JSON.stringify({server_id: "0"}));                                                                     // 94
                                                                                                                       // 95
    // call all our callbacks when we get a new socket. they will do the                                               // 96
    // work of setting up handlers and such for specific messages.                                                     // 97
    _.each(self.registration_callbacks, function (callback) {                                                          // 98
      callback(socket);                                                                                                // 99
    });                                                                                                                // 100
  });                                                                                                                  // 101
                                                                                                                       // 102
};                                                                                                                     // 103
                                                                                                                       // 104
_.extend(StreamServer.prototype, {                                                                                     // 105
  // call my callback when a new socket connects.                                                                      // 106
  // also call it for all current connections.                                                                         // 107
  register: function (callback) {                                                                                      // 108
    var self = this;                                                                                                   // 109
    self.registration_callbacks.push(callback);                                                                        // 110
    _.each(self.all_sockets(), function (socket) {                                                                     // 111
      callback(socket);                                                                                                // 112
    });                                                                                                                // 113
  },                                                                                                                   // 114
                                                                                                                       // 115
  // get a list of all sockets                                                                                         // 116
  all_sockets: function () {                                                                                           // 117
    var self = this;                                                                                                   // 118
    return _.values(self.open_sockets);                                                                                // 119
  },                                                                                                                   // 120
                                                                                                                       // 121
  // Redirect /websocket to /sockjs/websocket in order to not expose                                                   // 122
  // sockjs to clients that want to use raw websockets                                                                 // 123
  _redirectWebsocketEndpoint: function() {                                                                             // 124
    var self = this;                                                                                                   // 125
    // Unfortunately we can't use a connect middleware here since                                                      // 126
    // sockjs installs itself prior to all existing listeners                                                          // 127
    // (meaning prior to any connect middlewares) so we need to take                                                   // 128
    // an approach similar to overshadowListeners in                                                                   // 129
    // https://github.com/sockjs/sockjs-node/blob/cf820c55af6a9953e16558555a31decea554f70e/src/utils.coffee            // 130
    _.each(['request', 'upgrade'], function(event) {                                                                   // 131
      var httpServer = Package.webapp.WebApp.httpServer;                                                               // 132
      var oldHttpServerListeners = httpServer.listeners(event).slice(0);                                               // 133
      httpServer.removeAllListeners(event);                                                                            // 134
                                                                                                                       // 135
      // request and upgrade have different arguments passed but                                                       // 136
      // we only care about the first one which is always request                                                      // 137
      var newListener = function(request /*, moreArguments */) {                                                       // 138
        // Store arguments for use within the closure below                                                            // 139
        var args = arguments;                                                                                          // 140
                                                                                                                       // 141
        // Rewrite /websocket and /websocket/ urls to /sockjs/websocket while                                          // 142
        // preserving query string.                                                                                    // 143
        var parsedUrl = url.parse(request.url);                                                                        // 144
        if (parsedUrl.pathname === pathPrefix + '/websocket' ||                                                        // 145
            parsedUrl.pathname === pathPrefix + '/websocket/') {                                                       // 146
          parsedUrl.pathname = self.prefix + '/websocket';                                                             // 147
          request.url = url.format(parsedUrl);                                                                         // 148
        }                                                                                                              // 149
        _.each(oldHttpServerListeners, function(oldListener) {                                                         // 150
          oldListener.apply(httpServer, args);                                                                         // 151
        });                                                                                                            // 152
      };                                                                                                               // 153
      httpServer.addListener(event, newListener);                                                                      // 154
    });                                                                                                                // 155
  }                                                                                                                    // 156
});                                                                                                                    // 157
                                                                                                                       // 158
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/livedata_server.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
DDPServer = {};                                                                                                        // 1
                                                                                                                       // 2
var Fiber = Npm.require('fibers');                                                                                     // 3
                                                                                                                       // 4
// This file contains classes:                                                                                         // 5
// * Session - The server's connection to a single DDP client                                                          // 6
// * Subscription - A single subscription for a single client                                                          // 7
// * Server - An entire server that may talk to > 1 client. A DDP endpoint.                                            // 8
//                                                                                                                     // 9
// Session and Subscription are file scope. For now, until we freeze                                                   // 10
// the interface, Server is package scope (in the future it should be                                                  // 11
// exported.)                                                                                                          // 12
                                                                                                                       // 13
// Represents a single document in a SessionCollectionView                                                             // 14
var SessionDocumentView = function () {                                                                                // 15
  var self = this;                                                                                                     // 16
  self.existsIn = {}; // set of subscriptionHandle                                                                     // 17
  self.dataByKey = {}; // key-> [ {subscriptionHandle, value} by precedence]                                           // 18
};                                                                                                                     // 19
                                                                                                                       // 20
_.extend(SessionDocumentView.prototype, {                                                                              // 21
                                                                                                                       // 22
  getFields: function () {                                                                                             // 23
    var self = this;                                                                                                   // 24
    var ret = {};                                                                                                      // 25
    _.each(self.dataByKey, function (precedenceList, key) {                                                            // 26
      ret[key] = precedenceList[0].value;                                                                              // 27
    });                                                                                                                // 28
    return ret;                                                                                                        // 29
  },                                                                                                                   // 30
                                                                                                                       // 31
  clearField: function (subscriptionHandle, key, changeCollector) {                                                    // 32
    var self = this;                                                                                                   // 33
    // Publish API ignores _id if present in fields                                                                    // 34
    if (key === "_id")                                                                                                 // 35
      return;                                                                                                          // 36
    var precedenceList = self.dataByKey[key];                                                                          // 37
                                                                                                                       // 38
    // It's okay to clear fields that didn't exist. No need to throw                                                   // 39
    // an error.                                                                                                       // 40
    if (!precedenceList)                                                                                               // 41
      return;                                                                                                          // 42
                                                                                                                       // 43
    var removedValue = undefined;                                                                                      // 44
    for (var i = 0; i < precedenceList.length; i++) {                                                                  // 45
      var precedence = precedenceList[i];                                                                              // 46
      if (precedence.subscriptionHandle === subscriptionHandle) {                                                      // 47
        // The view's value can only change if this subscription is the one that                                       // 48
        // used to have precedence.                                                                                    // 49
        if (i === 0)                                                                                                   // 50
          removedValue = precedence.value;                                                                             // 51
        precedenceList.splice(i, 1);                                                                                   // 52
        break;                                                                                                         // 53
      }                                                                                                                // 54
    }                                                                                                                  // 55
    if (_.isEmpty(precedenceList)) {                                                                                   // 56
      delete self.dataByKey[key];                                                                                      // 57
      changeCollector[key] = undefined;                                                                                // 58
    } else if (removedValue !== undefined &&                                                                           // 59
               !EJSON.equals(removedValue, precedenceList[0].value)) {                                                 // 60
      changeCollector[key] = precedenceList[0].value;                                                                  // 61
    }                                                                                                                  // 62
  },                                                                                                                   // 63
                                                                                                                       // 64
  changeField: function (subscriptionHandle, key, value,                                                               // 65
                         changeCollector, isAdd) {                                                                     // 66
    var self = this;                                                                                                   // 67
    // Publish API ignores _id if present in fields                                                                    // 68
    if (key === "_id")                                                                                                 // 69
      return;                                                                                                          // 70
                                                                                                                       // 71
    // Don't share state with the data passed in by the user.                                                          // 72
    value = EJSON.clone(value);                                                                                        // 73
                                                                                                                       // 74
    if (!_.has(self.dataByKey, key)) {                                                                                 // 75
      self.dataByKey[key] = [{subscriptionHandle: subscriptionHandle,                                                  // 76
                              value: value}];                                                                          // 77
      changeCollector[key] = value;                                                                                    // 78
      return;                                                                                                          // 79
    }                                                                                                                  // 80
    var precedenceList = self.dataByKey[key];                                                                          // 81
    var elt;                                                                                                           // 82
    if (!isAdd) {                                                                                                      // 83
      elt = _.find(precedenceList, function (precedence) {                                                             // 84
        return precedence.subscriptionHandle === subscriptionHandle;                                                   // 85
      });                                                                                                              // 86
    }                                                                                                                  // 87
                                                                                                                       // 88
    if (elt) {                                                                                                         // 89
      if (elt === precedenceList[0] && !EJSON.equals(value, elt.value)) {                                              // 90
        // this subscription is changing the value of this field.                                                      // 91
        changeCollector[key] = value;                                                                                  // 92
      }                                                                                                                // 93
      elt.value = value;                                                                                               // 94
    } else {                                                                                                           // 95
      // this subscription is newly caring about this field                                                            // 96
      precedenceList.push({subscriptionHandle: subscriptionHandle, value: value});                                     // 97
    }                                                                                                                  // 98
                                                                                                                       // 99
  }                                                                                                                    // 100
});                                                                                                                    // 101
                                                                                                                       // 102
// Represents a client's view of a single collection                                                                   // 103
var SessionCollectionView = function (collectionName, sessionCallbacks) {                                              // 104
  var self = this;                                                                                                     // 105
  self.collectionName = collectionName;                                                                                // 106
  self.documents = {};                                                                                                 // 107
  self.callbacks = sessionCallbacks;                                                                                   // 108
};                                                                                                                     // 109
                                                                                                                       // 110
LivedataTest.SessionCollectionView = SessionCollectionView;                                                            // 111
                                                                                                                       // 112
                                                                                                                       // 113
_.extend(SessionCollectionView.prototype, {                                                                            // 114
                                                                                                                       // 115
  isEmpty: function () {                                                                                               // 116
    var self = this;                                                                                                   // 117
    return _.isEmpty(self.documents);                                                                                  // 118
  },                                                                                                                   // 119
                                                                                                                       // 120
  diff: function (previous) {                                                                                          // 121
    var self = this;                                                                                                   // 122
    LocalCollection._diffObjects(previous.documents, self.documents, {                                                 // 123
      both: _.bind(self.diffDocument, self),                                                                           // 124
                                                                                                                       // 125
      rightOnly: function (id, nowDV) {                                                                                // 126
        self.callbacks.added(self.collectionName, id, nowDV.getFields());                                              // 127
      },                                                                                                               // 128
                                                                                                                       // 129
      leftOnly: function (id, prevDV) {                                                                                // 130
        self.callbacks.removed(self.collectionName, id);                                                               // 131
      }                                                                                                                // 132
    });                                                                                                                // 133
  },                                                                                                                   // 134
                                                                                                                       // 135
  diffDocument: function (id, prevDV, nowDV) {                                                                         // 136
    var self = this;                                                                                                   // 137
    var fields = {};                                                                                                   // 138
    LocalCollection._diffObjects(prevDV.getFields(), nowDV.getFields(), {                                              // 139
      both: function (key, prev, now) {                                                                                // 140
        if (!EJSON.equals(prev, now))                                                                                  // 141
          fields[key] = now;                                                                                           // 142
      },                                                                                                               // 143
      rightOnly: function (key, now) {                                                                                 // 144
        fields[key] = now;                                                                                             // 145
      },                                                                                                               // 146
      leftOnly: function(key, prev) {                                                                                  // 147
        fields[key] = undefined;                                                                                       // 148
      }                                                                                                                // 149
    });                                                                                                                // 150
    self.callbacks.changed(self.collectionName, id, fields);                                                           // 151
  },                                                                                                                   // 152
                                                                                                                       // 153
  added: function (subscriptionHandle, id, fields) {                                                                   // 154
    var self = this;                                                                                                   // 155
    var docView = self.documents[id];                                                                                  // 156
    var added = false;                                                                                                 // 157
    if (!docView) {                                                                                                    // 158
      added = true;                                                                                                    // 159
      docView = new SessionDocumentView();                                                                             // 160
      self.documents[id] = docView;                                                                                    // 161
    }                                                                                                                  // 162
    docView.existsIn[subscriptionHandle] = true;                                                                       // 163
    var changeCollector = {};                                                                                          // 164
    _.each(fields, function (value, key) {                                                                             // 165
      docView.changeField(                                                                                             // 166
        subscriptionHandle, key, value, changeCollector, true);                                                        // 167
    });                                                                                                                // 168
    if (added)                                                                                                         // 169
      self.callbacks.added(self.collectionName, id, changeCollector);                                                  // 170
    else                                                                                                               // 171
      self.callbacks.changed(self.collectionName, id, changeCollector);                                                // 172
  },                                                                                                                   // 173
                                                                                                                       // 174
  changed: function (subscriptionHandle, id, changed) {                                                                // 175
    var self = this;                                                                                                   // 176
    var changedResult = {};                                                                                            // 177
    var docView = self.documents[id];                                                                                  // 178
    if (!docView)                                                                                                      // 179
      throw new Error("Could not find element with id " + id + " to change");                                          // 180
    _.each(changed, function (value, key) {                                                                            // 181
      if (value === undefined)                                                                                         // 182
        docView.clearField(subscriptionHandle, key, changedResult);                                                    // 183
      else                                                                                                             // 184
        docView.changeField(subscriptionHandle, key, value, changedResult);                                            // 185
    });                                                                                                                // 186
    self.callbacks.changed(self.collectionName, id, changedResult);                                                    // 187
  },                                                                                                                   // 188
                                                                                                                       // 189
  removed: function (subscriptionHandle, id) {                                                                         // 190
    var self = this;                                                                                                   // 191
    var docView = self.documents[id];                                                                                  // 192
    if (!docView) {                                                                                                    // 193
      var err = new Error("Removed nonexistent document " + id);                                                       // 194
      throw err;                                                                                                       // 195
    }                                                                                                                  // 196
    delete docView.existsIn[subscriptionHandle];                                                                       // 197
    if (_.isEmpty(docView.existsIn)) {                                                                                 // 198
      // it is gone from everyone                                                                                      // 199
      self.callbacks.removed(self.collectionName, id);                                                                 // 200
      delete self.documents[id];                                                                                       // 201
    } else {                                                                                                           // 202
      var changed = {};                                                                                                // 203
      // remove this subscription from every precedence list                                                           // 204
      // and record the changes                                                                                        // 205
      _.each(docView.dataByKey, function (precedenceList, key) {                                                       // 206
        docView.clearField(subscriptionHandle, key, changed);                                                          // 207
      });                                                                                                              // 208
                                                                                                                       // 209
      self.callbacks.changed(self.collectionName, id, changed);                                                        // 210
    }                                                                                                                  // 211
  }                                                                                                                    // 212
});                                                                                                                    // 213
                                                                                                                       // 214
/******************************************************************************/                                       // 215
/* Session                                                                    */                                       // 216
/******************************************************************************/                                       // 217
                                                                                                                       // 218
var Session = function (server, version, socket) {                                                                     // 219
  var self = this;                                                                                                     // 220
  self.id = Random.id();                                                                                               // 221
                                                                                                                       // 222
  self.server = server;                                                                                                // 223
  self.version = version;                                                                                              // 224
                                                                                                                       // 225
  self.initialized = false;                                                                                            // 226
  self.socket = socket;                                                                                                // 227
                                                                                                                       // 228
  // set to null when the session is destroyed. multiple places below                                                  // 229
  // use this to determine if the session is alive or not.                                                             // 230
  self.inQueue = [];                                                                                                   // 231
                                                                                                                       // 232
  self.blocked = false;                                                                                                // 233
  self.workerRunning = false;                                                                                          // 234
                                                                                                                       // 235
  // Sub objects for active subscriptions                                                                              // 236
  self._namedSubs = {};                                                                                                // 237
  self._universalSubs = [];                                                                                            // 238
                                                                                                                       // 239
  self.userId = null;                                                                                                  // 240
                                                                                                                       // 241
  self.collectionViews = {};                                                                                           // 242
                                                                                                                       // 243
  // Set this to false to not send messages when collectionViews are                                                   // 244
  // modified. This is done when rerunning subs in _setUserId and those messages                                       // 245
  // are calculated via a diff instead.                                                                                // 246
  self._isSending = true;                                                                                              // 247
                                                                                                                       // 248
  // If this is true, don't start a newly-created universal publisher on this                                          // 249
  // session. The session will take care of starting it when appropriate.                                              // 250
  self._dontStartNewUniversalSubs = false;                                                                             // 251
                                                                                                                       // 252
  // when we are rerunning subscriptions, any ready messages                                                           // 253
  // we want to buffer up for when we are done rerunning subscriptions                                                 // 254
  self._pendingReady = [];                                                                                             // 255
                                                                                                                       // 256
  // List of callbacks to call when this connection is closed.                                                         // 257
  self._closeCallbacks = [];                                                                                           // 258
                                                                                                                       // 259
                                                                                                                       // 260
  // XXX HACK: If a sockjs connection, save off the URL. This is                                                       // 261
  // temporary and will go away in the near future.                                                                    // 262
  self._socketUrl = socket.url;                                                                                        // 263
                                                                                                                       // 264
  // This object is the public interface to the session. In the public                                                 // 265
  // API, it is called the `connection` object.  Internally we call it                                                 // 266
  // a `connectionHandle` to avoid ambiguity.                                                                          // 267
  self.connectionHandle = {                                                                                            // 268
    id: self.id,                                                                                                       // 269
    close: function () {                                                                                               // 270
      self.server._closeSession(self);                                                                                 // 271
    },                                                                                                                 // 272
    onClose: function (fn) {                                                                                           // 273
      var cb = Meteor.bindEnvironment(fn, "connection onClose callback");                                              // 274
      if (self.inQueue) {                                                                                              // 275
        self._closeCallbacks.push(cb);                                                                                 // 276
      } else {                                                                                                         // 277
        // if we're already closed, call the callback.                                                                 // 278
        Meteor.defer(cb);                                                                                              // 279
      }                                                                                                                // 280
    },                                                                                                                 // 281
    clientAddress: self._clientAddress(),                                                                              // 282
    httpHeaders: self.socket.headers                                                                                   // 283
  };                                                                                                                   // 284
                                                                                                                       // 285
  socket.send(stringifyDDP({msg: 'connected',                                                                          // 286
                            session: self.id}));                                                                       // 287
  // On initial connect, spin up all the universal publishers.                                                         // 288
  Fiber(function () {                                                                                                  // 289
    self.startUniversalSubs();                                                                                         // 290
  }).run();                                                                                                            // 291
                                                                                                                       // 292
  Package.facts && Package.facts.Facts.incrementServerFact(                                                            // 293
    "livedata", "sessions", 1);                                                                                        // 294
};                                                                                                                     // 295
                                                                                                                       // 296
_.extend(Session.prototype, {                                                                                          // 297
                                                                                                                       // 298
  sendReady: function (subscriptionIds) {                                                                              // 299
    var self = this;                                                                                                   // 300
    if (self._isSending)                                                                                               // 301
      self.send({msg: "ready", subs: subscriptionIds});                                                                // 302
    else {                                                                                                             // 303
      _.each(subscriptionIds, function (subscriptionId) {                                                              // 304
        self._pendingReady.push(subscriptionId);                                                                       // 305
      });                                                                                                              // 306
    }                                                                                                                  // 307
  },                                                                                                                   // 308
                                                                                                                       // 309
  sendAdded: function (collectionName, id, fields) {                                                                   // 310
    var self = this;                                                                                                   // 311
    if (self._isSending)                                                                                               // 312
      self.send({msg: "added", collection: collectionName, id: id, fields: fields});                                   // 313
  },                                                                                                                   // 314
                                                                                                                       // 315
  sendChanged: function (collectionName, id, fields) {                                                                 // 316
    var self = this;                                                                                                   // 317
    if (_.isEmpty(fields))                                                                                             // 318
      return;                                                                                                          // 319
                                                                                                                       // 320
    if (self._isSending) {                                                                                             // 321
      self.send({                                                                                                      // 322
        msg: "changed",                                                                                                // 323
        collection: collectionName,                                                                                    // 324
        id: id,                                                                                                        // 325
        fields: fields                                                                                                 // 326
      });                                                                                                              // 327
    }                                                                                                                  // 328
  },                                                                                                                   // 329
                                                                                                                       // 330
  sendRemoved: function (collectionName, id) {                                                                         // 331
    var self = this;                                                                                                   // 332
    if (self._isSending)                                                                                               // 333
      self.send({msg: "removed", collection: collectionName, id: id});                                                 // 334
  },                                                                                                                   // 335
                                                                                                                       // 336
  getSendCallbacks: function () {                                                                                      // 337
    var self = this;                                                                                                   // 338
    return {                                                                                                           // 339
      added: _.bind(self.sendAdded, self),                                                                             // 340
      changed: _.bind(self.sendChanged, self),                                                                         // 341
      removed: _.bind(self.sendRemoved, self)                                                                          // 342
    };                                                                                                                 // 343
  },                                                                                                                   // 344
                                                                                                                       // 345
  getCollectionView: function (collectionName) {                                                                       // 346
    var self = this;                                                                                                   // 347
    if (_.has(self.collectionViews, collectionName)) {                                                                 // 348
      return self.collectionViews[collectionName];                                                                     // 349
    }                                                                                                                  // 350
    var ret = new SessionCollectionView(collectionName,                                                                // 351
                                        self.getSendCallbacks());                                                      // 352
    self.collectionViews[collectionName] = ret;                                                                        // 353
    return ret;                                                                                                        // 354
  },                                                                                                                   // 355
                                                                                                                       // 356
  added: function (subscriptionHandle, collectionName, id, fields) {                                                   // 357
    var self = this;                                                                                                   // 358
    var view = self.getCollectionView(collectionName);                                                                 // 359
    view.added(subscriptionHandle, id, fields);                                                                        // 360
  },                                                                                                                   // 361
                                                                                                                       // 362
  removed: function (subscriptionHandle, collectionName, id) {                                                         // 363
    var self = this;                                                                                                   // 364
    var view = self.getCollectionView(collectionName);                                                                 // 365
    view.removed(subscriptionHandle, id);                                                                              // 366
    if (view.isEmpty()) {                                                                                              // 367
      delete self.collectionViews[collectionName];                                                                     // 368
    }                                                                                                                  // 369
  },                                                                                                                   // 370
                                                                                                                       // 371
  changed: function (subscriptionHandle, collectionName, id, fields) {                                                 // 372
    var self = this;                                                                                                   // 373
    var view = self.getCollectionView(collectionName);                                                                 // 374
    view.changed(subscriptionHandle, id, fields);                                                                      // 375
  },                                                                                                                   // 376
                                                                                                                       // 377
  startUniversalSubs: function () {                                                                                    // 378
    var self = this;                                                                                                   // 379
    // Make a shallow copy of the set of universal handlers and start them. If                                         // 380
    // additional universal publishers start while we're running them (due to                                          // 381
    // yielding), they will run separately as part of Server.publish.                                                  // 382
    var handlers = _.clone(self.server.universal_publish_handlers);                                                    // 383
    _.each(handlers, function (handler) {                                                                              // 384
      self._startSubscription(handler);                                                                                // 385
    });                                                                                                                // 386
  },                                                                                                                   // 387
                                                                                                                       // 388
  // Destroy this session. Stop all processing and tear everything                                                     // 389
  // down. If a socket was attached, close it.                                                                         // 390
  destroy: function () {                                                                                               // 391
    var self = this;                                                                                                   // 392
                                                                                                                       // 393
    if (self.socket) {                                                                                                 // 394
      self.socket.close();                                                                                             // 395
      self.socket._meteorSession = null;                                                                               // 396
    }                                                                                                                  // 397
                                                                                                                       // 398
    // Drop the merge box data immediately.                                                                            // 399
    self.collectionViews = {};                                                                                         // 400
    self.inQueue = null;                                                                                               // 401
                                                                                                                       // 402
    Package.facts && Package.facts.Facts.incrementServerFact(                                                          // 403
      "livedata", "sessions", -1);                                                                                     // 404
                                                                                                                       // 405
    Meteor.defer(function () {                                                                                         // 406
      // stop callbacks can yield, so we defer this on destroy.                                                        // 407
      // sub._isDeactivated() detects that we set inQueue to null and                                                  // 408
      // treats it as semi-deactivated (it will ignore incoming callbacks, etc).                                       // 409
      self._deactivateAllSubscriptions();                                                                              // 410
                                                                                                                       // 411
      // Defer calling the close callbacks, so that the caller closing                                                 // 412
      // the session isn't waiting for all the callbacks to complete.                                                  // 413
      _.each(self._closeCallbacks, function (callback) {                                                               // 414
        callback();                                                                                                    // 415
      });                                                                                                              // 416
    });                                                                                                                // 417
  },                                                                                                                   // 418
                                                                                                                       // 419
  // Send a message (doing nothing if no socket is connected right now.)                                               // 420
  // It should be a JSON object (it will be stringified.)                                                              // 421
  send: function (msg) {                                                                                               // 422
    var self = this;                                                                                                   // 423
    if (self.socket) {                                                                                                 // 424
      if (Meteor._printSentDDP)                                                                                        // 425
        Meteor._debug("Sent DDP", stringifyDDP(msg));                                                                  // 426
      self.socket.send(stringifyDDP(msg));                                                                             // 427
    }                                                                                                                  // 428
  },                                                                                                                   // 429
                                                                                                                       // 430
  // Send a connection error.                                                                                          // 431
  sendError: function (reason, offendingMessage) {                                                                     // 432
    var self = this;                                                                                                   // 433
    var msg = {msg: 'error', reason: reason};                                                                          // 434
    if (offendingMessage)                                                                                              // 435
      msg.offendingMessage = offendingMessage;                                                                         // 436
    self.send(msg);                                                                                                    // 437
  },                                                                                                                   // 438
                                                                                                                       // 439
  // Process 'msg' as an incoming message. (But as a guard against                                                     // 440
  // race conditions during reconnection, ignore the message if                                                        // 441
  // 'socket' is not the currently connected socket.)                                                                  // 442
  //                                                                                                                   // 443
  // We run the messages from the client one at a time, in the order                                                   // 444
  // given by the client. The message handler is passed an idempotent                                                  // 445
  // function 'unblock' which it may call to allow other messages to                                                   // 446
  // begin running in parallel in another fiber (for example, a method                                                 // 447
  // that wants to yield.) Otherwise, it is automatically unblocked                                                    // 448
  // when it returns.                                                                                                  // 449
  //                                                                                                                   // 450
  // Actually, we don't have to 'totally order' the messages in this                                                   // 451
  // way, but it's the easiest thing that's correct. (unsub needs to                                                   // 452
  // be ordered against sub, methods need to be ordered against each                                                   // 453
  // other.)                                                                                                           // 454
  processMessage: function (msg_in) {                                                                                  // 455
    var self = this;                                                                                                   // 456
    if (!self.inQueue) // we have been destroyed.                                                                      // 457
      return;                                                                                                          // 458
                                                                                                                       // 459
    self.inQueue.push(msg_in);                                                                                         // 460
    if (self.workerRunning)                                                                                            // 461
      return;                                                                                                          // 462
    self.workerRunning = true;                                                                                         // 463
                                                                                                                       // 464
    var processNext = function () {                                                                                    // 465
      var msg = self.inQueue && self.inQueue.shift();                                                                  // 466
      if (!msg) {                                                                                                      // 467
        self.workerRunning = false;                                                                                    // 468
        return;                                                                                                        // 469
      }                                                                                                                // 470
                                                                                                                       // 471
      Fiber(function () {                                                                                              // 472
        var blocked = true;                                                                                            // 473
                                                                                                                       // 474
        var unblock = function () {                                                                                    // 475
          if (!blocked)                                                                                                // 476
            return; // idempotent                                                                                      // 477
          blocked = false;                                                                                             // 478
          processNext();                                                                                               // 479
        };                                                                                                             // 480
                                                                                                                       // 481
        if (_.has(self.protocol_handlers, msg.msg))                                                                    // 482
          self.protocol_handlers[msg.msg].call(self, msg, unblock);                                                    // 483
        else                                                                                                           // 484
          self.sendError('Bad request', msg);                                                                          // 485
        unblock(); // in case the handler didn't already do it                                                         // 486
      }).run();                                                                                                        // 487
    };                                                                                                                 // 488
                                                                                                                       // 489
    processNext();                                                                                                     // 490
  },                                                                                                                   // 491
                                                                                                                       // 492
  protocol_handlers: {                                                                                                 // 493
    sub: function (msg) {                                                                                              // 494
      var self = this;                                                                                                 // 495
                                                                                                                       // 496
      // reject malformed messages                                                                                     // 497
      if (typeof (msg.id) !== "string" ||                                                                              // 498
          typeof (msg.name) !== "string" ||                                                                            // 499
          (('params' in msg) && !(msg.params instanceof Array))) {                                                     // 500
        self.sendError("Malformed subscription", msg);                                                                 // 501
        return;                                                                                                        // 502
      }                                                                                                                // 503
                                                                                                                       // 504
      if (!self.server.publish_handlers[msg.name]) {                                                                   // 505
        self.send({                                                                                                    // 506
          msg: 'nosub', id: msg.id,                                                                                    // 507
          error: new Meteor.Error(404, "Subscription not found")});                                                    // 508
        return;                                                                                                        // 509
      }                                                                                                                // 510
                                                                                                                       // 511
      if (_.has(self._namedSubs, msg.id))                                                                              // 512
        // subs are idempotent, or rather, they are ignored if a sub                                                   // 513
        // with that id already exists. this is important during                                                       // 514
        // reconnect.                                                                                                  // 515
        return;                                                                                                        // 516
                                                                                                                       // 517
      var handler = self.server.publish_handlers[msg.name];                                                            // 518
      self._startSubscription(handler, msg.id, msg.params, msg.name);                                                  // 519
                                                                                                                       // 520
    },                                                                                                                 // 521
                                                                                                                       // 522
    unsub: function (msg) {                                                                                            // 523
      var self = this;                                                                                                 // 524
                                                                                                                       // 525
      self._stopSubscription(msg.id);                                                                                  // 526
    },                                                                                                                 // 527
                                                                                                                       // 528
    method: function (msg, unblock) {                                                                                  // 529
      var self = this;                                                                                                 // 530
                                                                                                                       // 531
      // reject malformed messages                                                                                     // 532
      // XXX should also reject messages with unknown attributes?                                                      // 533
      if (typeof (msg.id) !== "string" ||                                                                              // 534
          typeof (msg.method) !== "string" ||                                                                          // 535
          (('params' in msg) && !(msg.params instanceof Array))) {                                                     // 536
        self.sendError("Malformed method invocation", msg);                                                            // 537
        return;                                                                                                        // 538
      }                                                                                                                // 539
                                                                                                                       // 540
      // set up to mark the method as satisfied once all observers                                                     // 541
      // (and subscriptions) have reacted to any writes that were                                                      // 542
      // done.                                                                                                         // 543
      var fence = new DDPServer._WriteFence;                                                                           // 544
      fence.onAllCommitted(function () {                                                                               // 545
        // Retire the fence so that future writes are allowed.                                                         // 546
        // This means that callbacks like timers are free to use                                                       // 547
        // the fence, and if they fire before it's armed (for                                                          // 548
        // example, because the method waits for them) their                                                           // 549
        // writes will be included in the fence.                                                                       // 550
        fence.retire();                                                                                                // 551
        self.send({                                                                                                    // 552
          msg: 'updated', methods: [msg.id]});                                                                         // 553
      });                                                                                                              // 554
                                                                                                                       // 555
      // find the handler                                                                                              // 556
      var handler = self.server.method_handlers[msg.method];                                                           // 557
      if (!handler) {                                                                                                  // 558
        self.send({                                                                                                    // 559
          msg: 'result', id: msg.id,                                                                                   // 560
          error: new Meteor.Error(404, "Method not found")});                                                          // 561
        fence.arm();                                                                                                   // 562
        return;                                                                                                        // 563
      }                                                                                                                // 564
                                                                                                                       // 565
      var setUserId = function(userId) {                                                                               // 566
        self._setUserId(userId);                                                                                       // 567
      };                                                                                                               // 568
                                                                                                                       // 569
      var invocation = new MethodInvocation({                                                                          // 570
        isSimulation: false,                                                                                           // 571
        userId: self.userId,                                                                                           // 572
        setUserId: setUserId,                                                                                          // 573
        unblock: unblock,                                                                                              // 574
        connection: self.connectionHandle                                                                              // 575
      });                                                                                                              // 576
      try {                                                                                                            // 577
        var result = DDPServer._CurrentWriteFence.withValue(fence, function () {                                       // 578
          return DDP._CurrentInvocation.withValue(invocation, function () {                                            // 579
            return maybeAuditArgumentChecks(                                                                           // 580
              handler, invocation, msg.params, "call to '" + msg.method + "'");                                        // 581
          });                                                                                                          // 582
        });                                                                                                            // 583
      } catch (e) {                                                                                                    // 584
        var exception = e;                                                                                             // 585
      }                                                                                                                // 586
                                                                                                                       // 587
      fence.arm(); // we're done adding writes to the fence                                                            // 588
      unblock(); // unblock, if the method hasn't done it already                                                      // 589
                                                                                                                       // 590
      exception = wrapInternalException(                                                                               // 591
        exception, "while invoking method '" + msg.method + "'");                                                      // 592
                                                                                                                       // 593
      // send response and add to cache                                                                                // 594
      var payload =                                                                                                    // 595
        exception ? {error: exception} : (result !== undefined ?                                                       // 596
                                          {result: result} : {});                                                      // 597
      self.send(_.extend({msg: 'result', id: msg.id}, payload));                                                       // 598
    }                                                                                                                  // 599
  },                                                                                                                   // 600
                                                                                                                       // 601
  _eachSub: function (f) {                                                                                             // 602
    var self = this;                                                                                                   // 603
    _.each(self._namedSubs, f);                                                                                        // 604
    _.each(self._universalSubs, f);                                                                                    // 605
  },                                                                                                                   // 606
                                                                                                                       // 607
  _diffCollectionViews: function (beforeCVs) {                                                                         // 608
    var self = this;                                                                                                   // 609
    LocalCollection._diffObjects(beforeCVs, self.collectionViews, {                                                    // 610
      both: function (collectionName, leftValue, rightValue) {                                                         // 611
        rightValue.diff(leftValue);                                                                                    // 612
      },                                                                                                               // 613
      rightOnly: function (collectionName, rightValue) {                                                               // 614
        _.each(rightValue.documents, function (docView, id) {                                                          // 615
          self.sendAdded(collectionName, id, docView.getFields());                                                     // 616
        });                                                                                                            // 617
      },                                                                                                               // 618
      leftOnly: function (collectionName, leftValue) {                                                                 // 619
        _.each(leftValue.documents, function (doc, id) {                                                               // 620
          self.sendRemoved(collectionName, id);                                                                        // 621
        });                                                                                                            // 622
      }                                                                                                                // 623
    });                                                                                                                // 624
  },                                                                                                                   // 625
                                                                                                                       // 626
  // Sets the current user id in all appropriate contexts and reruns                                                   // 627
  // all subscriptions                                                                                                 // 628
  _setUserId: function(userId) {                                                                                       // 629
    var self = this;                                                                                                   // 630
                                                                                                                       // 631
    if (userId !== null && typeof userId !== "string")                                                                 // 632
      throw new Error("setUserId must be called on string or null, not " +                                             // 633
                      typeof userId);                                                                                  // 634
                                                                                                                       // 635
    // Prevent newly-created universal subscriptions from being added to our                                           // 636
    // session; they will be found below when we call startUniversalSubs.                                              // 637
    //                                                                                                                 // 638
    // (We don't have to worry about named subscriptions, because we only add                                          // 639
    // them when we process a 'sub' message. We are currently processing a                                             // 640
    // 'method' message, and the method did not unblock, because it is illegal                                         // 641
    // to call setUserId after unblock. Thus we cannot be concurrently adding a                                        // 642
    // new named subscription.)                                                                                        // 643
    self._dontStartNewUniversalSubs = true;                                                                            // 644
                                                                                                                       // 645
    // Prevent current subs from updating our collectionViews and call their                                           // 646
    // stop callbacks. This may yield.                                                                                 // 647
    self._eachSub(function (sub) {                                                                                     // 648
      sub._deactivate();                                                                                               // 649
    });                                                                                                                // 650
                                                                                                                       // 651
    // All subs should now be deactivated. Stop sending messages to the client,                                        // 652
    // save the state of the published collections, reset to an empty view, and                                        // 653
    // update the userId.                                                                                              // 654
    self._isSending = false;                                                                                           // 655
    var beforeCVs = self.collectionViews;                                                                              // 656
    self.collectionViews = {};                                                                                         // 657
    self.userId = userId;                                                                                              // 658
                                                                                                                       // 659
    // Save the old named subs, and reset to having no subscriptions.                                                  // 660
    var oldNamedSubs = self._namedSubs;                                                                                // 661
    self._namedSubs = {};                                                                                              // 662
    self._universalSubs = [];                                                                                          // 663
                                                                                                                       // 664
    _.each(oldNamedSubs, function (sub, subscriptionId) {                                                              // 665
      self._namedSubs[subscriptionId] = sub._recreate();                                                               // 666
      // nb: if the handler throws or calls this.error(), it will in fact                                              // 667
      // immediately send its 'nosub'. This is OK, though.                                                             // 668
      self._namedSubs[subscriptionId]._runHandler();                                                                   // 669
    });                                                                                                                // 670
                                                                                                                       // 671
    // Allow newly-created universal subs to be started on our connection in                                           // 672
    // parallel with the ones we're spinning up here, and spin up universal                                            // 673
    // subs.                                                                                                           // 674
    self._dontStartNewUniversalSubs = false;                                                                           // 675
    self.startUniversalSubs();                                                                                         // 676
                                                                                                                       // 677
    // Start sending messages again, beginning with the diff from the previous                                         // 678
    // state of the world to the current state. No yields are allowed during                                           // 679
    // this diff, so that other changes cannot interleave.                                                             // 680
    Meteor._noYieldsAllowed(function () {                                                                              // 681
      self._isSending = true;                                                                                          // 682
      self._diffCollectionViews(beforeCVs);                                                                            // 683
      if (!_.isEmpty(self._pendingReady)) {                                                                            // 684
        self.sendReady(self._pendingReady);                                                                            // 685
        self._pendingReady = [];                                                                                       // 686
      }                                                                                                                // 687
    });                                                                                                                // 688
  },                                                                                                                   // 689
                                                                                                                       // 690
  _startSubscription: function (handler, subId, params, name) {                                                        // 691
    var self = this;                                                                                                   // 692
                                                                                                                       // 693
    var sub = new Subscription(                                                                                        // 694
      self, handler, subId, params, name);                                                                             // 695
    if (subId)                                                                                                         // 696
      self._namedSubs[subId] = sub;                                                                                    // 697
    else                                                                                                               // 698
      self._universalSubs.push(sub);                                                                                   // 699
                                                                                                                       // 700
    sub._runHandler();                                                                                                 // 701
  },                                                                                                                   // 702
                                                                                                                       // 703
  // tear down specified subscription                                                                                  // 704
  _stopSubscription: function (subId, error) {                                                                         // 705
    var self = this;                                                                                                   // 706
                                                                                                                       // 707
    if (subId && self._namedSubs[subId]) {                                                                             // 708
      self._namedSubs[subId]._removeAllDocuments();                                                                    // 709
      self._namedSubs[subId]._deactivate();                                                                            // 710
      delete self._namedSubs[subId];                                                                                   // 711
    }                                                                                                                  // 712
                                                                                                                       // 713
    var response = {msg: 'nosub', id: subId};                                                                          // 714
                                                                                                                       // 715
    if (error)                                                                                                         // 716
      response.error = wrapInternalException(error, "from sub " + subId);                                              // 717
                                                                                                                       // 718
    self.send(response);                                                                                               // 719
  },                                                                                                                   // 720
                                                                                                                       // 721
  // tear down all subscriptions. Note that this does NOT send removed or nosub                                        // 722
  // messages, since we assume the client is gone.                                                                     // 723
  _deactivateAllSubscriptions: function () {                                                                           // 724
    var self = this;                                                                                                   // 725
                                                                                                                       // 726
    _.each(self._namedSubs, function (sub, id) {                                                                       // 727
      sub._deactivate();                                                                                               // 728
    });                                                                                                                // 729
    self._namedSubs = {};                                                                                              // 730
                                                                                                                       // 731
    _.each(self._universalSubs, function (sub) {                                                                       // 732
      sub._deactivate();                                                                                               // 733
    });                                                                                                                // 734
    self._universalSubs = [];                                                                                          // 735
  },                                                                                                                   // 736
                                                                                                                       // 737
  // Determine the remote client's IP address, based on the                                                            // 738
  // HTTP_FORWARDED_COUNT environment variable representing how many                                                   // 739
  // proxies the server is behind.                                                                                     // 740
  _clientAddress: function () {                                                                                        // 741
    var self = this;                                                                                                   // 742
                                                                                                                       // 743
    // For the reported client address for a connection to be correct,                                                 // 744
    // the developer must set the HTTP_FORWARDED_COUNT environment                                                     // 745
    // variable to an integer representing the number of hops they                                                     // 746
    // expect in the `x-forwarded-for` header. E.g., set to "1" if the                                                 // 747
    // server is behind one proxy.                                                                                     // 748
    //                                                                                                                 // 749
    // This could be computed once at startup instead of every time.                                                   // 750
    var httpForwardedCount = parseInt(process.env['HTTP_FORWARDED_COUNT']) || 0;                                       // 751
                                                                                                                       // 752
    if (httpForwardedCount === 0)                                                                                      // 753
      return self.socket.remoteAddress;                                                                                // 754
                                                                                                                       // 755
    var forwardedFor = self.socket.headers["x-forwarded-for"];                                                         // 756
    if (! _.isString(forwardedFor))                                                                                    // 757
      return null;                                                                                                     // 758
    forwardedFor = forwardedFor.trim().split(/\s*,\s*/);                                                               // 759
                                                                                                                       // 760
    // Typically the first value in the `x-forwarded-for` header is                                                    // 761
    // the original IP address of the client connecting to the first                                                   // 762
    // proxy.  However, the end user can easily spoof the header, in                                                   // 763
    // which case the first value(s) will be the fake IP address from                                                  // 764
    // the user pretending to be a proxy reporting the original IP                                                     // 765
    // address value.  By counting HTTP_FORWARDED_COUNT back from the                                                  // 766
    // end of the list, we ensure that we get the IP address being                                                     // 767
    // reported by *our* first proxy.                                                                                  // 768
                                                                                                                       // 769
    if (httpForwardedCount < 0 || httpForwardedCount > forwardedFor.length)                                            // 770
      return null;                                                                                                     // 771
                                                                                                                       // 772
    return forwardedFor[forwardedFor.length - httpForwardedCount];                                                     // 773
  }                                                                                                                    // 774
});                                                                                                                    // 775
                                                                                                                       // 776
/******************************************************************************/                                       // 777
/* Subscription                                                               */                                       // 778
/******************************************************************************/                                       // 779
                                                                                                                       // 780
// ctor for a sub handle: the input to each publish function                                                           // 781
var Subscription = function (                                                                                          // 782
    session, handler, subscriptionId, params, name) {                                                                  // 783
  var self = this;                                                                                                     // 784
  self._session = session; // type is Session                                                                          // 785
  self.connection = session.connectionHandle; // public API object                                                     // 786
                                                                                                                       // 787
  self._handler = handler;                                                                                             // 788
                                                                                                                       // 789
  // my subscription ID (generated by client, undefined for universal subs).                                           // 790
  self._subscriptionId = subscriptionId;                                                                               // 791
  // undefined for universal subs                                                                                      // 792
  self._name = name;                                                                                                   // 793
                                                                                                                       // 794
  self._params = params || [];                                                                                         // 795
                                                                                                                       // 796
  // Only named subscriptions have IDs, but we need some sort of string                                                // 797
  // internally to keep track of all subscriptions inside                                                              // 798
  // SessionDocumentViews. We use this subscriptionHandle for that.                                                    // 799
  if (self._subscriptionId) {                                                                                          // 800
    self._subscriptionHandle = 'N' + self._subscriptionId;                                                             // 801
  } else {                                                                                                             // 802
    self._subscriptionHandle = 'U' + Random.id();                                                                      // 803
  }                                                                                                                    // 804
                                                                                                                       // 805
  // has _deactivate been called?                                                                                      // 806
  self._deactivated = false;                                                                                           // 807
                                                                                                                       // 808
  // stop callbacks to g/c this sub.  called w/ zero arguments.                                                        // 809
  self._stopCallbacks = [];                                                                                            // 810
                                                                                                                       // 811
  // the set of (collection, documentid) that this subscription has                                                    // 812
  // an opinion about                                                                                                  // 813
  self._documents = {};                                                                                                // 814
                                                                                                                       // 815
  // remember if we are ready.                                                                                         // 816
  self._ready = false;                                                                                                 // 817
                                                                                                                       // 818
  // Part of the public API: the user of this sub.                                                                     // 819
  self.userId = session.userId;                                                                                        // 820
                                                                                                                       // 821
  // For now, the id filter is going to default to                                                                     // 822
  // the to/from DDP methods on LocalCollection, to                                                                    // 823
  // specifically deal with mongo/minimongo ObjectIds.                                                                 // 824
                                                                                                                       // 825
  // Later, you will be able to make this be "raw"                                                                     // 826
  // if you want to publish a collection that you know                                                                 // 827
  // just has strings for keys and no funny business, to                                                               // 828
  // a ddp consumer that isn't minimongo                                                                               // 829
                                                                                                                       // 830
  self._idFilter = {                                                                                                   // 831
    idStringify: LocalCollection._idStringify,                                                                         // 832
    idParse: LocalCollection._idParse                                                                                  // 833
  };                                                                                                                   // 834
                                                                                                                       // 835
  Package.facts && Package.facts.Facts.incrementServerFact(                                                            // 836
    "livedata", "subscriptions", 1);                                                                                   // 837
};                                                                                                                     // 838
                                                                                                                       // 839
_.extend(Subscription.prototype, {                                                                                     // 840
  _runHandler: function () {                                                                                           // 841
    // XXX should we unblock() here? Either before running the publish                                                 // 842
    // function, or before running _publishCursor.                                                                     // 843
    //                                                                                                                 // 844
    // Right now, each publish function blocks all future publishes and                                                // 845
    // methods waiting on data from Mongo (or whatever else the function                                               // 846
    // blocks on). This probably slows page load in common cases.                                                      // 847
                                                                                                                       // 848
    var self = this;                                                                                                   // 849
    try {                                                                                                              // 850
      var res = maybeAuditArgumentChecks(                                                                              // 851
        self._handler, self, EJSON.clone(self._params),                                                                // 852
        "publisher '" + self._name + "'");                                                                             // 853
    } catch (e) {                                                                                                      // 854
      self.error(e);                                                                                                   // 855
      return;                                                                                                          // 856
    }                                                                                                                  // 857
                                                                                                                       // 858
    // Did the handler call this.error or this.stop?                                                                   // 859
    if (self._isDeactivated())                                                                                         // 860
      return;                                                                                                          // 861
                                                                                                                       // 862
    // SPECIAL CASE: Instead of writing their own callbacks that invoke                                                // 863
    // this.added/changed/ready/etc, the user can just return a collection                                             // 864
    // cursor or array of cursors from the publish function; we call their                                             // 865
    // _publishCursor method which starts observing the cursor and publishes the                                       // 866
    // results. Note that _publishCursor does NOT call ready().                                                        // 867
    //                                                                                                                 // 868
    // XXX This uses an undocumented interface which only the Mongo cursor                                             // 869
    // interface publishes. Should we make this interface public and encourage                                         // 870
    // users to implement it themselves? Arguably, it's unnecessary; users can                                         // 871
    // already write their own functions like                                                                          // 872
    //   var publishMyReactiveThingy = function (name, handler) {                                                      // 873
    //     Meteor.publish(name, function () {                                                                          // 874
    //       var reactiveThingy = handler();                                                                           // 875
    //       reactiveThingy.publishMe();                                                                               // 876
    //     });                                                                                                         // 877
    //   };                                                                                                            // 878
    var isCursor = function (c) {                                                                                      // 879
      return c && c._publishCursor;                                                                                    // 880
    };                                                                                                                 // 881
    if (isCursor(res)) {                                                                                               // 882
      res._publishCursor(self);                                                                                        // 883
      // _publishCursor only returns after the initial added callbacks have run.                                       // 884
      // mark subscription as ready.                                                                                   // 885
      self.ready();                                                                                                    // 886
    } else if (_.isArray(res)) {                                                                                       // 887
      // check all the elements are cursors                                                                            // 888
      if (! _.all(res, isCursor)) {                                                                                    // 889
        self.error(new Error("Publish function returned an array of non-Cursors"));                                    // 890
        return;                                                                                                        // 891
      }                                                                                                                // 892
      // find duplicate collection names                                                                               // 893
      // XXX we should support overlapping cursors, but that would require the                                         // 894
      // merge box to allow overlap within a subscription                                                              // 895
      var collectionNames = {};                                                                                        // 896
      for (var i = 0; i < res.length; ++i) {                                                                           // 897
        var collectionName = res[i]._getCollectionName();                                                              // 898
        if (_.has(collectionNames, collectionName)) {                                                                  // 899
          self.error(new Error(                                                                                        // 900
            "Publish function returned multiple cursors for collection " +                                             // 901
              collectionName));                                                                                        // 902
          return;                                                                                                      // 903
        }                                                                                                              // 904
        collectionNames[collectionName] = true;                                                                        // 905
      };                                                                                                               // 906
                                                                                                                       // 907
      _.each(res, function (cur) {                                                                                     // 908
        cur._publishCursor(self);                                                                                      // 909
      });                                                                                                              // 910
      self.ready();                                                                                                    // 911
    } else if (res) {                                                                                                  // 912
      // truthy values other than cursors or arrays are probably a                                                     // 913
      // user mistake (possible returning a Mongo document via, say,                                                   // 914
      // `coll.findOne()`).                                                                                            // 915
      self.error(new Error("Publish function can only return a Cursor or "                                             // 916
                           + "an array of Cursors"));                                                                  // 917
    }                                                                                                                  // 918
  },                                                                                                                   // 919
                                                                                                                       // 920
  // This calls all stop callbacks and prevents the handler from updating any                                          // 921
  // SessionCollectionViews further. It's used when the user unsubscribes or                                           // 922
  // disconnects, as well as during setUserId re-runs. It does *NOT* send                                              // 923
  // removed messages for the published objects; if that is necessary, call                                            // 924
  // _removeAllDocuments first.                                                                                        // 925
  _deactivate: function() {                                                                                            // 926
    var self = this;                                                                                                   // 927
    if (self._deactivated)                                                                                             // 928
      return;                                                                                                          // 929
    self._deactivated = true;                                                                                          // 930
    self._callStopCallbacks();                                                                                         // 931
    Package.facts && Package.facts.Facts.incrementServerFact(                                                          // 932
      "livedata", "subscriptions", -1);                                                                                // 933
  },                                                                                                                   // 934
                                                                                                                       // 935
  _callStopCallbacks: function () {                                                                                    // 936
    var self = this;                                                                                                   // 937
    // tell listeners, so they can clean up                                                                            // 938
    var callbacks = self._stopCallbacks;                                                                               // 939
    self._stopCallbacks = [];                                                                                          // 940
    _.each(callbacks, function (callback) {                                                                            // 941
      callback();                                                                                                      // 942
    });                                                                                                                // 943
  },                                                                                                                   // 944
                                                                                                                       // 945
  // Send remove messages for every document.                                                                          // 946
  _removeAllDocuments: function () {                                                                                   // 947
    var self = this;                                                                                                   // 948
    Meteor._noYieldsAllowed(function () {                                                                              // 949
      _.each(self._documents, function(collectionDocs, collectionName) {                                               // 950
        // Iterate over _.keys instead of the dictionary itself, since we'll be                                        // 951
        // mutating it.                                                                                                // 952
        _.each(_.keys(collectionDocs), function (strId) {                                                              // 953
          self.removed(collectionName, self._idFilter.idParse(strId));                                                 // 954
        });                                                                                                            // 955
      });                                                                                                              // 956
    });                                                                                                                // 957
  },                                                                                                                   // 958
                                                                                                                       // 959
  // Returns a new Subscription for the same session with the same                                                     // 960
  // initial creation parameters. This isn't a clone: it doesn't have                                                  // 961
  // the same _documents cache, stopped state or callbacks; may have a                                                 // 962
  // different _subscriptionHandle, and gets its userId from the                                                       // 963
  // session, not from this object.                                                                                    // 964
  _recreate: function () {                                                                                             // 965
    var self = this;                                                                                                   // 966
    return new Subscription(                                                                                           // 967
      self._session, self._handler, self._subscriptionId, self._params);                                               // 968
  },                                                                                                                   // 969
                                                                                                                       // 970
  error: function (error) {                                                                                            // 971
    var self = this;                                                                                                   // 972
    if (self._isDeactivated())                                                                                         // 973
      return;                                                                                                          // 974
    self._session._stopSubscription(self._subscriptionId, error);                                                      // 975
  },                                                                                                                   // 976
                                                                                                                       // 977
  // Note that while our DDP client will notice that you've called stop() on the                                       // 978
  // server (and clean up its _subscriptions table) we don't actually provide a                                        // 979
  // mechanism for an app to notice this (the subscribe onError callback only                                          // 980
  // triggers if there is an error).                                                                                   // 981
  stop: function () {                                                                                                  // 982
    var self = this;                                                                                                   // 983
    if (self._isDeactivated())                                                                                         // 984
      return;                                                                                                          // 985
    self._session._stopSubscription(self._subscriptionId);                                                             // 986
  },                                                                                                                   // 987
                                                                                                                       // 988
  onStop: function (callback) {                                                                                        // 989
    var self = this;                                                                                                   // 990
    if (self._isDeactivated())                                                                                         // 991
      callback();                                                                                                      // 992
    else                                                                                                               // 993
      self._stopCallbacks.push(callback);                                                                              // 994
  },                                                                                                                   // 995
                                                                                                                       // 996
  // This returns true if the sub has been deactivated, *OR* if the session was                                        // 997
  // destroyed but the deferred call to _deactivateAllSubscriptions hasn't                                             // 998
  // happened yet.                                                                                                     // 999
  _isDeactivated: function () {                                                                                        // 1000
    var self = this;                                                                                                   // 1001
    return self._deactivated || self._session.inQueue === null;                                                        // 1002
  },                                                                                                                   // 1003
                                                                                                                       // 1004
  added: function (collectionName, id, fields) {                                                                       // 1005
    var self = this;                                                                                                   // 1006
    if (self._isDeactivated())                                                                                         // 1007
      return;                                                                                                          // 1008
    id = self._idFilter.idStringify(id);                                                                               // 1009
    Meteor._ensure(self._documents, collectionName)[id] = true;                                                        // 1010
    self._session.added(self._subscriptionHandle, collectionName, id, fields);                                         // 1011
  },                                                                                                                   // 1012
                                                                                                                       // 1013
  changed: function (collectionName, id, fields) {                                                                     // 1014
    var self = this;                                                                                                   // 1015
    if (self._isDeactivated())                                                                                         // 1016
      return;                                                                                                          // 1017
    id = self._idFilter.idStringify(id);                                                                               // 1018
    self._session.changed(self._subscriptionHandle, collectionName, id, fields);                                       // 1019
  },                                                                                                                   // 1020
                                                                                                                       // 1021
  removed: function (collectionName, id) {                                                                             // 1022
    var self = this;                                                                                                   // 1023
    if (self._isDeactivated())                                                                                         // 1024
      return;                                                                                                          // 1025
    id = self._idFilter.idStringify(id);                                                                               // 1026
    // We don't bother to delete sets of things in a collection if the                                                 // 1027
    // collection is empty.  It could break _removeAllDocuments.                                                       // 1028
    delete self._documents[collectionName][id];                                                                        // 1029
    self._session.removed(self._subscriptionHandle, collectionName, id);                                               // 1030
  },                                                                                                                   // 1031
                                                                                                                       // 1032
  ready: function () {                                                                                                 // 1033
    var self = this;                                                                                                   // 1034
    if (self._isDeactivated())                                                                                         // 1035
      return;                                                                                                          // 1036
    if (!self._subscriptionId)                                                                                         // 1037
      return;  // unnecessary but ignored for universal sub                                                            // 1038
    if (!self._ready) {                                                                                                // 1039
      self._session.sendReady([self._subscriptionId]);                                                                 // 1040
      self._ready = true;                                                                                              // 1041
    }                                                                                                                  // 1042
  }                                                                                                                    // 1043
});                                                                                                                    // 1044
                                                                                                                       // 1045
/******************************************************************************/                                       // 1046
/* Server                                                                     */                                       // 1047
/******************************************************************************/                                       // 1048
                                                                                                                       // 1049
Server = function () {                                                                                                 // 1050
  var self = this;                                                                                                     // 1051
                                                                                                                       // 1052
  // Map of callbacks to call when a new connection comes in to the                                                    // 1053
  // server and completes DDP version negotiation. Use an object instead                                               // 1054
  // of an array so we can safely remove one from the list while                                                       // 1055
  // iterating over it.                                                                                                // 1056
  self.onConnectionHook = new Hook({                                                                                   // 1057
    debugPrintExceptions: "onConnection callback"                                                                      // 1058
  });                                                                                                                  // 1059
                                                                                                                       // 1060
  self.publish_handlers = {};                                                                                          // 1061
  self.universal_publish_handlers = [];                                                                                // 1062
                                                                                                                       // 1063
  self.method_handlers = {};                                                                                           // 1064
                                                                                                                       // 1065
  self.sessions = {}; // map from id to session                                                                        // 1066
                                                                                                                       // 1067
  self.stream_server = new StreamServer;                                                                               // 1068
                                                                                                                       // 1069
  self.stream_server.register(function (socket) {                                                                      // 1070
    // socket implements the SockJSConnection interface                                                                // 1071
    socket._meteorSession = null;                                                                                      // 1072
                                                                                                                       // 1073
    var sendError = function (reason, offendingMessage) {                                                              // 1074
      var msg = {msg: 'error', reason: reason};                                                                        // 1075
      if (offendingMessage)                                                                                            // 1076
        msg.offendingMessage = offendingMessage;                                                                       // 1077
      socket.send(stringifyDDP(msg));                                                                                  // 1078
    };                                                                                                                 // 1079
                                                                                                                       // 1080
    socket.on('data', function (raw_msg) {                                                                             // 1081
      if (Meteor._printReceivedDDP) {                                                                                  // 1082
        Meteor._debug("Received DDP", raw_msg);                                                                        // 1083
      }                                                                                                                // 1084
      try {                                                                                                            // 1085
        try {                                                                                                          // 1086
          var msg = parseDDP(raw_msg);                                                                                 // 1087
        } catch (err) {                                                                                                // 1088
          sendError('Parse error');                                                                                    // 1089
          return;                                                                                                      // 1090
        }                                                                                                              // 1091
        if (msg === null || !msg.msg) {                                                                                // 1092
          sendError('Bad request', msg);                                                                               // 1093
          return;                                                                                                      // 1094
        }                                                                                                              // 1095
                                                                                                                       // 1096
        if (msg.msg === 'connect') {                                                                                   // 1097
          if (socket._meteorSession) {                                                                                 // 1098
            sendError("Already connected", msg);                                                                       // 1099
            return;                                                                                                    // 1100
          }                                                                                                            // 1101
          Fiber(function () {                                                                                          // 1102
            self._handleConnect(socket, msg);                                                                          // 1103
          }).run();                                                                                                    // 1104
          return;                                                                                                      // 1105
        }                                                                                                              // 1106
                                                                                                                       // 1107
        if (!socket._meteorSession) {                                                                                  // 1108
          sendError('Must connect first', msg);                                                                        // 1109
          return;                                                                                                      // 1110
        }                                                                                                              // 1111
        socket._meteorSession.processMessage(msg);                                                                     // 1112
      } catch (e) {                                                                                                    // 1113
        // XXX print stack nicely                                                                                      // 1114
        Meteor._debug("Internal exception while processing message", msg,                                              // 1115
                      e.message, e.stack);                                                                             // 1116
      }                                                                                                                // 1117
    });                                                                                                                // 1118
                                                                                                                       // 1119
    socket.on('close', function () {                                                                                   // 1120
      if (socket._meteorSession) {                                                                                     // 1121
        Fiber(function () {                                                                                            // 1122
          self._closeSession(socket._meteorSession);                                                                   // 1123
        }).run();                                                                                                      // 1124
      }                                                                                                                // 1125
    });                                                                                                                // 1126
  });                                                                                                                  // 1127
};                                                                                                                     // 1128
                                                                                                                       // 1129
_.extend(Server.prototype, {                                                                                           // 1130
                                                                                                                       // 1131
  onConnection: function (fn) {                                                                                        // 1132
    var self = this;                                                                                                   // 1133
    return self.onConnectionHook.register(fn);                                                                         // 1134
  },                                                                                                                   // 1135
                                                                                                                       // 1136
  _handleConnect: function (socket, msg) {                                                                             // 1137
    var self = this;                                                                                                   // 1138
    // In the future, handle session resumption: something like:                                                       // 1139
    //  socket._meteorSession = self.sessions[msg.session]                                                             // 1140
    var version = calculateVersion(msg.support, SUPPORTED_DDP_VERSIONS);                                               // 1141
                                                                                                                       // 1142
    if (msg.version === version) {                                                                                     // 1143
      // Creating a new session                                                                                        // 1144
      socket._meteorSession = new Session(self, version, socket);                                                      // 1145
      self.sessions[socket._meteorSession.id] = socket._meteorSession;                                                 // 1146
      self.onConnectionHook.each(function (callback) {                                                                 // 1147
        if (socket._meteorSession)                                                                                     // 1148
          callback(socket._meteorSession.connectionHandle);                                                            // 1149
        return true;                                                                                                   // 1150
      });                                                                                                              // 1151
    } else if (!msg.version) {                                                                                         // 1152
      // connect message without a version. This means an old (pre-pre1)                                               // 1153
      // client is trying to connect. If we just disconnect the                                                        // 1154
      // connection, they'll retry right away. Instead, just pause for a                                               // 1155
      // bit (randomly distributed so as to avoid synchronized swarms)                                                 // 1156
      // and hold the connection open.                                                                                 // 1157
      var timeout = 1000 * (30 + Random.fraction() * 60);                                                              // 1158
      // drop all future data coming over this connection on the                                                       // 1159
      // floor. We don't want to confuse things.                                                                       // 1160
      socket.removeAllListeners('data');                                                                               // 1161
      Meteor.setTimeout(function () {                                                                                  // 1162
        socket.send(stringifyDDP({msg: 'failed', version: version}));                                                  // 1163
        socket.close();                                                                                                // 1164
      }, timeout);                                                                                                     // 1165
    } else {                                                                                                           // 1166
      socket.send(stringifyDDP({msg: 'failed', version: version}));                                                    // 1167
      socket.close();                                                                                                  // 1168
    }                                                                                                                  // 1169
  },                                                                                                                   // 1170
  /**                                                                                                                  // 1171
   * Register a publish handler function.                                                                              // 1172
   *                                                                                                                   // 1173
   * @param name {String} identifier for query                                                                         // 1174
   * @param handler {Function} publish handler                                                                         // 1175
   * @param options {Object}                                                                                           // 1176
   *                                                                                                                   // 1177
   * Server will call handler function on each new subscription,                                                       // 1178
   * either when receiving DDP sub message for a named subscription, or on                                             // 1179
   * DDP connect for a universal subscription.                                                                         // 1180
   *                                                                                                                   // 1181
   * If name is null, this will be a subscription that is                                                              // 1182
   * automatically established and permanently on for all connected                                                    // 1183
   * client, instead of a subscription that can be turned on and off                                                   // 1184
   * with subscribe().                                                                                                 // 1185
   *                                                                                                                   // 1186
   * options to contain:                                                                                               // 1187
   *  - (mostly internal) is_auto: true if generated automatically                                                     // 1188
   *    from an autopublish hook. this is for cosmetic purposes only                                                   // 1189
   *    (it lets us determine whether to print a warning suggesting                                                    // 1190
   *    that you turn off autopublish.)                                                                                // 1191
   */                                                                                                                  // 1192
  publish: function (name, handler, options) {                                                                         // 1193
    var self = this;                                                                                                   // 1194
                                                                                                                       // 1195
    options = options || {};                                                                                           // 1196
                                                                                                                       // 1197
    if (name && name in self.publish_handlers) {                                                                       // 1198
      Meteor._debug("Ignoring duplicate publish named '" + name + "'");                                                // 1199
      return;                                                                                                          // 1200
    }                                                                                                                  // 1201
                                                                                                                       // 1202
    if (Package.autopublish && !options.is_auto) {                                                                     // 1203
      // They have autopublish on, yet they're trying to manually                                                      // 1204
      // picking stuff to publish. They probably should turn off                                                       // 1205
      // autopublish. (This check isn't perfect -- if you create a                                                     // 1206
      // publish before you turn on autopublish, it won't catch                                                        // 1207
      // it. But this will definitely handle the simple case where                                                     // 1208
      // you've added the autopublish package to your app, and are                                                     // 1209
      // calling publish from your app code.)                                                                          // 1210
      if (!self.warned_about_autopublish) {                                                                            // 1211
        self.warned_about_autopublish = true;                                                                          // 1212
        Meteor._debug(                                                                                                 // 1213
"** You've set up some data subscriptions with Meteor.publish(), but\n" +                                              // 1214
"** you still have autopublish turned on. Because autopublish is still\n" +                                            // 1215
"** on, your Meteor.publish() calls won't have much effect. All data\n" +                                              // 1216
"** will still be sent to all clients.\n" +                                                                            // 1217
"**\n" +                                                                                                               // 1218
"** Turn off autopublish by removing the autopublish package:\n" +                                                     // 1219
"**\n" +                                                                                                               // 1220
"**   $ meteor remove autopublish\n" +                                                                                 // 1221
"**\n" +                                                                                                               // 1222
"** .. and make sure you have Meteor.publish() and Meteor.subscribe() calls\n" +                                       // 1223
"** for each collection that you want clients to see.\n");                                                             // 1224
      }                                                                                                                // 1225
    }                                                                                                                  // 1226
                                                                                                                       // 1227
    if (name)                                                                                                          // 1228
      self.publish_handlers[name] = handler;                                                                           // 1229
    else {                                                                                                             // 1230
      self.universal_publish_handlers.push(handler);                                                                   // 1231
      // Spin up the new publisher on any existing session too. Run each                                               // 1232
      // session's subscription in a new Fiber, so that there's no change for                                          // 1233
      // self.sessions to change while we're running this loop.                                                        // 1234
      _.each(self.sessions, function (session) {                                                                       // 1235
        if (!session._dontStartNewUniversalSubs) {                                                                     // 1236
          Fiber(function() {                                                                                           // 1237
            session._startSubscription(handler);                                                                       // 1238
          }).run();                                                                                                    // 1239
        }                                                                                                              // 1240
      });                                                                                                              // 1241
    }                                                                                                                  // 1242
  },                                                                                                                   // 1243
                                                                                                                       // 1244
  _closeSession: function (session) {                                                                                  // 1245
    var self = this;                                                                                                   // 1246
    if (self.sessions[session.id]) {                                                                                   // 1247
      delete self.sessions[session.id];                                                                                // 1248
      session.destroy();                                                                                               // 1249
    }                                                                                                                  // 1250
  },                                                                                                                   // 1251
                                                                                                                       // 1252
  methods: function (methods) {                                                                                        // 1253
    var self = this;                                                                                                   // 1254
    _.each(methods, function (func, name) {                                                                            // 1255
      if (self.method_handlers[name])                                                                                  // 1256
        throw new Error("A method named '" + name + "' is already defined");                                           // 1257
      self.method_handlers[name] = func;                                                                               // 1258
    });                                                                                                                // 1259
  },                                                                                                                   // 1260
                                                                                                                       // 1261
  call: function (name /*, arguments */) {                                                                             // 1262
    // if it's a function, the last argument is the result callback,                                                   // 1263
    // not a parameter to the remote method.                                                                           // 1264
    var args = Array.prototype.slice.call(arguments, 1);                                                               // 1265
    if (args.length && typeof args[args.length - 1] === "function")                                                    // 1266
      var callback = args.pop();                                                                                       // 1267
    return this.apply(name, args, callback);                                                                           // 1268
  },                                                                                                                   // 1269
                                                                                                                       // 1270
  // @param options {Optional Object}                                                                                  // 1271
  // @param callback {Optional Function}                                                                               // 1272
  apply: function (name, args, options, callback) {                                                                    // 1273
    var self = this;                                                                                                   // 1274
                                                                                                                       // 1275
    // We were passed 3 arguments. They may be either (name, args, options)                                            // 1276
    // or (name, args, callback)                                                                                       // 1277
    if (!callback && typeof options === 'function') {                                                                  // 1278
      callback = options;                                                                                              // 1279
      options = {};                                                                                                    // 1280
    }                                                                                                                  // 1281
    options = options || {};                                                                                           // 1282
                                                                                                                       // 1283
    if (callback)                                                                                                      // 1284
      // It's not really necessary to do this, since we immediately                                                    // 1285
      // run the callback in this fiber before returning, but we do it                                                 // 1286
      // anyway for regularity.                                                                                        // 1287
      // XXX improve error message (and how we report it)                                                              // 1288
      callback = Meteor.bindEnvironment(                                                                               // 1289
        callback,                                                                                                      // 1290
        "delivering result of invoking '" + name + "'"                                                                 // 1291
      );                                                                                                               // 1292
                                                                                                                       // 1293
    // Run the handler                                                                                                 // 1294
    var handler = self.method_handlers[name];                                                                          // 1295
    var exception;                                                                                                     // 1296
    if (!handler) {                                                                                                    // 1297
      exception = new Meteor.Error(404, "Method not found");                                                           // 1298
    } else {                                                                                                           // 1299
      // If this is a method call from within another method, get the                                                  // 1300
      // user state from the outer method, otherwise don't allow                                                       // 1301
      // setUserId to be called                                                                                        // 1302
      var userId = null;                                                                                               // 1303
      var setUserId = function() {                                                                                     // 1304
        throw new Error("Can't call setUserId on a server initiated method call");                                     // 1305
      };                                                                                                               // 1306
      var connection = null;                                                                                           // 1307
      var currentInvocation = DDP._CurrentInvocation.get();                                                            // 1308
      if (currentInvocation) {                                                                                         // 1309
        userId = currentInvocation.userId;                                                                             // 1310
        setUserId = function(userId) {                                                                                 // 1311
          currentInvocation.setUserId(userId);                                                                         // 1312
        };                                                                                                             // 1313
        connection = currentInvocation.connection;                                                                     // 1314
      }                                                                                                                // 1315
                                                                                                                       // 1316
      var invocation = new MethodInvocation({                                                                          // 1317
        isSimulation: false,                                                                                           // 1318
        userId: userId,                                                                                                // 1319
        setUserId: setUserId,                                                                                          // 1320
        connection: connection                                                                                         // 1321
      });                                                                                                              // 1322
      try {                                                                                                            // 1323
        var result = DDP._CurrentInvocation.withValue(invocation, function () {                                        // 1324
          return maybeAuditArgumentChecks(                                                                             // 1325
            handler, invocation, args, "internal call to '" + name + "'");                                             // 1326
        });                                                                                                            // 1327
      } catch (e) {                                                                                                    // 1328
        exception = e;                                                                                                 // 1329
      }                                                                                                                // 1330
    }                                                                                                                  // 1331
                                                                                                                       // 1332
    // Return the result in whichever way the caller asked for it. Note that we                                        // 1333
    // do NOT block on the write fence in an analogous way to how the client                                           // 1334
    // blocks on the relevant data being visible, so you are NOT guaranteed that                                       // 1335
    // cursor observe callbacks have fired when your callback is invoked. (We                                          // 1336
    // can change this if there's a real use case.)                                                                    // 1337
    if (callback) {                                                                                                    // 1338
      callback(exception, result);                                                                                     // 1339
      return undefined;                                                                                                // 1340
    }                                                                                                                  // 1341
    if (exception)                                                                                                     // 1342
      throw exception;                                                                                                 // 1343
    return result;                                                                                                     // 1344
  },                                                                                                                   // 1345
                                                                                                                       // 1346
  _urlForSession: function (sessionId) {                                                                               // 1347
    var self = this;                                                                                                   // 1348
    var session = self.sessions[sessionId];                                                                            // 1349
    if (session)                                                                                                       // 1350
      return session._socketUrl;                                                                                       // 1351
    else                                                                                                               // 1352
      return null;                                                                                                     // 1353
  }                                                                                                                    // 1354
});                                                                                                                    // 1355
                                                                                                                       // 1356
var calculateVersion = function (clientSupportedVersions,                                                              // 1357
                                 serverSupportedVersions) {                                                            // 1358
  var correctVersion = _.find(clientSupportedVersions, function (version) {                                            // 1359
    return _.contains(serverSupportedVersions, version);                                                               // 1360
  });                                                                                                                  // 1361
  if (!correctVersion) {                                                                                               // 1362
    correctVersion = serverSupportedVersions[0];                                                                       // 1363
  }                                                                                                                    // 1364
  return correctVersion;                                                                                               // 1365
};                                                                                                                     // 1366
                                                                                                                       // 1367
LivedataTest.calculateVersion = calculateVersion;                                                                      // 1368
                                                                                                                       // 1369
                                                                                                                       // 1370
// "blind" exceptions other than those that were deliberately thrown to signal                                         // 1371
// errors to the client                                                                                                // 1372
var wrapInternalException = function (exception, context) {                                                            // 1373
  if (!exception || exception instanceof Meteor.Error)                                                                 // 1374
    return exception;                                                                                                  // 1375
                                                                                                                       // 1376
  // Did the error contain more details that could have been useful if caught in                                       // 1377
  // server code (or if thrown from non-client-originated code), but also                                              // 1378
  // provided a "sanitized" version with more context than 500 Internal server                                         // 1379
  // error? Use that.                                                                                                  // 1380
  if (exception.sanitizedError) {                                                                                      // 1381
    if (exception.sanitizedError instanceof Meteor.Error)                                                              // 1382
      return exception.sanitizedError;                                                                                 // 1383
    Meteor._debug("Exception " + context + " provides a sanitizedError that " +                                        // 1384
                  "is not a Meteor.Error; ignoring");                                                                  // 1385
  }                                                                                                                    // 1386
                                                                                                                       // 1387
  // tests can set the 'expected' flag on an exception so it won't go to the                                           // 1388
  // server log                                                                                                        // 1389
  if (!exception.expected)                                                                                             // 1390
    Meteor._debug("Exception " + context, exception.stack);                                                            // 1391
                                                                                                                       // 1392
  return new Meteor.Error(500, "Internal server error");                                                               // 1393
};                                                                                                                     // 1394
                                                                                                                       // 1395
                                                                                                                       // 1396
// Audit argument checks, if the audit-argument-checks package exists (it is a                                         // 1397
// weak dependency of this package).                                                                                   // 1398
var maybeAuditArgumentChecks = function (f, context, args, description) {                                              // 1399
  args = args || [];                                                                                                   // 1400
  if (Package['audit-argument-checks']) {                                                                              // 1401
    return Match._failIfArgumentsAreNotAllChecked(                                                                     // 1402
      f, context, args, description);                                                                                  // 1403
  }                                                                                                                    // 1404
  return f.apply(context, args);                                                                                       // 1405
};                                                                                                                     // 1406
                                                                                                                       // 1407
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/writefence.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var path = Npm.require('path');                                                                                        // 1
var Future = Npm.require(path.join('fibers', 'future'));                                                               // 2
                                                                                                                       // 3
// A write fence collects a group of writes, and provides a callback                                                   // 4
// when all of the writes are fully committed and propagated (all                                                      // 5
// observers have been notified of the write and acknowledged it.)                                                     // 6
//                                                                                                                     // 7
DDPServer._WriteFence = function () {                                                                                  // 8
  var self = this;                                                                                                     // 9
                                                                                                                       // 10
  self.armed = false;                                                                                                  // 11
  self.fired = false;                                                                                                  // 12
  self.retired = false;                                                                                                // 13
  self.outstanding_writes = 0;                                                                                         // 14
  self.completion_callbacks = [];                                                                                      // 15
};                                                                                                                     // 16
                                                                                                                       // 17
// The current write fence. When there is a current write fence, code                                                  // 18
// that writes to databases should register their writes with it using                                                 // 19
// beginWrite().                                                                                                       // 20
//                                                                                                                     // 21
DDPServer._CurrentWriteFence = new Meteor.EnvironmentVariable;                                                         // 22
                                                                                                                       // 23
_.extend(DDPServer._WriteFence.prototype, {                                                                            // 24
  // Start tracking a write, and return an object to represent it. The                                                 // 25
  // object has a single method, committed(). This method should be                                                    // 26
  // called when the write is fully committed and propagated. You can                                                  // 27
  // continue to add writes to the WriteFence up until it is triggered                                                 // 28
  // (calls its callbacks because all writes have committed.)                                                          // 29
  beginWrite: function () {                                                                                            // 30
    var self = this;                                                                                                   // 31
                                                                                                                       // 32
    if (self.retired)                                                                                                  // 33
      return { committed: function () {} };                                                                            // 34
                                                                                                                       // 35
    if (self.fired)                                                                                                    // 36
      throw new Error("fence has already activated -- too late to add writes");                                        // 37
                                                                                                                       // 38
    self.outstanding_writes++;                                                                                         // 39
    var committed = false;                                                                                             // 40
    return {                                                                                                           // 41
      committed: function () {                                                                                         // 42
        if (committed)                                                                                                 // 43
          throw new Error("committed called twice on the same write");                                                 // 44
        committed = true;                                                                                              // 45
        self.outstanding_writes--;                                                                                     // 46
        self._maybeFire();                                                                                             // 47
      }                                                                                                                // 48
    };                                                                                                                 // 49
  },                                                                                                                   // 50
                                                                                                                       // 51
  // Arm the fence. Once the fence is armed, and there are no more                                                     // 52
  // uncommitted writes, it will activate.                                                                             // 53
  arm: function () {                                                                                                   // 54
    var self = this;                                                                                                   // 55
    if (self === DDPServer._CurrentWriteFence.get())                                                                   // 56
      throw Error("Can't arm the current fence");                                                                      // 57
    self.armed = true;                                                                                                 // 58
    self._maybeFire();                                                                                                 // 59
  },                                                                                                                   // 60
                                                                                                                       // 61
  // Register a function to be called when the fence fires.                                                            // 62
  onAllCommitted: function (func) {                                                                                    // 63
    var self = this;                                                                                                   // 64
    if (self.fired)                                                                                                    // 65
      throw new Error("fence has already activated -- too late to " +                                                  // 66
                      "add a callback");                                                                               // 67
    self.completion_callbacks.push(func);                                                                              // 68
  },                                                                                                                   // 69
                                                                                                                       // 70
  // Convenience function. Arms the fence, then blocks until it fires.                                                 // 71
  armAndWait: function () {                                                                                            // 72
    var self = this;                                                                                                   // 73
    var future = new Future;                                                                                           // 74
    self.onAllCommitted(function () {                                                                                  // 75
      future['return']();                                                                                              // 76
    });                                                                                                                // 77
    self.arm();                                                                                                        // 78
    future.wait();                                                                                                     // 79
  },                                                                                                                   // 80
                                                                                                                       // 81
  _maybeFire: function () {                                                                                            // 82
    var self = this;                                                                                                   // 83
    if (self.fired)                                                                                                    // 84
      throw new Error("write fence already activated?");                                                               // 85
    if (self.armed && !self.outstanding_writes) {                                                                      // 86
      self.fired = true;                                                                                               // 87
      _.each(self.completion_callbacks, function (f) {f(self);});                                                      // 88
      self.completion_callbacks = [];                                                                                  // 89
    }                                                                                                                  // 90
  },                                                                                                                   // 91
                                                                                                                       // 92
  // Deactivate this fence so that adding more writes has no effect.                                                   // 93
  // The fence must have already fired.                                                                                // 94
  retire: function () {                                                                                                // 95
    var self = this;                                                                                                   // 96
    if (! self.fired)                                                                                                  // 97
      throw new Error("Can't retire a fence that hasn't fired.");                                                      // 98
    self.retired = true;                                                                                               // 99
  }                                                                                                                    // 100
});                                                                                                                    // 101
                                                                                                                       // 102
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/crossbar.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// A "crossbar" is a class that provides structured notification registration.                                         // 1
                                                                                                                       // 2
DDPServer._Crossbar = function (options) {                                                                             // 3
  var self = this;                                                                                                     // 4
  options = options || {};                                                                                             // 5
                                                                                                                       // 6
  self.nextId = 1;                                                                                                     // 7
  // map from listener id to object. each object has keys 'trigger',                                                   // 8
  // 'callback'.                                                                                                       // 9
  self.listeners = {};                                                                                                 // 10
  self.factPackage = options.factPackage || "livedata";                                                                // 11
  self.factName = options.factName || null;                                                                            // 12
};                                                                                                                     // 13
                                                                                                                       // 14
_.extend(DDPServer._Crossbar.prototype, {                                                                              // 15
  // Listen for notification that match 'trigger'. A notification                                                      // 16
  // matches if it has the key-value pairs in trigger as a                                                             // 17
  // subset. When a notification matches, call 'callback', passing                                                     // 18
  // the actual notification.                                                                                          // 19
  //                                                                                                                   // 20
  // Returns a listen handle, which is an object with a method                                                         // 21
  // stop(). Call stop() to stop listening.                                                                            // 22
  //                                                                                                                   // 23
  // XXX It should be legal to call fire() from inside a listen()                                                      // 24
  // callback?                                                                                                         // 25
  listen: function (trigger, callback) {                                                                               // 26
    var self = this;                                                                                                   // 27
    var id = self.nextId++;                                                                                            // 28
    self.listeners[id] = {trigger: EJSON.clone(trigger), callback: callback};                                          // 29
    if (self.factName && Package.facts) {                                                                              // 30
      Package.facts.Facts.incrementServerFact(                                                                         // 31
        self.factPackage, self.factName, 1);                                                                           // 32
    }                                                                                                                  // 33
    return {                                                                                                           // 34
      stop: function () {                                                                                              // 35
        if (self.factName && Package.facts) {                                                                          // 36
          Package.facts.Facts.incrementServerFact(                                                                     // 37
            self.factPackage, self.factName, -1);                                                                      // 38
        }                                                                                                              // 39
        delete self.listeners[id];                                                                                     // 40
      }                                                                                                                // 41
    };                                                                                                                 // 42
  },                                                                                                                   // 43
                                                                                                                       // 44
  // Fire the provided 'notification' (an object whose attribute                                                       // 45
  // values are all JSON-compatibile) -- inform all matching listeners                                                 // 46
  // (registered with listen()).                                                                                       // 47
  //                                                                                                                   // 48
  // If fire() is called inside a write fence, then each of the                                                        // 49
  // listener callbacks will be called inside the write fence as well.                                                 // 50
  //                                                                                                                   // 51
  // The listeners may be invoked in parallel, rather than serially.                                                   // 52
  fire: function (notification) {                                                                                      // 53
    var self = this;                                                                                                   // 54
    // Listener callbacks can yield, so we need to first find all the ones that                                        // 55
    // match in a single iteration over self.listeners (which can't be mutated                                         // 56
    // during this iteration), and then invoke the matching callbacks, checking                                        // 57
    // before each call to ensure they are still in self.listeners.                                                    // 58
    var matchingCallbacks = {};                                                                                        // 59
    // XXX consider refactoring to "index" on "collection"                                                             // 60
    _.each(self.listeners, function (l, id) {                                                                          // 61
      if (self._matches(notification, l.trigger))                                                                      // 62
        matchingCallbacks[id] = l.callback;                                                                            // 63
    });                                                                                                                // 64
                                                                                                                       // 65
    _.each(matchingCallbacks, function (c, id) {                                                                       // 66
      if (_.has(self.listeners, id))                                                                                   // 67
        c(notification);                                                                                               // 68
    });                                                                                                                // 69
  },                                                                                                                   // 70
                                                                                                                       // 71
  // A notification matches a trigger if all keys that exist in both are equal.                                        // 72
  //                                                                                                                   // 73
  // Examples:                                                                                                         // 74
  //  N:{collection: "C"} matches T:{collection: "C"}                                                                  // 75
  //    (a non-targeted write to a collection matches a                                                                // 76
  //     non-targeted query)                                                                                           // 77
  //  N:{collection: "C", id: "X"} matches T:{collection: "C"}                                                         // 78
  //    (a targeted write to a collection matches a non-targeted query)                                                // 79
  //  N:{collection: "C"} matches T:{collection: "C", id: "X"}                                                         // 80
  //    (a non-targeted write to a collection matches a                                                                // 81
  //     targeted query)                                                                                               // 82
  //  N:{collection: "C", id: "X"} matches T:{collection: "C", id: "X"}                                                // 83
  //    (a targeted write to a collection matches a targeted query targeted                                            // 84
  //     at the same document)                                                                                         // 85
  //  N:{collection: "C", id: "X"} does not match T:{collection: "C", id: "Y"}                                         // 86
  //    (a targeted write to a collection does not match a targeted query                                              // 87
  //     targeted at a different document)                                                                             // 88
  _matches: function (notification, trigger) {                                                                         // 89
    return _.all(trigger, function (triggerValue, key) {                                                               // 90
      return !_.has(notification, key) ||                                                                              // 91
        EJSON.equals(triggerValue, notification[key]);                                                                 // 92
    });                                                                                                                // 93
  }                                                                                                                    // 94
});                                                                                                                    // 95
                                                                                                                       // 96
// The "invalidation crossbar" is a specific instance used by the DDP server to                                        // 97
// implement write fence notifications. Listener callbacks on this crossbar                                            // 98
// should call beginWrite on the current write fence before they return, if they                                       // 99
// want to delay the write fence from firing (ie, the DDP method-data-updated                                          // 100
// message from being sent).                                                                                           // 101
DDPServer._InvalidationCrossbar = new DDPServer._Crossbar({                                                            // 102
  factName: "invalidation-crossbar-listeners"                                                                          // 103
});                                                                                                                    // 104
                                                                                                                       // 105
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/livedata_common.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
DDP = {};                                                                                                              // 1
                                                                                                                       // 2
SUPPORTED_DDP_VERSIONS = [ 'pre1' ];                                                                                   // 3
                                                                                                                       // 4
LivedataTest.SUPPORTED_DDP_VERSIONS = SUPPORTED_DDP_VERSIONS;                                                          // 5
                                                                                                                       // 6
MethodInvocation = function (options) {                                                                                // 7
  var self = this;                                                                                                     // 8
                                                                                                                       // 9
  // true if we're running not the actual method, but a stub (that is,                                                 // 10
  // if we're on a client (which may be a browser, or in the future a                                                  // 11
  // server connecting to another server) and presently running a                                                      // 12
  // simulation of a server-side method for latency compensation                                                       // 13
  // purposes). not currently true except in a client such as a browser,                                               // 14
  // since there's usually no point in running stubs unless you have a                                                 // 15
  // zero-latency connection to the user.                                                                              // 16
  this.isSimulation = options.isSimulation;                                                                            // 17
                                                                                                                       // 18
  // call this function to allow other method invocations (from the                                                    // 19
  // same client) to continue running without waiting for this one to                                                  // 20
  // complete.                                                                                                         // 21
  this._unblock = options.unblock || function () {};                                                                   // 22
  this._calledUnblock = false;                                                                                         // 23
                                                                                                                       // 24
  // current user id                                                                                                   // 25
  this.userId = options.userId;                                                                                        // 26
                                                                                                                       // 27
  // sets current user id in all appropriate server contexts and                                                       // 28
  // reruns subscriptions                                                                                              // 29
  this._setUserId = options.setUserId || function () {};                                                               // 30
                                                                                                                       // 31
  // On the server, the connection this method call came in on.                                                        // 32
  this.connection = options.connection;                                                                                // 33
};                                                                                                                     // 34
                                                                                                                       // 35
_.extend(MethodInvocation.prototype, {                                                                                 // 36
  unblock: function () {                                                                                               // 37
    var self = this;                                                                                                   // 38
    self._calledUnblock = true;                                                                                        // 39
    self._unblock();                                                                                                   // 40
  },                                                                                                                   // 41
  setUserId: function(userId) {                                                                                        // 42
    var self = this;                                                                                                   // 43
    if (self._calledUnblock)                                                                                           // 44
      throw new Error("Can't call setUserId in a method after calling unblock");                                       // 45
    self.userId = userId;                                                                                              // 46
    self._setUserId(userId);                                                                                           // 47
  }                                                                                                                    // 48
});                                                                                                                    // 49
                                                                                                                       // 50
parseDDP = function (stringMessage) {                                                                                  // 51
  try {                                                                                                                // 52
    var msg = JSON.parse(stringMessage);                                                                               // 53
  } catch (e) {                                                                                                        // 54
    Meteor._debug("Discarding message with invalid JSON", stringMessage);                                              // 55
    return null;                                                                                                       // 56
  }                                                                                                                    // 57
  // DDP messages must be objects.                                                                                     // 58
  if (msg === null || typeof msg !== 'object') {                                                                       // 59
    Meteor._debug("Discarding non-object DDP message", stringMessage);                                                 // 60
    return null;                                                                                                       // 61
  }                                                                                                                    // 62
                                                                                                                       // 63
  // massage msg to get it into "abstract ddp" rather than "wire ddp" format.                                          // 64
                                                                                                                       // 65
  // switch between "cleared" rep of unsetting fields and "undefined"                                                  // 66
  // rep of same                                                                                                       // 67
  if (_.has(msg, 'cleared')) {                                                                                         // 68
    if (!_.has(msg, 'fields'))                                                                                         // 69
      msg.fields = {};                                                                                                 // 70
    _.each(msg.cleared, function (clearKey) {                                                                          // 71
      msg.fields[clearKey] = undefined;                                                                                // 72
    });                                                                                                                // 73
    delete msg.cleared;                                                                                                // 74
  }                                                                                                                    // 75
                                                                                                                       // 76
  _.each(['fields', 'params', 'result'], function (field) {                                                            // 77
    if (_.has(msg, field))                                                                                             // 78
      msg[field] = EJSON._adjustTypesFromJSONValue(msg[field]);                                                        // 79
  });                                                                                                                  // 80
                                                                                                                       // 81
  return msg;                                                                                                          // 82
};                                                                                                                     // 83
                                                                                                                       // 84
stringifyDDP = function (msg) {                                                                                        // 85
  var copy = EJSON.clone(msg);                                                                                         // 86
  // swizzle 'changed' messages from 'fields undefined' rep to 'fields                                                 // 87
  // and cleared' rep                                                                                                  // 88
  if (_.has(msg, 'fields')) {                                                                                          // 89
    var cleared = [];                                                                                                  // 90
    _.each(msg.fields, function (value, key) {                                                                         // 91
      if (value === undefined) {                                                                                       // 92
        cleared.push(key);                                                                                             // 93
        delete copy.fields[key];                                                                                       // 94
      }                                                                                                                // 95
    });                                                                                                                // 96
    if (!_.isEmpty(cleared))                                                                                           // 97
      copy.cleared = cleared;                                                                                          // 98
    if (_.isEmpty(copy.fields))                                                                                        // 99
      delete copy.fields;                                                                                              // 100
  }                                                                                                                    // 101
  // adjust types to basic                                                                                             // 102
  _.each(['fields', 'params', 'result'], function (field) {                                                            // 103
    if (_.has(copy, field))                                                                                            // 104
      copy[field] = EJSON._adjustTypesToJSONValue(copy[field]);                                                        // 105
  });                                                                                                                  // 106
  if (msg.id && typeof msg.id !== 'string') {                                                                          // 107
    throw new Error("Message id is not a string");                                                                     // 108
  }                                                                                                                    // 109
  return JSON.stringify(copy);                                                                                         // 110
};                                                                                                                     // 111
                                                                                                                       // 112
// This is private but it's used in a few places. accounts-base uses                                                   // 113
// it to get the current user. accounts-password uses it to stash SRP                                                  // 114
// state in the DDP session. Meteor.setTimeout and friends clear                                                       // 115
// it. We can probably find a better way to factor this.                                                               // 116
DDP._CurrentInvocation = new Meteor.EnvironmentVariable;                                                               // 117
                                                                                                                       // 118
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/livedata_connection.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
if (Meteor.isServer) {                                                                                                 // 1
  var path = Npm.require('path');                                                                                      // 2
  var Fiber = Npm.require('fibers');                                                                                   // 3
  var Future = Npm.require(path.join('fibers', 'future'));                                                             // 4
}                                                                                                                      // 5
                                                                                                                       // 6
// @param url {String|Object} URL to Meteor app,                                                                       // 7
//   or an object as a test hook (see code)                                                                            // 8
// Options:                                                                                                            // 9
//   reloadWithOutstanding: is it OK to reload if there are outstanding methods?                                       // 10
//   headers: extra headers to send on the websockets connection, for                                                  // 11
//     server-to-server DDP only                                                                                       // 12
//   _sockjsOptions: Specifies options to pass through to the sockjs client                                            // 13
//   onDDPNegotiationVersionFailure: callback when version negotiation fails.                                          // 14
//                                                                                                                     // 15
// XXX There should be a way to destroy a DDP connection, causing all                                                  // 16
// outstanding method calls to fail.                                                                                   // 17
//                                                                                                                     // 18
// XXX Our current way of handling failure and reconnection is great                                                   // 19
// for an app (where we want to tolerate being disconnected as an                                                      // 20
// expect state, and keep trying forever to reconnect) but cumbersome                                                  // 21
// for something like a command line tool that wants to make a                                                         // 22
// connection, call a method, and print an error if connection                                                         // 23
// fails. We should have better usability in the latter case (while                                                    // 24
// still transparently reconnecting if it's just a transient failure                                                   // 25
// or the server migrating us).                                                                                        // 26
var Connection = function (url, options) {                                                                             // 27
  var self = this;                                                                                                     // 28
  options = _.extend({                                                                                                 // 29
    onConnected: function () {},                                                                                       // 30
    onDDPVersionNegotiationFailure: function (description) {                                                           // 31
      Meteor._debug(description);                                                                                      // 32
    },                                                                                                                 // 33
    // These options are only for testing.                                                                             // 34
    reloadWithOutstanding: false,                                                                                      // 35
    supportedDDPVersions: SUPPORTED_DDP_VERSIONS,                                                                      // 36
    retry: true                                                                                                        // 37
  }, options);                                                                                                         // 38
                                                                                                                       // 39
  // If set, called when we reconnect, queuing method calls _before_ the                                               // 40
  // existing outstanding ones. This is the only data member that is part of the                                       // 41
  // public API!                                                                                                       // 42
  self.onReconnect = null;                                                                                             // 43
                                                                                                                       // 44
  // as a test hook, allow passing a stream instead of a url.                                                          // 45
  if (typeof url === "object") {                                                                                       // 46
    self._stream = url;                                                                                                // 47
  } else {                                                                                                             // 48
    self._stream = new LivedataTest.ClientStream(url, {                                                                // 49
      retry: options.retry,                                                                                            // 50
      headers: options.headers,                                                                                        // 51
      _sockjsOptions: options._sockjsOptions,                                                                          // 52
      // To keep some tests quiet (because we don't have a real API for handling                                       // 53
      // client-stream-level errors).                                                                                  // 54
      _dontPrintErrors: options._dontPrintErrors                                                                       // 55
    });                                                                                                                // 56
  }                                                                                                                    // 57
                                                                                                                       // 58
  self._lastSessionId = null;                                                                                          // 59
  self._versionSuggestion = null;  // The last proposed DDP version.                                                   // 60
  self._version = null;   // The DDP version agreed on by client and server.                                           // 61
  self._stores = {}; // name -> object with methods                                                                    // 62
  self._methodHandlers = {}; // name -> func                                                                           // 63
  self._nextMethodId = 1;                                                                                              // 64
  self._supportedDDPVersions = options.supportedDDPVersions;                                                           // 65
                                                                                                                       // 66
  // Tracks methods which the user has tried to call but which have not yet                                            // 67
  // called their user callback (ie, they are waiting on their result or for all                                       // 68
  // of their writes to be written to the local cache). Map from method ID to                                          // 69
  // MethodInvoker object.                                                                                             // 70
  self._methodInvokers = {};                                                                                           // 71
                                                                                                                       // 72
  // Tracks methods which the user has called but whose result messages have not                                       // 73
  // arrived yet.                                                                                                      // 74
  //                                                                                                                   // 75
  // _outstandingMethodBlocks is an array of blocks of methods. Each block                                             // 76
  // represents a set of methods that can run at the same time. The first block                                        // 77
  // represents the methods which are currently in flight; subsequent blocks                                           // 78
  // must wait for previous blocks to be fully finished before they can be sent                                        // 79
  // to the server.                                                                                                    // 80
  //                                                                                                                   // 81
  // Each block is an object with the following fields:                                                                // 82
  // - methods: a list of MethodInvoker objects                                                                        // 83
  // - wait: a boolean; if true, this block had a single method invoked with                                           // 84
  //         the "wait" option                                                                                         // 85
  //                                                                                                                   // 86
  // There will never be adjacent blocks with wait=false, because the only thing                                       // 87
  // that makes methods need to be serialized is a wait method.                                                        // 88
  //                                                                                                                   // 89
  // Methods are removed from the first block when their "result" is                                                   // 90
  // received. The entire first block is only removed when all of the in-flight                                        // 91
  // methods have received their results (so the "methods" list is empty) *AND*                                        // 92
  // all of the data written by those methods are visible in the local cache. So                                       // 93
  // it is possible for the first block's methods list to be empty, if we are                                          // 94
  // still waiting for some objects to quiesce.                                                                        // 95
  //                                                                                                                   // 96
  // Example:                                                                                                          // 97
  //  _outstandingMethodBlocks = [                                                                                     // 98
  //    {wait: false, methods: []},                                                                                    // 99
  //    {wait: true, methods: [<MethodInvoker for 'login'>]},                                                          // 100
  //    {wait: false, methods: [<MethodInvoker for 'foo'>,                                                             // 101
  //                            <MethodInvoker for 'bar'>]}]                                                           // 102
  // This means that there were some methods which were sent to the server and                                         // 103
  // which have returned their results, but some of the data written by                                                // 104
  // the methods may not be visible in the local cache. Once all that data is                                          // 105
  // visible, we will send a 'login' method. Once the login method has returned                                        // 106
  // and all the data is visible (including re-running subs if userId changes),                                        // 107
  // we will send the 'foo' and 'bar' methods in parallel.                                                             // 108
  self._outstandingMethodBlocks = [];                                                                                  // 109
                                                                                                                       // 110
  // method ID -> array of objects with keys 'collection' and 'id', listing                                            // 111
  // documents written by a given method's stub. keys are associated with                                              // 112
  // methods whose stub wrote at least one document, and whose data-done message                                       // 113
  // has not yet been received.                                                                                        // 114
  self._documentsWrittenByStub = {};                                                                                   // 115
  // collection -> IdMap of "server document" object. A "server document" has:                                         // 116
  // - "document": the version of the document according the                                                           // 117
  //   server (ie, the snapshot before a stub wrote it, amended by any changes                                         // 118
  //   received from the server)                                                                                       // 119
  //   It is undefined if we think the document does not exist                                                         // 120
  // - "writtenByStubs": a set of method IDs whose stubs wrote to the document                                         // 121
  //   whose "data done" messages have not yet been processed                                                          // 122
  self._serverDocuments = {};                                                                                          // 123
                                                                                                                       // 124
  // Array of callbacks to be called after the next update of the local                                                // 125
  // cache. Used for:                                                                                                  // 126
  //  - Calling methodInvoker.dataVisible and sub ready callbacks after                                                // 127
  //    the relevant data is flushed.                                                                                  // 128
  //  - Invoking the callbacks of "half-finished" methods after reconnect                                              // 129
  //    quiescence. Specifically, methods whose result was received over the old                                       // 130
  //    connection (so we don't re-send it) but whose data had not been made                                           // 131
  //    visible.                                                                                                       // 132
  self._afterUpdateCallbacks = [];                                                                                     // 133
                                                                                                                       // 134
  // In two contexts, we buffer all incoming data messages and then process them                                       // 135
  // all at once in a single update:                                                                                   // 136
  //   - During reconnect, we buffer all data messages until all subs that had                                         // 137
  //     been ready before reconnect are ready again, and all methods that are                                         // 138
  //     active have returned their "data done message"; then                                                          // 139
  //   - During the execution of a "wait" method, we buffer all data messages                                          // 140
  //     until the wait method gets its "data done" message. (If the wait method                                       // 141
  //     occurs during reconnect, it doesn't get any special handling.)                                                // 142
  // all data messages are processed in one update.                                                                    // 143
  //                                                                                                                   // 144
  // The following fields are used for this "quiescence" process.                                                      // 145
                                                                                                                       // 146
  // This buffers the messages that aren't being processed yet.                                                        // 147
  self._messagesBufferedUntilQuiescence = [];                                                                          // 148
  // Map from method ID -> true. Methods are removed from this when their                                              // 149
  // "data done" message is received, and we will not quiesce until it is                                              // 150
  // empty.                                                                                                            // 151
  self._methodsBlockingQuiescence = {};                                                                                // 152
  // map from sub ID -> true for subs that were ready (ie, called the sub                                              // 153
  // ready callback) before reconnect but haven't become ready again yet                                               // 154
  self._subsBeingRevived = {}; // map from sub._id -> true                                                             // 155
  // if true, the next data update should reset all stores. (set during                                                // 156
  // reconnect.)                                                                                                       // 157
  self._resetStores = false;                                                                                           // 158
                                                                                                                       // 159
  // name -> array of updates for (yet to be created) collections                                                      // 160
  self._updatesForUnknownStores = {};                                                                                  // 161
  // if we're blocking a migration, the retry func                                                                     // 162
  self._retryMigrate = null;                                                                                           // 163
                                                                                                                       // 164
  // metadata for subscriptions.  Map from sub ID to object with keys:                                                 // 165
  //   - id                                                                                                            // 166
  //   - name                                                                                                          // 167
  //   - params                                                                                                        // 168
  //   - inactive (if true, will be cleaned up if not reused in re-run)                                                // 169
  //   - ready (has the 'ready' message been received?)                                                                // 170
  //   - readyCallback (an optional callback to call when ready)                                                       // 171
  //   - errorCallback (an optional callback to call if the sub terminates with                                        // 172
  //                    an error)                                                                                      // 173
  self._subscriptions = {};                                                                                            // 174
                                                                                                                       // 175
  // Reactive userId.                                                                                                  // 176
  self._userId = null;                                                                                                 // 177
  self._userIdDeps = (typeof Deps !== "undefined") && new Deps.Dependency;                                             // 178
                                                                                                                       // 179
  // Block auto-reload while we're waiting for method responses.                                                       // 180
  if (Meteor.isClient && Package.reload && !options.reloadWithOutstanding) {                                           // 181
    Package.reload.Reload._onMigrate(function (retry) {                                                                // 182
      if (!self._readyToMigrate()) {                                                                                   // 183
        if (self._retryMigrate)                                                                                        // 184
          throw new Error("Two migrations in progress?");                                                              // 185
        self._retryMigrate = retry;                                                                                    // 186
        return false;                                                                                                  // 187
      } else {                                                                                                         // 188
        return [true];                                                                                                 // 189
      }                                                                                                                // 190
    });                                                                                                                // 191
  }                                                                                                                    // 192
                                                                                                                       // 193
  var onMessage = function (raw_msg) {                                                                                 // 194
    try {                                                                                                              // 195
      var msg = parseDDP(raw_msg);                                                                                     // 196
    } catch (e) {                                                                                                      // 197
      Meteor._debug("Exception while parsing DDP", e);                                                                 // 198
      return;                                                                                                          // 199
    }                                                                                                                  // 200
                                                                                                                       // 201
    if (msg === null || !msg.msg) {                                                                                    // 202
      // XXX COMPAT WITH 0.6.6. ignore the old welcome message for back                                                // 203
      // compat.  Remove this 'if' once the server stops sending welcome                                               // 204
      // messages (stream_server.js).                                                                                  // 205
      if (! (msg && msg.server_id))                                                                                    // 206
        Meteor._debug("discarding invalid livedata message", msg);                                                     // 207
      return;                                                                                                          // 208
    }                                                                                                                  // 209
                                                                                                                       // 210
    if (msg.msg === 'connected') {                                                                                     // 211
      self._version = self._versionSuggestion;                                                                         // 212
      options.onConnected();                                                                                           // 213
      self._livedata_connected(msg);                                                                                   // 214
    }                                                                                                                  // 215
    else if (msg.msg == 'failed') {                                                                                    // 216
      if (_.contains(self._supportedDDPVersions, msg.version)) {                                                       // 217
        self._versionSuggestion = msg.version;                                                                         // 218
        self._stream.reconnect({_force: true});                                                                        // 219
      } else {                                                                                                         // 220
        var description =                                                                                              // 221
              "DDP version negotiation failed; server requested version " + msg.version;                               // 222
        self._stream.disconnect({_permanent: true, _error: description});                                              // 223
        options.onDDPVersionNegotiationFailure(description);                                                           // 224
      }                                                                                                                // 225
    }                                                                                                                  // 226
    else if (_.include(['added', 'changed', 'removed', 'ready', 'updated'], msg.msg))                                  // 227
      self._livedata_data(msg);                                                                                        // 228
    else if (msg.msg === 'nosub')                                                                                      // 229
      self._livedata_nosub(msg);                                                                                       // 230
    else if (msg.msg === 'result')                                                                                     // 231
      self._livedata_result(msg);                                                                                      // 232
    else if (msg.msg === 'error')                                                                                      // 233
      self._livedata_error(msg);                                                                                       // 234
    else                                                                                                               // 235
      Meteor._debug("discarding unknown livedata message type", msg);                                                  // 236
  };                                                                                                                   // 237
                                                                                                                       // 238
  var onReset = function () {                                                                                          // 239
    // Send a connect message at the beginning of the stream.                                                          // 240
    // NOTE: reset is called even on the first connection, so this is                                                  // 241
    // the only place we send this message.                                                                            // 242
    var msg = {msg: 'connect'};                                                                                        // 243
    if (self._lastSessionId)                                                                                           // 244
      msg.session = self._lastSessionId;                                                                               // 245
    msg.version = self._versionSuggestion || self._supportedDDPVersions[0];                                            // 246
    self._versionSuggestion = msg.version;                                                                             // 247
    msg.support = self._supportedDDPVersions;                                                                          // 248
    self._send(msg);                                                                                                   // 249
                                                                                                                       // 250
    // Now, to minimize setup latency, go ahead and blast out all of                                                   // 251
    // our pending methods ands subscriptions before we've even taken                                                  // 252
    // the necessary RTT to know if we successfully reconnected. (1)                                                   // 253
    // They're supposed to be idempotent; (2) even if we did                                                           // 254
    // reconnect, we're not sure what messages might have gotten lost                                                  // 255
    // (in either direction) since we were disconnected (TCP being                                                     // 256
    // sloppy about that.)                                                                                             // 257
                                                                                                                       // 258
    // If the current block of methods all got their results (but didn't all get                                       // 259
    // their data visible), discard the empty block now.                                                               // 260
    if (! _.isEmpty(self._outstandingMethodBlocks) &&                                                                  // 261
        _.isEmpty(self._outstandingMethodBlocks[0].methods)) {                                                         // 262
      self._outstandingMethodBlocks.shift();                                                                           // 263
    }                                                                                                                  // 264
                                                                                                                       // 265
    // Mark all messages as unsent, they have not yet been sent on this                                                // 266
    // connection.                                                                                                     // 267
    _.each(self._methodInvokers, function (m) {                                                                        // 268
      m.sentMessage = false;                                                                                           // 269
    });                                                                                                                // 270
                                                                                                                       // 271
    // If an `onReconnect` handler is set, call it first. Go through                                                   // 272
    // some hoops to ensure that methods that are called from within                                                   // 273
    // `onReconnect` get executed _before_ ones that were originally                                                   // 274
    // outstanding (since `onReconnect` is used to re-establish auth                                                   // 275
    // certificates)                                                                                                   // 276
    if (self.onReconnect)                                                                                              // 277
      self._callOnReconnectAndSendAppropriateOutstandingMethods();                                                     // 278
    else                                                                                                               // 279
      self._sendOutstandingMethods();                                                                                  // 280
                                                                                                                       // 281
    // add new subscriptions at the end. this way they take effect after                                               // 282
    // the handlers and we don't see flicker.                                                                          // 283
    _.each(self._subscriptions, function (sub, id) {                                                                   // 284
      self._send({                                                                                                     // 285
        msg: 'sub',                                                                                                    // 286
        id: id,                                                                                                        // 287
        name: sub.name,                                                                                                // 288
        params: sub.params                                                                                             // 289
      });                                                                                                              // 290
    });                                                                                                                // 291
  };                                                                                                                   // 292
                                                                                                                       // 293
  if (Meteor.isServer) {                                                                                               // 294
    self._stream.on('message', Meteor.bindEnvironment(onMessage, Meteor._debug));                                      // 295
    self._stream.on('reset', Meteor.bindEnvironment(onReset, Meteor._debug));                                          // 296
  } else {                                                                                                             // 297
    self._stream.on('message', onMessage);                                                                             // 298
    self._stream.on('reset', onReset);                                                                                 // 299
  }                                                                                                                    // 300
};                                                                                                                     // 301
                                                                                                                       // 302
// A MethodInvoker manages sending a method to the server and calling the user's                                       // 303
// callbacks. On construction, it registers itself in the connection's                                                 // 304
// _methodInvokers map; it removes itself once the method is fully finished and                                        // 305
// the callback is invoked. This occurs when it has both received a result,                                            // 306
// and the data written by it is fully visible.                                                                        // 307
var MethodInvoker = function (options) {                                                                               // 308
  var self = this;                                                                                                     // 309
                                                                                                                       // 310
  // Public (within this file) fields.                                                                                 // 311
  self.methodId = options.methodId;                                                                                    // 312
  self.sentMessage = false;                                                                                            // 313
                                                                                                                       // 314
  self._callback = options.callback;                                                                                   // 315
  self._connection = options.connection;                                                                               // 316
  self._message = options.message;                                                                                     // 317
  self._onResultReceived = options.onResultReceived || function () {};                                                 // 318
  self._wait = options.wait;                                                                                           // 319
  self._methodResult = null;                                                                                           // 320
  self._dataVisible = false;                                                                                           // 321
                                                                                                                       // 322
  // Register with the connection.                                                                                     // 323
  self._connection._methodInvokers[self.methodId] = self;                                                              // 324
};                                                                                                                     // 325
_.extend(MethodInvoker.prototype, {                                                                                    // 326
  // Sends the method message to the server. May be called additional times if                                         // 327
  // we lose the connection and reconnect before receiving a result.                                                   // 328
  sendMessage: function () {                                                                                           // 329
    var self = this;                                                                                                   // 330
    // This function is called before sending a method (including resending on                                         // 331
    // reconnect). We should only (re)send methods where we don't already have a                                       // 332
    // result!                                                                                                         // 333
    if (self.gotResult())                                                                                              // 334
      throw new Error("sendingMethod is called on method with result");                                                // 335
                                                                                                                       // 336
    // If we're re-sending it, it doesn't matter if data was written the first                                         // 337
    // time.                                                                                                           // 338
    self._dataVisible = false;                                                                                         // 339
                                                                                                                       // 340
    self.sentMessage = true;                                                                                           // 341
                                                                                                                       // 342
    // If this is a wait method, make all data messages be buffered until it is                                        // 343
    // done.                                                                                                           // 344
    if (self._wait)                                                                                                    // 345
      self._connection._methodsBlockingQuiescence[self.methodId] = true;                                               // 346
                                                                                                                       // 347
    // Actually send the message.                                                                                      // 348
    self._connection._send(self._message);                                                                             // 349
  },                                                                                                                   // 350
  // Invoke the callback, if we have both a result and know that all data has                                          // 351
  // been written to the local cache.                                                                                  // 352
  _maybeInvokeCallback: function () {                                                                                  // 353
    var self = this;                                                                                                   // 354
    if (self._methodResult && self._dataVisible) {                                                                     // 355
      // Call the callback. (This won't throw: the callback was wrapped with                                           // 356
      // bindEnvironment.)                                                                                             // 357
      self._callback(self._methodResult[0], self._methodResult[1]);                                                    // 358
                                                                                                                       // 359
      // Forget about this method.                                                                                     // 360
      delete self._connection._methodInvokers[self.methodId];                                                          // 361
                                                                                                                       // 362
      // Let the connection know that this method is finished, so it can try to                                        // 363
      // move on to the next block of methods.                                                                         // 364
      self._connection._outstandingMethodFinished();                                                                   // 365
    }                                                                                                                  // 366
  },                                                                                                                   // 367
  // Call with the result of the method from the server. Only may be called                                            // 368
  // once; once it is called, you should not call sendMessage again.                                                   // 369
  // If the user provided an onResultReceived callback, call it immediately.                                           // 370
  // Then invoke the main callback if data is also visible.                                                            // 371
  receiveResult: function (err, result) {                                                                              // 372
    var self = this;                                                                                                   // 373
    if (self.gotResult())                                                                                              // 374
      throw new Error("Methods should only receive results once");                                                     // 375
    self._methodResult = [err, result];                                                                                // 376
    self._onResultReceived(err, result);                                                                               // 377
    self._maybeInvokeCallback();                                                                                       // 378
  },                                                                                                                   // 379
  // Call this when all data written by the method is visible. This means that                                         // 380
  // the method has returns its "data is done" message *AND* all server                                                // 381
  // documents that are buffered at that time have been written to the local                                           // 382
  // cache. Invokes the main callback if the result has been received.                                                 // 383
  dataVisible: function () {                                                                                           // 384
    var self = this;                                                                                                   // 385
    self._dataVisible = true;                                                                                          // 386
    self._maybeInvokeCallback();                                                                                       // 387
  },                                                                                                                   // 388
  // True if receiveResult has been called.                                                                            // 389
  gotResult: function () {                                                                                             // 390
    var self = this;                                                                                                   // 391
    return !!self._methodResult;                                                                                       // 392
  }                                                                                                                    // 393
});                                                                                                                    // 394
                                                                                                                       // 395
_.extend(Connection.prototype, {                                                                                       // 396
  // 'name' is the name of the data on the wire that should go in the                                                  // 397
  // store. 'wrappedStore' should be an object with methods beginUpdate, update,                                       // 398
  // endUpdate, saveOriginals, retrieveOriginals. see Collection for an example.                                       // 399
  registerStore: function (name, wrappedStore) {                                                                       // 400
    var self = this;                                                                                                   // 401
                                                                                                                       // 402
    if (name in self._stores)                                                                                          // 403
      return false;                                                                                                    // 404
                                                                                                                       // 405
    // Wrap the input object in an object which makes any store method not                                             // 406
    // implemented by 'store' into a no-op.                                                                            // 407
    var store = {};                                                                                                    // 408
    _.each(['update', 'beginUpdate', 'endUpdate', 'saveOriginals',                                                     // 409
            'retrieveOriginals'], function (method) {                                                                  // 410
              store[method] = function () {                                                                            // 411
                return (wrappedStore[method]                                                                           // 412
                        ? wrappedStore[method].apply(wrappedStore, arguments)                                          // 413
                        : undefined);                                                                                  // 414
              };                                                                                                       // 415
            });                                                                                                        // 416
                                                                                                                       // 417
    self._stores[name] = store;                                                                                        // 418
                                                                                                                       // 419
    var queued = self._updatesForUnknownStores[name];                                                                  // 420
    if (queued) {                                                                                                      // 421
      store.beginUpdate(queued.length, false);                                                                         // 422
      _.each(queued, function (msg) {                                                                                  // 423
        store.update(msg);                                                                                             // 424
      });                                                                                                              // 425
      store.endUpdate();                                                                                               // 426
      delete self._updatesForUnknownStores[name];                                                                      // 427
    }                                                                                                                  // 428
                                                                                                                       // 429
    return true;                                                                                                       // 430
  },                                                                                                                   // 431
                                                                                                                       // 432
  subscribe: function (name /* .. [arguments] .. (callback|callbacks) */) {                                            // 433
    var self = this;                                                                                                   // 434
                                                                                                                       // 435
    var params = Array.prototype.slice.call(arguments, 1);                                                             // 436
    var callbacks = {};                                                                                                // 437
    if (params.length) {                                                                                               // 438
      var lastParam = params[params.length - 1];                                                                       // 439
      if (typeof lastParam === "function") {                                                                           // 440
        callbacks.onReady = params.pop();                                                                              // 441
      } else if (lastParam && (typeof lastParam.onReady === "function" ||                                              // 442
                               typeof lastParam.onError === "function")) {                                             // 443
        callbacks = params.pop();                                                                                      // 444
      }                                                                                                                // 445
    }                                                                                                                  // 446
                                                                                                                       // 447
    // Is there an existing sub with the same name and param, run in an                                                // 448
    // invalidated Computation? This will happen if we are rerunning an                                                // 449
    // existing computation.                                                                                           // 450
    //                                                                                                                 // 451
    // For example, consider a rerun of:                                                                               // 452
    //                                                                                                                 // 453
    //     Deps.autorun(function () {                                                                                  // 454
    //       Meteor.subscribe("foo", Session.get("foo"));                                                              // 455
    //       Meteor.subscribe("bar", Session.get("bar"));                                                              // 456
    //     });                                                                                                         // 457
    //                                                                                                                 // 458
    // If "foo" has changed but "bar" has not, we will match the "bar"                                                 // 459
    // subcribe to an existing inactive subscription in order to not                                                   // 460
    // unsub and resub the subscription unnecessarily.                                                                 // 461
    //                                                                                                                 // 462
    // We only look for one such sub; if there are N apparently-identical subs                                         // 463
    // being invalidated, we will require N matching subscribe calls to keep                                           // 464
    // them all active.                                                                                                // 465
    var existing = _.find(self._subscriptions, function (sub) {                                                        // 466
      return sub.inactive && sub.name === name &&                                                                      // 467
        EJSON.equals(sub.params, params);                                                                              // 468
    });                                                                                                                // 469
                                                                                                                       // 470
    var id;                                                                                                            // 471
    if (existing) {                                                                                                    // 472
      id = existing.id;                                                                                                // 473
      existing.inactive = false; // reactivate                                                                         // 474
                                                                                                                       // 475
      if (callbacks.onReady) {                                                                                         // 476
        // If the sub is not already ready, replace any ready callback with the                                        // 477
        // one provided now. (It's not really clear what users would expect for                                        // 478
        // an onReady callback inside an autorun; the semantics we provide is                                          // 479
        // that at the time the sub first becomes ready, we call the last                                              // 480
        // onReady callback provided, if any.)                                                                         // 481
        if (!existing.ready)                                                                                           // 482
          existing.readyCallback = callbacks.onReady;                                                                  // 483
      }                                                                                                                // 484
      if (callbacks.onError) {                                                                                         // 485
        // Replace existing callback if any, so that errors aren't                                                     // 486
        // double-reported.                                                                                            // 487
        existing.errorCallback = callbacks.onError;                                                                    // 488
      }                                                                                                                // 489
    } else {                                                                                                           // 490
      // New sub! Generate an id, save it locally, and send message.                                                   // 491
      id = Random.id();                                                                                                // 492
      self._subscriptions[id] = {                                                                                      // 493
        id: id,                                                                                                        // 494
        name: name,                                                                                                    // 495
        params: params,                                                                                                // 496
        inactive: false,                                                                                               // 497
        ready: false,                                                                                                  // 498
        readyDeps: (typeof Deps !== "undefined") && new Deps.Dependency,                                               // 499
        readyCallback: callbacks.onReady,                                                                              // 500
        errorCallback: callbacks.onError                                                                               // 501
      };                                                                                                               // 502
      self._send({msg: 'sub', id: id, name: name, params: params});                                                    // 503
    }                                                                                                                  // 504
                                                                                                                       // 505
    // return a handle to the application.                                                                             // 506
    var handle = {                                                                                                     // 507
      stop: function () {                                                                                              // 508
        if (!_.has(self._subscriptions, id))                                                                           // 509
          return;                                                                                                      // 510
        self._send({msg: 'unsub', id: id});                                                                            // 511
        delete self._subscriptions[id];                                                                                // 512
      },                                                                                                               // 513
      ready: function () {                                                                                             // 514
        // return false if we've unsubscribed.                                                                         // 515
        if (!_.has(self._subscriptions, id))                                                                           // 516
          return false;                                                                                                // 517
        var record = self._subscriptions[id];                                                                          // 518
        record.readyDeps && record.readyDeps.depend();                                                                 // 519
        return record.ready;                                                                                           // 520
      }                                                                                                                // 521
    };                                                                                                                 // 522
                                                                                                                       // 523
    if (Deps.active) {                                                                                                 // 524
      // We're in a reactive computation, so we'd like to unsubscribe when the                                         // 525
      // computation is invalidated... but not if the rerun just re-subscribes                                         // 526
      // to the same subscription!  When a rerun happens, we use onInvalidate                                          // 527
      // as a change to mark the subscription "inactive" so that it can                                                // 528
      // be reused from the rerun.  If it isn't reused, it's killed from                                               // 529
      // an afterFlush.                                                                                                // 530
      Deps.onInvalidate(function (c) {                                                                                 // 531
        if (_.has(self._subscriptions, id))                                                                            // 532
          self._subscriptions[id].inactive = true;                                                                     // 533
                                                                                                                       // 534
        Deps.afterFlush(function () {                                                                                  // 535
          if (_.has(self._subscriptions, id) &&                                                                        // 536
              self._subscriptions[id].inactive)                                                                        // 537
            handle.stop();                                                                                             // 538
        });                                                                                                            // 539
      });                                                                                                              // 540
    }                                                                                                                  // 541
                                                                                                                       // 542
    return handle;                                                                                                     // 543
  },                                                                                                                   // 544
                                                                                                                       // 545
  // options:                                                                                                          // 546
  // - onLateError {Function(error)} called if an error was received after the ready event.                            // 547
  //     (errors received before ready cause an error to be thrown)                                                    // 548
  _subscribeAndWait: function (name, args, options) {                                                                  // 549
    var self = this;                                                                                                   // 550
    var f = new Future();                                                                                              // 551
    var ready = false;                                                                                                 // 552
    var handle;                                                                                                        // 553
    args = args || [];                                                                                                 // 554
    args.push({                                                                                                        // 555
      onReady: function () {                                                                                           // 556
        ready = true;                                                                                                  // 557
        f['return']();                                                                                                 // 558
      },                                                                                                               // 559
      onError: function (e) {                                                                                          // 560
        if (!ready)                                                                                                    // 561
          f['throw'](e);                                                                                               // 562
        else                                                                                                           // 563
          options && options.onLateError && options.onLateError(e);                                                    // 564
      }                                                                                                                // 565
    });                                                                                                                // 566
                                                                                                                       // 567
    handle = self.subscribe.apply(self, [name].concat(args));                                                          // 568
    f.wait();                                                                                                          // 569
    return handle;                                                                                                     // 570
  },                                                                                                                   // 571
                                                                                                                       // 572
  methods: function (methods) {                                                                                        // 573
    var self = this;                                                                                                   // 574
    _.each(methods, function (func, name) {                                                                            // 575
      if (self._methodHandlers[name])                                                                                  // 576
        throw new Error("A method named '" + name + "' is already defined");                                           // 577
      self._methodHandlers[name] = func;                                                                               // 578
    });                                                                                                                // 579
  },                                                                                                                   // 580
                                                                                                                       // 581
  call: function (name /* .. [arguments] .. callback */) {                                                             // 582
    // if it's a function, the last argument is the result callback,                                                   // 583
    // not a parameter to the remote method.                                                                           // 584
    var args = Array.prototype.slice.call(arguments, 1);                                                               // 585
    if (args.length && typeof args[args.length - 1] === "function")                                                    // 586
      var callback = args.pop();                                                                                       // 587
    return this.apply(name, args, callback);                                                                           // 588
  },                                                                                                                   // 589
                                                                                                                       // 590
  // @param options {Optional Object}                                                                                  // 591
  //   wait: Boolean - Should we wait to call this until all current methods                                           // 592
  //                   are fully finished, and block subsequent method calls                                           // 593
  //                   until this method is fully finished?                                                            // 594
  //                   (does not affect methods called from within this method)                                        // 595
  //   onResultReceived: Function - a callback to call as soon as the method                                           // 596
  //                                result is received. the data written by                                            // 597
  //                                the method may not yet be in the cache!                                            // 598
  // @param callback {Optional Function}                                                                               // 599
  apply: function (name, args, options, callback) {                                                                    // 600
    var self = this;                                                                                                   // 601
                                                                                                                       // 602
    // We were passed 3 arguments. They may be either (name, args, options)                                            // 603
    // or (name, args, callback)                                                                                       // 604
    if (!callback && typeof options === 'function') {                                                                  // 605
      callback = options;                                                                                              // 606
      options = {};                                                                                                    // 607
    }                                                                                                                  // 608
    options = options || {};                                                                                           // 609
                                                                                                                       // 610
    if (callback) {                                                                                                    // 611
      // XXX would it be better form to do the binding in stream.on,                                                   // 612
      // or caller, instead of here?                                                                                   // 613
      // XXX improve error message (and how we report it)                                                              // 614
      callback = Meteor.bindEnvironment(                                                                               // 615
        callback,                                                                                                      // 616
        "delivering result of invoking '" + name + "'"                                                                 // 617
      );                                                                                                               // 618
    }                                                                                                                  // 619
                                                                                                                       // 620
    // Lazily allocate method ID once we know that it'll be needed.                                                    // 621
    var methodId = (function () {                                                                                      // 622
      var id;                                                                                                          // 623
      return function () {                                                                                             // 624
        if (id === undefined)                                                                                          // 625
          id = '' + (self._nextMethodId++);                                                                            // 626
        return id;                                                                                                     // 627
      };                                                                                                               // 628
    })();                                                                                                              // 629
                                                                                                                       // 630
    // Run the stub, if we have one. The stub is supposed to make some                                                 // 631
    // temporary writes to the database to give the user a smooth experience                                           // 632
    // until the actual result of executing the method comes back from the                                             // 633
    // server (whereupon the temporary writes to the database will be reversed                                         // 634
    // during the beginUpdate/endUpdate process.)                                                                      // 635
    //                                                                                                                 // 636
    // Normally, we ignore the return value of the stub (even if it is an                                              // 637
    // exception), in favor of the real return value from the server. The                                              // 638
    // exception is if the *caller* is a stub. In that case, we're not going                                           // 639
    // to do a RPC, so we use the return value of the stub as our return                                               // 640
    // value.                                                                                                          // 641
                                                                                                                       // 642
    var enclosing = DDP._CurrentInvocation.get();                                                                      // 643
    var alreadyInSimulation = enclosing && enclosing.isSimulation;                                                     // 644
                                                                                                                       // 645
    var stub = self._methodHandlers[name];                                                                             // 646
    if (stub) {                                                                                                        // 647
      var setUserId = function(userId) {                                                                               // 648
        self.setUserId(userId);                                                                                        // 649
      };                                                                                                               // 650
      var invocation = new MethodInvocation({                                                                          // 651
        isSimulation: true,                                                                                            // 652
        userId: self.userId(),                                                                                         // 653
        setUserId: setUserId                                                                                           // 654
      });                                                                                                              // 655
                                                                                                                       // 656
      if (!alreadyInSimulation)                                                                                        // 657
        self._saveOriginals();                                                                                         // 658
                                                                                                                       // 659
      try {                                                                                                            // 660
        // Note that unlike in the corresponding server code, we never audit                                           // 661
        // that stubs check() their arguments.                                                                         // 662
        var ret = DDP._CurrentInvocation.withValue(invocation, function () {                                           // 663
          if (Meteor.isServer) {                                                                                       // 664
            // Because saveOriginals and retrieveOriginals aren't reentrant,                                           // 665
            // don't allow stubs to yield.                                                                             // 666
            return Meteor._noYieldsAllowed(function () {                                                               // 667
              return stub.apply(invocation, EJSON.clone(args));                                                        // 668
            });                                                                                                        // 669
          } else {                                                                                                     // 670
            return stub.apply(invocation, EJSON.clone(args));                                                          // 671
          }                                                                                                            // 672
        });                                                                                                            // 673
      }                                                                                                                // 674
      catch (e) {                                                                                                      // 675
        var exception = e;                                                                                             // 676
      }                                                                                                                // 677
                                                                                                                       // 678
      if (!alreadyInSimulation)                                                                                        // 679
        self._retrieveAndStoreOriginals(methodId());                                                                   // 680
    }                                                                                                                  // 681
                                                                                                                       // 682
    // If we're in a simulation, stop and return the result we have,                                                   // 683
    // rather than going on to do an RPC. If there was no stub,                                                        // 684
    // we'll end up returning undefined.                                                                               // 685
    if (alreadyInSimulation) {                                                                                         // 686
      if (callback) {                                                                                                  // 687
        callback(exception, ret);                                                                                      // 688
        return undefined;                                                                                              // 689
      }                                                                                                                // 690
      if (exception)                                                                                                   // 691
        throw exception;                                                                                               // 692
      return ret;                                                                                                      // 693
    }                                                                                                                  // 694
                                                                                                                       // 695
    // If an exception occurred in a stub, and we're ignoring it                                                       // 696
    // because we're doing an RPC and want to use what the server                                                      // 697
    // returns instead, log it so the developer knows.                                                                 // 698
    //                                                                                                                 // 699
    // Tests can set the 'expected' flag on an exception so it won't                                                   // 700
    // go to log.                                                                                                      // 701
    if (exception && !exception.expected) {                                                                            // 702
      Meteor._debug("Exception while simulating the effect of invoking '" +                                            // 703
                    name + "'", exception, exception.stack);                                                           // 704
    }                                                                                                                  // 705
                                                                                                                       // 706
                                                                                                                       // 707
    // At this point we're definitely doing an RPC, and we're going to                                                 // 708
    // return the value of the RPC to the caller.                                                                      // 709
                                                                                                                       // 710
    // If the caller didn't give a callback, decide what to do.                                                        // 711
    if (!callback) {                                                                                                   // 712
      if (Meteor.isClient) {                                                                                           // 713
        // On the client, we don't have fibers, so we can't block. The                                                 // 714
        // only thing we can do is to return undefined and discard the                                                 // 715
        // result of the RPC.                                                                                          // 716
        callback = function () {};                                                                                     // 717
      } else {                                                                                                         // 718
        // On the server, make the function synchronous. Throw on                                                      // 719
        // errors, return on success.                                                                                  // 720
        var future = new Future;                                                                                       // 721
        callback = future.resolver();                                                                                  // 722
      }                                                                                                                // 723
    }                                                                                                                  // 724
    // Send the RPC. Note that on the client, it is important that the                                                 // 725
    // stub have finished before we send the RPC, so that we know we have                                              // 726
    // a complete list of which local documents the stub wrote.                                                        // 727
    var methodInvoker = new MethodInvoker({                                                                            // 728
      methodId: methodId(),                                                                                            // 729
      callback: callback,                                                                                              // 730
      connection: self,                                                                                                // 731
      onResultReceived: options.onResultReceived,                                                                      // 732
      wait: !!options.wait,                                                                                            // 733
      message: {                                                                                                       // 734
        msg: 'method',                                                                                                 // 735
        method: name,                                                                                                  // 736
        params: args,                                                                                                  // 737
        id: methodId()                                                                                                 // 738
      }                                                                                                                // 739
    });                                                                                                                // 740
                                                                                                                       // 741
    if (options.wait) {                                                                                                // 742
      // It's a wait method! Wait methods go in their own block.                                                       // 743
      self._outstandingMethodBlocks.push(                                                                              // 744
        {wait: true, methods: [methodInvoker]});                                                                       // 745
    } else {                                                                                                           // 746
      // Not a wait method. Start a new block if the previous block was a wait                                         // 747
      // block, and add it to the last block of methods.                                                               // 748
      if (_.isEmpty(self._outstandingMethodBlocks) ||                                                                  // 749
          _.last(self._outstandingMethodBlocks).wait)                                                                  // 750
        self._outstandingMethodBlocks.push({wait: false, methods: []});                                                // 751
      _.last(self._outstandingMethodBlocks).methods.push(methodInvoker);                                               // 752
    }                                                                                                                  // 753
                                                                                                                       // 754
    // If we added it to the first block, send it out now.                                                             // 755
    if (self._outstandingMethodBlocks.length === 1)                                                                    // 756
      methodInvoker.sendMessage();                                                                                     // 757
                                                                                                                       // 758
    // If we're using the default callback on the server,                                                              // 759
    // block waiting for the result.                                                                                   // 760
    if (future) {                                                                                                      // 761
      return future.wait();                                                                                            // 762
    }                                                                                                                  // 763
    return undefined;                                                                                                  // 764
  },                                                                                                                   // 765
                                                                                                                       // 766
  // Before calling a method stub, prepare all stores to track changes and allow                                       // 767
  // _retrieveAndStoreOriginals to get the original versions of changed                                                // 768
  // documents.                                                                                                        // 769
  _saveOriginals: function () {                                                                                        // 770
    var self = this;                                                                                                   // 771
    _.each(self._stores, function (s) {                                                                                // 772
      s.saveOriginals();                                                                                               // 773
    });                                                                                                                // 774
  },                                                                                                                   // 775
  // Retrieves the original versions of all documents modified by the stub for                                         // 776
  // method 'methodId' from all stores and saves them to _serverDocuments (keyed                                       // 777
  // by document) and _documentsWrittenByStub (keyed by method ID).                                                    // 778
  _retrieveAndStoreOriginals: function (methodId) {                                                                    // 779
    var self = this;                                                                                                   // 780
    if (self._documentsWrittenByStub[methodId])                                                                        // 781
      throw new Error("Duplicate methodId in _retrieveAndStoreOriginals");                                             // 782
                                                                                                                       // 783
    var docsWritten = [];                                                                                              // 784
    _.each(self._stores, function (s, collection) {                                                                    // 785
      var originals = s.retrieveOriginals();                                                                           // 786
      // not all stores define retrieveOriginals                                                                       // 787
      if (!originals)                                                                                                  // 788
        return;                                                                                                        // 789
      originals.forEach(function (doc, id) {                                                                           // 790
        docsWritten.push({collection: collection, id: id});                                                            // 791
        if (!_.has(self._serverDocuments, collection))                                                                 // 792
          self._serverDocuments[collection] = new LocalCollection._IdMap;                                              // 793
        var serverDoc = self._serverDocuments[collection].setDefault(id, {});                                          // 794
        if (serverDoc.writtenByStubs) {                                                                                // 795
          // We're not the first stub to write this doc. Just add our method ID                                        // 796
          // to the record.                                                                                            // 797
          serverDoc.writtenByStubs[methodId] = true;                                                                   // 798
        } else {                                                                                                       // 799
          // First stub! Save the original value and our method ID.                                                    // 800
          serverDoc.document = doc;                                                                                    // 801
          serverDoc.flushCallbacks = [];                                                                               // 802
          serverDoc.writtenByStubs = {};                                                                               // 803
          serverDoc.writtenByStubs[methodId] = true;                                                                   // 804
        }                                                                                                              // 805
      });                                                                                                              // 806
    });                                                                                                                // 807
    if (!_.isEmpty(docsWritten)) {                                                                                     // 808
      self._documentsWrittenByStub[methodId] = docsWritten;                                                            // 809
    }                                                                                                                  // 810
  },                                                                                                                   // 811
                                                                                                                       // 812
  // This is very much a private function we use to make the tests                                                     // 813
  // take up fewer server resources after they complete.                                                               // 814
  _unsubscribeAll: function () {                                                                                       // 815
    var self = this;                                                                                                   // 816
    _.each(_.clone(self._subscriptions), function (sub, id) {                                                          // 817
      // Avoid killing the autoupdate subscription so that developers                                                  // 818
      // still get hot code pushes when writing tests.                                                                 // 819
      //                                                                                                               // 820
      // XXX it's a hack to encode knowledge about autoupdate here,                                                    // 821
      // but it doesn't seem worth it yet to have a special API for                                                    // 822
      // subscriptions to preserve after unit tests.                                                                   // 823
      if (sub.name !== 'meteor_autoupdate_clientVersions') {                                                           // 824
        self._send({msg: 'unsub', id: id});                                                                            // 825
        delete self._subscriptions[id];                                                                                // 826
      }                                                                                                                // 827
    });                                                                                                                // 828
  },                                                                                                                   // 829
                                                                                                                       // 830
  // Sends the DDP stringification of the given message object                                                         // 831
  _send: function (obj) {                                                                                              // 832
    var self = this;                                                                                                   // 833
    self._stream.send(stringifyDDP(obj));                                                                              // 834
  },                                                                                                                   // 835
                                                                                                                       // 836
  status: function (/*passthrough args*/) {                                                                            // 837
    var self = this;                                                                                                   // 838
    return self._stream.status.apply(self._stream, arguments);                                                         // 839
  },                                                                                                                   // 840
                                                                                                                       // 841
  reconnect: function (/*passthrough args*/) {                                                                         // 842
    var self = this;                                                                                                   // 843
    return self._stream.reconnect.apply(self._stream, arguments);                                                      // 844
  },                                                                                                                   // 845
                                                                                                                       // 846
  disconnect: function (/*passthrough args*/) {                                                                        // 847
    var self = this;                                                                                                   // 848
    return self._stream.disconnect.apply(self._stream, arguments);                                                     // 849
  },                                                                                                                   // 850
                                                                                                                       // 851
  close: function () {                                                                                                 // 852
    var self = this;                                                                                                   // 853
    return self._stream.disconnect({_permanent: true});                                                                // 854
  },                                                                                                                   // 855
                                                                                                                       // 856
  ///                                                                                                                  // 857
  /// Reactive user system                                                                                             // 858
  ///                                                                                                                  // 859
  userId: function () {                                                                                                // 860
    var self = this;                                                                                                   // 861
    if (self._userIdDeps)                                                                                              // 862
      self._userIdDeps.depend();                                                                                       // 863
    return self._userId;                                                                                               // 864
  },                                                                                                                   // 865
                                                                                                                       // 866
  setUserId: function (userId) {                                                                                       // 867
    var self = this;                                                                                                   // 868
    // Avoid invalidating dependents if setUserId is called with current value.                                        // 869
    if (self._userId === userId)                                                                                       // 870
      return;                                                                                                          // 871
    self._userId = userId;                                                                                             // 872
    if (self._userIdDeps)                                                                                              // 873
      self._userIdDeps.changed();                                                                                      // 874
  },                                                                                                                   // 875
                                                                                                                       // 876
  // Returns true if we are in a state after reconnect of waiting for subs to be                                       // 877
  // revived or early methods to finish their data, or we are waiting for a                                            // 878
  // "wait" method to finish.                                                                                          // 879
  _waitingForQuiescence: function () {                                                                                 // 880
    var self = this;                                                                                                   // 881
    return (! _.isEmpty(self._subsBeingRevived) ||                                                                     // 882
            ! _.isEmpty(self._methodsBlockingQuiescence));                                                             // 883
  },                                                                                                                   // 884
                                                                                                                       // 885
  // Returns true if any method whose message has been sent to the server has                                          // 886
  // not yet invoked its user callback.                                                                                // 887
  _anyMethodsAreOutstanding: function () {                                                                             // 888
    var self = this;                                                                                                   // 889
    return _.any(_.pluck(self._methodInvokers, 'sentMessage'));                                                        // 890
  },                                                                                                                   // 891
                                                                                                                       // 892
  _livedata_connected: function (msg) {                                                                                // 893
    var self = this;                                                                                                   // 894
                                                                                                                       // 895
    // If this is a reconnect, we'll have to reset all stores.                                                         // 896
    if (self._lastSessionId)                                                                                           // 897
      self._resetStores = true;                                                                                        // 898
                                                                                                                       // 899
    if (typeof (msg.session) === "string") {                                                                           // 900
      var reconnectedToPreviousSession = (self._lastSessionId === msg.session);                                        // 901
      self._lastSessionId = msg.session;                                                                               // 902
    }                                                                                                                  // 903
                                                                                                                       // 904
    if (reconnectedToPreviousSession) {                                                                                // 905
      // Successful reconnection -- pick up where we left off.  Note that right                                        // 906
      // now, this never happens: the server never connects us to a previous                                           // 907
      // session, because DDP doesn't provide enough data for the server to know                                       // 908
      // what messages the client has processed. We need to improve DDP to make                                        // 909
      // this possible, at which point we'll probably need more code here.                                             // 910
      return;                                                                                                          // 911
    }                                                                                                                  // 912
                                                                                                                       // 913
    // Server doesn't have our data any more. Re-sync a new session.                                                   // 914
                                                                                                                       // 915
    // Forget about messages we were buffering for unknown collections. They'll                                        // 916
    // be resent if still relevant.                                                                                    // 917
    self._updatesForUnknownStores = {};                                                                                // 918
                                                                                                                       // 919
    if (self._resetStores) {                                                                                           // 920
      // Forget about the effects of stubs. We'll be resetting all collections                                         // 921
      // anyway.                                                                                                       // 922
      self._documentsWrittenByStub = {};                                                                               // 923
      self._serverDocuments = {};                                                                                      // 924
    }                                                                                                                  // 925
                                                                                                                       // 926
    // Clear _afterUpdateCallbacks.                                                                                    // 927
    self._afterUpdateCallbacks = [];                                                                                   // 928
                                                                                                                       // 929
    // Mark all named subscriptions which are ready (ie, we already called the                                         // 930
    // ready callback) as needing to be revived.                                                                       // 931
    // XXX We should also block reconnect quiescence until unnamed subscriptions                                       // 932
    //     (eg, autopublish) are done re-publishing to avoid flicker!                                                  // 933
    self._subsBeingRevived = {};                                                                                       // 934
    _.each(self._subscriptions, function (sub, id) {                                                                   // 935
      if (sub.ready)                                                                                                   // 936
        self._subsBeingRevived[id] = true;                                                                             // 937
    });                                                                                                                // 938
                                                                                                                       // 939
    // Arrange for "half-finished" methods to have their callbacks run, and                                            // 940
    // track methods that were sent on this connection so that we don't                                                // 941
    // quiesce until they are all done.                                                                                // 942
    //                                                                                                                 // 943
    // Start by clearing _methodsBlockingQuiescence: methods sent before                                               // 944
    // reconnect don't matter, and any "wait" methods sent on the new connection                                       // 945
    // that we drop here will be restored by the loop below.                                                           // 946
    self._methodsBlockingQuiescence = {};                                                                              // 947
    if (self._resetStores) {                                                                                           // 948
      _.each(self._methodInvokers, function (invoker) {                                                                // 949
        if (invoker.gotResult()) {                                                                                     // 950
          // This method already got its result, but it didn't call its callback                                       // 951
          // because its data didn't become visible. We did not resend the                                             // 952
          // method RPC. We'll call its callback when we get a full quiesce,                                           // 953
          // since that's as close as we'll get to "data must be visible".                                             // 954
          self._afterUpdateCallbacks.push(_.bind(invoker.dataVisible, invoker));                                       // 955
        } else if (invoker.sentMessage) {                                                                              // 956
          // This method has been sent on this connection (maybe as a resend                                           // 957
          // from the last connection, maybe from onReconnect, maybe just very                                         // 958
          // quickly before processing the connected message).                                                         // 959
          //                                                                                                           // 960
          // We don't need to do anything special to ensure its callbacks get                                          // 961
          // called, but we'll count it as a method which is preventing                                                // 962
          // reconnect quiescence. (eg, it might be a login method that was run                                        // 963
          // from onReconnect, and we don't want to see flicker by seeing a                                            // 964
          // logged-out state.)                                                                                        // 965
          self._methodsBlockingQuiescence[invoker.methodId] = true;                                                    // 966
        }                                                                                                              // 967
      });                                                                                                              // 968
    }                                                                                                                  // 969
                                                                                                                       // 970
    self._messagesBufferedUntilQuiescence = [];                                                                        // 971
                                                                                                                       // 972
    // If we're not waiting on any methods or subs, we can reset the stores and                                        // 973
    // call the callbacks immediately.                                                                                 // 974
    if (!self._waitingForQuiescence()) {                                                                               // 975
      if (self._resetStores) {                                                                                         // 976
        _.each(self._stores, function (s) {                                                                            // 977
          s.beginUpdate(0, true);                                                                                      // 978
          s.endUpdate();                                                                                               // 979
        });                                                                                                            // 980
        self._resetStores = false;                                                                                     // 981
      }                                                                                                                // 982
      self._runAfterUpdateCallbacks();                                                                                 // 983
    }                                                                                                                  // 984
  },                                                                                                                   // 985
                                                                                                                       // 986
                                                                                                                       // 987
  _processOneDataMessage: function (msg, updates) {                                                                    // 988
    var self = this;                                                                                                   // 989
    // Using underscore here so as not to need to capitalize.                                                          // 990
    self['_process_' + msg.msg](msg, updates);                                                                         // 991
  },                                                                                                                   // 992
                                                                                                                       // 993
                                                                                                                       // 994
  _livedata_data: function (msg) {                                                                                     // 995
    var self = this;                                                                                                   // 996
                                                                                                                       // 997
    // collection name -> array of messages                                                                            // 998
    var updates = {};                                                                                                  // 999
                                                                                                                       // 1000
    if (self._waitingForQuiescence()) {                                                                                // 1001
      self._messagesBufferedUntilQuiescence.push(msg);                                                                 // 1002
                                                                                                                       // 1003
      if (msg.msg === "nosub")                                                                                         // 1004
        delete self._subsBeingRevived[msg.id];                                                                         // 1005
                                                                                                                       // 1006
      _.each(msg.subs || [], function (subId) {                                                                        // 1007
        delete self._subsBeingRevived[subId];                                                                          // 1008
      });                                                                                                              // 1009
      _.each(msg.methods || [], function (methodId) {                                                                  // 1010
        delete self._methodsBlockingQuiescence[methodId];                                                              // 1011
      });                                                                                                              // 1012
                                                                                                                       // 1013
      if (self._waitingForQuiescence())                                                                                // 1014
        return;                                                                                                        // 1015
                                                                                                                       // 1016
      // No methods or subs are blocking quiescence!                                                                   // 1017
      // We'll now process and all of our buffered messages, reset all stores,                                         // 1018
      // and apply them all at once.                                                                                   // 1019
      _.each(self._messagesBufferedUntilQuiescence, function (bufferedMsg) {                                           // 1020
        self._processOneDataMessage(bufferedMsg, updates);                                                             // 1021
      });                                                                                                              // 1022
      self._messagesBufferedUntilQuiescence = [];                                                                      // 1023
    } else {                                                                                                           // 1024
      self._processOneDataMessage(msg, updates);                                                                       // 1025
    }                                                                                                                  // 1026
                                                                                                                       // 1027
    if (self._resetStores || !_.isEmpty(updates)) {                                                                    // 1028
      // Begin a transactional update of each store.                                                                   // 1029
      _.each(self._stores, function (s, storeName) {                                                                   // 1030
        s.beginUpdate(_.has(updates, storeName) ? updates[storeName].length : 0,                                       // 1031
                      self._resetStores);                                                                              // 1032
      });                                                                                                              // 1033
      self._resetStores = false;                                                                                       // 1034
                                                                                                                       // 1035
      _.each(updates, function (updateMessages, storeName) {                                                           // 1036
        var store = self._stores[storeName];                                                                           // 1037
        if (store) {                                                                                                   // 1038
          _.each(updateMessages, function (updateMessage) {                                                            // 1039
            store.update(updateMessage);                                                                               // 1040
          });                                                                                                          // 1041
        } else {                                                                                                       // 1042
          // Nobody's listening for this data. Queue it up until                                                       // 1043
          // someone wants it.                                                                                         // 1044
          // XXX memory use will grow without bound if you forget to                                                   // 1045
          // create a collection or just don't care about it... going                                                  // 1046
          // to have to do something about that.                                                                       // 1047
          if (!_.has(self._updatesForUnknownStores, storeName))                                                        // 1048
            self._updatesForUnknownStores[storeName] = [];                                                             // 1049
          Array.prototype.push.apply(self._updatesForUnknownStores[storeName],                                         // 1050
                                     updateMessages);                                                                  // 1051
        }                                                                                                              // 1052
      });                                                                                                              // 1053
                                                                                                                       // 1054
      // End update transaction.                                                                                       // 1055
      _.each(self._stores, function (s) { s.endUpdate(); });                                                           // 1056
    }                                                                                                                  // 1057
                                                                                                                       // 1058
    self._runAfterUpdateCallbacks();                                                                                   // 1059
  },                                                                                                                   // 1060
                                                                                                                       // 1061
  // Call any callbacks deferred with _runWhenAllServerDocsAreFlushed whose                                            // 1062
  // relevant docs have been flushed, as well as dataVisible callbacks at                                              // 1063
  // reconnect-quiescence time.                                                                                        // 1064
  _runAfterUpdateCallbacks: function () {                                                                              // 1065
    var self = this;                                                                                                   // 1066
    var callbacks = self._afterUpdateCallbacks;                                                                        // 1067
    self._afterUpdateCallbacks = [];                                                                                   // 1068
    _.each(callbacks, function (c) {                                                                                   // 1069
      c();                                                                                                             // 1070
    });                                                                                                                // 1071
  },                                                                                                                   // 1072
                                                                                                                       // 1073
  _pushUpdate: function (updates, collection, msg) {                                                                   // 1074
    var self = this;                                                                                                   // 1075
    if (!_.has(updates, collection)) {                                                                                 // 1076
      updates[collection] = [];                                                                                        // 1077
    }                                                                                                                  // 1078
    updates[collection].push(msg);                                                                                     // 1079
  },                                                                                                                   // 1080
                                                                                                                       // 1081
  _getServerDoc: function (collection, id) {                                                                           // 1082
    var self = this;                                                                                                   // 1083
    if (!_.has(self._serverDocuments, collection))                                                                     // 1084
      return null;                                                                                                     // 1085
    var serverDocsForCollection = self._serverDocuments[collection];                                                   // 1086
    return serverDocsForCollection.get(id) || null;                                                                    // 1087
  },                                                                                                                   // 1088
                                                                                                                       // 1089
  _process_added: function (msg, updates) {                                                                            // 1090
    var self = this;                                                                                                   // 1091
    var id = LocalCollection._idParse(msg.id);                                                                         // 1092
    var serverDoc = self._getServerDoc(msg.collection, id);                                                            // 1093
    if (serverDoc) {                                                                                                   // 1094
      // Some outstanding stub wrote here.                                                                             // 1095
      if (serverDoc.document !== undefined)                                                                            // 1096
        throw new Error("Server sent add for existing id: " + msg.id);                                                 // 1097
      serverDoc.document = msg.fields || {};                                                                           // 1098
      serverDoc.document._id = id;                                                                                     // 1099
    } else {                                                                                                           // 1100
      self._pushUpdate(updates, msg.collection, msg);                                                                  // 1101
    }                                                                                                                  // 1102
  },                                                                                                                   // 1103
                                                                                                                       // 1104
  _process_changed: function (msg, updates) {                                                                          // 1105
    var self = this;                                                                                                   // 1106
    var serverDoc = self._getServerDoc(                                                                                // 1107
      msg.collection, LocalCollection._idParse(msg.id));                                                               // 1108
    if (serverDoc) {                                                                                                   // 1109
      if (serverDoc.document === undefined)                                                                            // 1110
        throw new Error("Server sent changed for nonexisting id: " + msg.id);                                          // 1111
      LocalCollection._applyChanges(serverDoc.document, msg.fields);                                                   // 1112
    } else {                                                                                                           // 1113
      self._pushUpdate(updates, msg.collection, msg);                                                                  // 1114
    }                                                                                                                  // 1115
  },                                                                                                                   // 1116
                                                                                                                       // 1117
  _process_removed: function (msg, updates) {                                                                          // 1118
    var self = this;                                                                                                   // 1119
    var serverDoc = self._getServerDoc(                                                                                // 1120
      msg.collection, LocalCollection._idParse(msg.id));                                                               // 1121
    if (serverDoc) {                                                                                                   // 1122
      // Some outstanding stub wrote here.                                                                             // 1123
      if (serverDoc.document === undefined)                                                                            // 1124
        throw new Error("Server sent removed for nonexisting id:" + msg.id);                                           // 1125
      serverDoc.document = undefined;                                                                                  // 1126
    } else {                                                                                                           // 1127
      self._pushUpdate(updates, msg.collection, {                                                                      // 1128
        msg: 'removed',                                                                                                // 1129
        collection: msg.collection,                                                                                    // 1130
        id: msg.id                                                                                                     // 1131
      });                                                                                                              // 1132
    }                                                                                                                  // 1133
  },                                                                                                                   // 1134
                                                                                                                       // 1135
  _process_updated: function (msg, updates) {                                                                          // 1136
    var self = this;                                                                                                   // 1137
    // Process "method done" messages.                                                                                 // 1138
    _.each(msg.methods, function (methodId) {                                                                          // 1139
      _.each(self._documentsWrittenByStub[methodId], function (written) {                                              // 1140
        var serverDoc = self._getServerDoc(written.collection, written.id);                                            // 1141
        if (!serverDoc)                                                                                                // 1142
          throw new Error("Lost serverDoc for " + JSON.stringify(written));                                            // 1143
        if (!serverDoc.writtenByStubs[methodId])                                                                       // 1144
          throw new Error("Doc " + JSON.stringify(written) +                                                           // 1145
                          " not written by  method " + methodId);                                                      // 1146
        delete serverDoc.writtenByStubs[methodId];                                                                     // 1147
        if (_.isEmpty(serverDoc.writtenByStubs)) {                                                                     // 1148
          // All methods whose stubs wrote this method have completed! We can                                          // 1149
          // now copy the saved document to the database (reverting the stub's                                         // 1150
          // change if the server did not write to this object, or applying the                                        // 1151
          // server's writes if it did).                                                                               // 1152
                                                                                                                       // 1153
          // This is a fake ddp 'replace' message.  It's just for talking                                              // 1154
          // between livedata connections and minimongo.  (We have to stringify                                        // 1155
          // the ID because it's supposed to look like a wire message.)                                                // 1156
          self._pushUpdate(updates, written.collection, {                                                              // 1157
            msg: 'replace',                                                                                            // 1158
            id: LocalCollection._idStringify(written.id),                                                              // 1159
            replace: serverDoc.document                                                                                // 1160
          });                                                                                                          // 1161
          // Call all flush callbacks.                                                                                 // 1162
          _.each(serverDoc.flushCallbacks, function (c) {                                                              // 1163
            c();                                                                                                       // 1164
          });                                                                                                          // 1165
                                                                                                                       // 1166
          // Delete this completed serverDocument. Don't bother to GC empty                                            // 1167
          // IdMaps inside self._serverDocuments, since there probably aren't                                          // 1168
          // many collections and they'll be written repeatedly.                                                       // 1169
          self._serverDocuments[written.collection].remove(written.id);                                                // 1170
        }                                                                                                              // 1171
      });                                                                                                              // 1172
      delete self._documentsWrittenByStub[methodId];                                                                   // 1173
                                                                                                                       // 1174
      // We want to call the data-written callback, but we can't do so until all                                       // 1175
      // currently buffered messages are flushed.                                                                      // 1176
      var callbackInvoker = self._methodInvokers[methodId];                                                            // 1177
      if (!callbackInvoker)                                                                                            // 1178
        throw new Error("No callback invoker for method " + methodId);                                                 // 1179
      self._runWhenAllServerDocsAreFlushed(                                                                            // 1180
        _.bind(callbackInvoker.dataVisible, callbackInvoker));                                                         // 1181
    });                                                                                                                // 1182
  },                                                                                                                   // 1183
                                                                                                                       // 1184
  _process_ready: function (msg, updates) {                                                                            // 1185
    var self = this;                                                                                                   // 1186
    // Process "sub ready" messages. "sub ready" messages don't take effect                                            // 1187
    // until all current server documents have been flushed to the local                                               // 1188
    // database. We can use a write fence to implement this.                                                           // 1189
    _.each(msg.subs, function (subId) {                                                                                // 1190
      self._runWhenAllServerDocsAreFlushed(function () {                                                               // 1191
        var subRecord = self._subscriptions[subId];                                                                    // 1192
        // Did we already unsubscribe?                                                                                 // 1193
        if (!subRecord)                                                                                                // 1194
          return;                                                                                                      // 1195
        // Did we already receive a ready message? (Oops!)                                                             // 1196
        if (subRecord.ready)                                                                                           // 1197
          return;                                                                                                      // 1198
        subRecord.readyCallback && subRecord.readyCallback();                                                          // 1199
        subRecord.ready = true;                                                                                        // 1200
        subRecord.readyDeps && subRecord.readyDeps.changed();                                                          // 1201
      });                                                                                                              // 1202
    });                                                                                                                // 1203
  },                                                                                                                   // 1204
                                                                                                                       // 1205
  // Ensures that "f" will be called after all documents currently in                                                  // 1206
  // _serverDocuments have been written to the local cache. f will not be called                                       // 1207
  // if the connection is lost before then!                                                                            // 1208
  _runWhenAllServerDocsAreFlushed: function (f) {                                                                      // 1209
    var self = this;                                                                                                   // 1210
    var runFAfterUpdates = function () {                                                                               // 1211
      self._afterUpdateCallbacks.push(f);                                                                              // 1212
    };                                                                                                                 // 1213
    var unflushedServerDocCount = 0;                                                                                   // 1214
    var onServerDocFlush = function () {                                                                               // 1215
      --unflushedServerDocCount;                                                                                       // 1216
      if (unflushedServerDocCount === 0) {                                                                             // 1217
        // This was the last doc to flush! Arrange to run f after the updates                                          // 1218
        // have been applied.                                                                                          // 1219
        runFAfterUpdates();                                                                                            // 1220
      }                                                                                                                // 1221
    };                                                                                                                 // 1222
    _.each(self._serverDocuments, function (collectionDocs) {                                                          // 1223
      collectionDocs.forEach(function (serverDoc) {                                                                    // 1224
        var writtenByStubForAMethodWithSentMessage = _.any(                                                            // 1225
          serverDoc.writtenByStubs, function (dummy, methodId) {                                                       // 1226
            var invoker = self._methodInvokers[methodId];                                                              // 1227
            return invoker && invoker.sentMessage;                                                                     // 1228
          });                                                                                                          // 1229
        if (writtenByStubForAMethodWithSentMessage) {                                                                  // 1230
          ++unflushedServerDocCount;                                                                                   // 1231
          serverDoc.flushCallbacks.push(onServerDocFlush);                                                             // 1232
        }                                                                                                              // 1233
      });                                                                                                              // 1234
    });                                                                                                                // 1235
    if (unflushedServerDocCount === 0) {                                                                               // 1236
      // There aren't any buffered docs --- we can call f as soon as the current                                       // 1237
      // round of updates is applied!                                                                                  // 1238
      runFAfterUpdates();                                                                                              // 1239
    }                                                                                                                  // 1240
  },                                                                                                                   // 1241
                                                                                                                       // 1242
  _livedata_nosub: function (msg) {                                                                                    // 1243
    var self = this;                                                                                                   // 1244
                                                                                                                       // 1245
    // First pass it through _livedata_data, which only uses it to help get                                            // 1246
    // towards quiescence.                                                                                             // 1247
    self._livedata_data(msg);                                                                                          // 1248
                                                                                                                       // 1249
    // Do the rest of our processing immediately, with no                                                              // 1250
    // buffering-until-quiescence.                                                                                     // 1251
                                                                                                                       // 1252
    // we weren't subbed anyway, or we initiated the unsub.                                                            // 1253
    if (!_.has(self._subscriptions, msg.id))                                                                           // 1254
      return;                                                                                                          // 1255
    var errorCallback = self._subscriptions[msg.id].errorCallback;                                                     // 1256
    delete self._subscriptions[msg.id];                                                                                // 1257
    if (errorCallback && msg.error) {                                                                                  // 1258
      errorCallback(new Meteor.Error(                                                                                  // 1259
        msg.error.error, msg.error.reason, msg.error.details));                                                        // 1260
    }                                                                                                                  // 1261
  },                                                                                                                   // 1262
                                                                                                                       // 1263
  _process_nosub: function () {                                                                                        // 1264
    // This is called as part of the "buffer until quiescence" process, but                                            // 1265
    // nosub's effect is always immediate. It only goes in the buffer at all                                           // 1266
    // because it's possible for a nosub to be the thing that triggers                                                 // 1267
    // quiescence, if we were waiting for a sub to be revived and it dies                                              // 1268
    // instead.                                                                                                        // 1269
  },                                                                                                                   // 1270
                                                                                                                       // 1271
  _livedata_result: function (msg) {                                                                                   // 1272
    // id, result or error. error has error (code), reason, details                                                    // 1273
                                                                                                                       // 1274
    var self = this;                                                                                                   // 1275
                                                                                                                       // 1276
    // find the outstanding request                                                                                    // 1277
    // should be O(1) in nearly all realistic use cases                                                                // 1278
    if (_.isEmpty(self._outstandingMethodBlocks)) {                                                                    // 1279
      Meteor._debug("Received method result but no methods outstanding");                                              // 1280
      return;                                                                                                          // 1281
    }                                                                                                                  // 1282
    var currentMethodBlock = self._outstandingMethodBlocks[0].methods;                                                 // 1283
    var m;                                                                                                             // 1284
    for (var i = 0; i < currentMethodBlock.length; i++) {                                                              // 1285
      m = currentMethodBlock[i];                                                                                       // 1286
      if (m.methodId === msg.id)                                                                                       // 1287
        break;                                                                                                         // 1288
    }                                                                                                                  // 1289
                                                                                                                       // 1290
    if (!m) {                                                                                                          // 1291
      Meteor._debug("Can't match method response to original method call", msg);                                       // 1292
      return;                                                                                                          // 1293
    }                                                                                                                  // 1294
                                                                                                                       // 1295
    // Remove from current method block. This may leave the block empty, but we                                        // 1296
    // don't move on to the next block until the callback has been delivered, in                                       // 1297
    // _outstandingMethodFinished.                                                                                     // 1298
    currentMethodBlock.splice(i, 1);                                                                                   // 1299
                                                                                                                       // 1300
    if (_.has(msg, 'error')) {                                                                                         // 1301
      m.receiveResult(new Meteor.Error(                                                                                // 1302
        msg.error.error, msg.error.reason,                                                                             // 1303
        msg.error.details));                                                                                           // 1304
    } else {                                                                                                           // 1305
      // msg.result may be undefined if the method didn't return a                                                     // 1306
      // value                                                                                                         // 1307
      m.receiveResult(undefined, msg.result);                                                                          // 1308
    }                                                                                                                  // 1309
  },                                                                                                                   // 1310
                                                                                                                       // 1311
  // Called by MethodInvoker after a method's callback is invoked.  If this was                                        // 1312
  // the last outstanding method in the current block, runs the next block. If                                         // 1313
  // there are no more methods, consider accepting a hot code push.                                                    // 1314
  _outstandingMethodFinished: function () {                                                                            // 1315
    var self = this;                                                                                                   // 1316
    if (self._anyMethodsAreOutstanding())                                                                              // 1317
      return;                                                                                                          // 1318
                                                                                                                       // 1319
    // No methods are outstanding. This should mean that the first block of                                            // 1320
    // methods is empty. (Or it might not exist, if this was a method that                                             // 1321
    // half-finished before disconnect/reconnect.)                                                                     // 1322
    if (! _.isEmpty(self._outstandingMethodBlocks)) {                                                                  // 1323
      var firstBlock = self._outstandingMethodBlocks.shift();                                                          // 1324
      if (! _.isEmpty(firstBlock.methods))                                                                             // 1325
        throw new Error("No methods outstanding but nonempty block: " +                                                // 1326
                        JSON.stringify(firstBlock));                                                                   // 1327
                                                                                                                       // 1328
      // Send the outstanding methods now in the first block.                                                          // 1329
      if (!_.isEmpty(self._outstandingMethodBlocks))                                                                   // 1330
        self._sendOutstandingMethods();                                                                                // 1331
    }                                                                                                                  // 1332
                                                                                                                       // 1333
    // Maybe accept a hot code push.                                                                                   // 1334
    self._maybeMigrate();                                                                                              // 1335
  },                                                                                                                   // 1336
                                                                                                                       // 1337
  // Sends messages for all the methods in the first block in                                                          // 1338
  // _outstandingMethodBlocks.                                                                                         // 1339
  _sendOutstandingMethods: function() {                                                                                // 1340
    var self = this;                                                                                                   // 1341
    if (_.isEmpty(self._outstandingMethodBlocks))                                                                      // 1342
      return;                                                                                                          // 1343
    _.each(self._outstandingMethodBlocks[0].methods, function (m) {                                                    // 1344
      m.sendMessage();                                                                                                 // 1345
    });                                                                                                                // 1346
  },                                                                                                                   // 1347
                                                                                                                       // 1348
  _livedata_error: function (msg) {                                                                                    // 1349
    Meteor._debug("Received error from server: ", msg.reason);                                                         // 1350
    if (msg.offendingMessage)                                                                                          // 1351
      Meteor._debug("For: ", msg.offendingMessage);                                                                    // 1352
  },                                                                                                                   // 1353
                                                                                                                       // 1354
  _callOnReconnectAndSendAppropriateOutstandingMethods: function() {                                                   // 1355
    var self = this;                                                                                                   // 1356
    var oldOutstandingMethodBlocks = self._outstandingMethodBlocks;                                                    // 1357
    self._outstandingMethodBlocks = [];                                                                                // 1358
                                                                                                                       // 1359
    self.onReconnect();                                                                                                // 1360
                                                                                                                       // 1361
    if (_.isEmpty(oldOutstandingMethodBlocks))                                                                         // 1362
      return;                                                                                                          // 1363
                                                                                                                       // 1364
    // We have at least one block worth of old outstanding methods to try                                              // 1365
    // again. First: did onReconnect actually send anything? If not, we just                                           // 1366
    // restore all outstanding methods and run the first block.                                                        // 1367
    if (_.isEmpty(self._outstandingMethodBlocks)) {                                                                    // 1368
      self._outstandingMethodBlocks = oldOutstandingMethodBlocks;                                                      // 1369
      self._sendOutstandingMethods();                                                                                  // 1370
      return;                                                                                                          // 1371
    }                                                                                                                  // 1372
                                                                                                                       // 1373
    // OK, there are blocks on both sides. Special case: merge the last block of                                       // 1374
    // the reconnect methods with the first block of the original methods, if                                          // 1375
    // neither of them are "wait" blocks.                                                                              // 1376
    if (!_.last(self._outstandingMethodBlocks).wait &&                                                                 // 1377
        !oldOutstandingMethodBlocks[0].wait) {                                                                         // 1378
      _.each(oldOutstandingMethodBlocks[0].methods, function (m) {                                                     // 1379
        _.last(self._outstandingMethodBlocks).methods.push(m);                                                         // 1380
                                                                                                                       // 1381
        // If this "last block" is also the first block, send the message.                                             // 1382
        if (self._outstandingMethodBlocks.length === 1)                                                                // 1383
          m.sendMessage();                                                                                             // 1384
      });                                                                                                              // 1385
                                                                                                                       // 1386
      oldOutstandingMethodBlocks.shift();                                                                              // 1387
    }                                                                                                                  // 1388
                                                                                                                       // 1389
    // Now add the rest of the original blocks on.                                                                     // 1390
    _.each(oldOutstandingMethodBlocks, function (block) {                                                              // 1391
      self._outstandingMethodBlocks.push(block);                                                                       // 1392
    });                                                                                                                // 1393
  },                                                                                                                   // 1394
                                                                                                                       // 1395
  // We can accept a hot code push if there are no methods in flight.                                                  // 1396
  _readyToMigrate: function() {                                                                                        // 1397
    var self = this;                                                                                                   // 1398
    return _.isEmpty(self._methodInvokers);                                                                            // 1399
  },                                                                                                                   // 1400
                                                                                                                       // 1401
  // If we were blocking a migration, see if it's now possible to continue.                                            // 1402
  // Call whenever the set of outstanding/blocked methods shrinks.                                                     // 1403
  _maybeMigrate: function () {                                                                                         // 1404
    var self = this;                                                                                                   // 1405
    if (self._retryMigrate && self._readyToMigrate()) {                                                                // 1406
      self._retryMigrate();                                                                                            // 1407
      self._retryMigrate = null;                                                                                       // 1408
    }                                                                                                                  // 1409
  }                                                                                                                    // 1410
});                                                                                                                    // 1411
                                                                                                                       // 1412
LivedataTest.Connection = Connection;                                                                                  // 1413
                                                                                                                       // 1414
// @param url {String} URL to Meteor app,                                                                              // 1415
//     e.g.:                                                                                                           // 1416
//     "subdomain.meteor.com",                                                                                         // 1417
//     "http://subdomain.meteor.com",                                                                                  // 1418
//     "/",                                                                                                            // 1419
//     "ddp+sockjs://ddp--****-foo.meteor.com/sockjs"                                                                  // 1420
//                                                                                                                     // 1421
DDP.connect = function (url, options) {                                                                                // 1422
  var ret = new Connection(url, options);                                                                              // 1423
  allConnections.push(ret); // hack. see below.                                                                        // 1424
  return ret;                                                                                                          // 1425
};                                                                                                                     // 1426
                                                                                                                       // 1427
// Hack for `spiderable` package: a way to see if the page is done                                                     // 1428
// loading all the data it needs.                                                                                      // 1429
//                                                                                                                     // 1430
allConnections = [];                                                                                                   // 1431
DDP._allSubscriptionsReady = function () {                                                                             // 1432
  return _.all(allConnections, function (conn) {                                                                       // 1433
    return _.all(conn._subscriptions, function (sub) {                                                                 // 1434
      return sub.ready;                                                                                                // 1435
    });                                                                                                                // 1436
  });                                                                                                                  // 1437
};                                                                                                                     // 1438
                                                                                                                       // 1439
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/livedata/server_convenience.js                                                                             //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
// Only create a server if we are in an environment with a HTTP server                                                 // 1
// (as opposed to, eg, a command-line tool).                                                                           // 2
//                                                                                                                     // 3
if (Package.webapp) {                                                                                                  // 4
  if (process.env.DDP_DEFAULT_CONNECTION_URL) {                                                                        // 5
    __meteor_runtime_config__.DDP_DEFAULT_CONNECTION_URL =                                                             // 6
      process.env.DDP_DEFAULT_CONNECTION_URL;                                                                          // 7
  }                                                                                                                    // 8
                                                                                                                       // 9
  Meteor.server = new Server;                                                                                          // 10
                                                                                                                       // 11
  Meteor.refresh = function (notification) {                                                                           // 12
    DDPServer._InvalidationCrossbar.fire(notification);                                                                // 13
  };                                                                                                                   // 14
                                                                                                                       // 15
  // Proxy the public methods of Meteor.server so they can                                                             // 16
  // be called directly on Meteor.                                                                                     // 17
  _.each(['publish', 'methods', 'call', 'apply', 'onConnection'],                                                      // 18
         function (name) {                                                                                             // 19
           Meteor[name] = _.bind(Meteor.server[name], Meteor.server);                                                  // 20
         });                                                                                                           // 21
} else {                                                                                                               // 22
  // No server? Make these empty/no-ops.                                                                               // 23
  Meteor.server = null;                                                                                                // 24
  Meteor.refresh = function (notification) {                                                                           // 25
  };                                                                                                                   // 26
  _.each(['publish', 'methods', 'call', 'apply', 'onConnection'],                                                      // 27
    function (name) {                                                                                                  // 28
      Meteor[name] = function(){};                                                                                     // 29
    });                                                                                                                // 30
}                                                                                                                      // 31
                                                                                                                       // 32
// Meteor.server used to be called Meteor.default_server. Provide                                                      // 33
// backcompat as a courtesy even though it was never documented.                                                       // 34
// XXX COMPAT WITH 0.6.4                                                                                               // 35
Meteor.default_server = Meteor.server;                                                                                 // 36
                                                                                                                       // 37
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.livedata = {
  DDP: DDP,
  DDPServer: DDPServer,
  LivedataTest: LivedataTest
};

})();
