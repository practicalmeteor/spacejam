(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var RoutePolicy = Package.routepolicy.RoutePolicy;

/* Package-scope variables */
var WebApp, main, WebAppInternals;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/webapp/webapp_server.js                                                                             //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
////////// Requires //////////                                                                                  // 1
                                                                                                                // 2
var fs = Npm.require("fs");                                                                                     // 3
var http = Npm.require("http");                                                                                 // 4
var os = Npm.require("os");                                                                                     // 5
var path = Npm.require("path");                                                                                 // 6
var url = Npm.require("url");                                                                                   // 7
var crypto = Npm.require("crypto");                                                                             // 8
                                                                                                                // 9
var connect = Npm.require('connect');                                                                           // 10
var useragent = Npm.require('useragent');                                                                       // 11
var send = Npm.require('send');                                                                                 // 12
                                                                                                                // 13
var SHORT_SOCKET_TIMEOUT = 5*1000;                                                                              // 14
var LONG_SOCKET_TIMEOUT = 120*1000;                                                                             // 15
                                                                                                                // 16
WebApp = {};                                                                                                    // 17
WebAppInternals = {};                                                                                           // 18
                                                                                                                // 19
var bundledJsCssPrefix;                                                                                         // 20
                                                                                                                // 21
// The reload safetybelt is some js that will be loaded after everything else in                                // 22
// the HTML.  In some multi-server deployments, when you update, you have a                                     // 23
// chance of hitting an old server for the HTML and the new server for the JS or                                // 24
// CSS.  This prevents you from displaying the page in that case, and instead                                   // 25
// reloads it, presumably all on the new version now.                                                           // 26
var RELOAD_SAFETYBELT = "\n" +                                                                                  // 27
      "if (typeof Package === 'undefined' || \n" +                                                              // 28
      "    ! Package.webapp || \n" +                                                                            // 29
      "    ! Package.webapp.WebApp || \n" +                                                                     // 30
      "    ! Package.webapp.WebApp._isCssLoaded()) \n" +                                                        // 31
      "  document.location.reload(); \n";                                                                       // 32
                                                                                                                // 33
// Keepalives so that when the outer server dies unceremoniously and                                            // 34
// doesn't kill us, we quit ourselves. A little gross, but better than                                          // 35
// pidfiles.                                                                                                    // 36
// XXX This should really be part of the boot script, not the webapp package.                                   // 37
//     Or we should just get rid of it, and rely on containerization.                                           // 38
                                                                                                                // 39
var initKeepalive = function () {                                                                               // 40
  var keepaliveCount = 0;                                                                                       // 41
                                                                                                                // 42
  process.stdin.on('data', function (data) {                                                                    // 43
    keepaliveCount = 0;                                                                                         // 44
  });                                                                                                           // 45
                                                                                                                // 46
  process.stdin.resume();                                                                                       // 47
                                                                                                                // 48
  setInterval(function () {                                                                                     // 49
    keepaliveCount ++;                                                                                          // 50
    if (keepaliveCount >= 3) {                                                                                  // 51
      console.log("Failed to receive keepalive! Exiting.");                                                     // 52
      process.exit(1);                                                                                          // 53
    }                                                                                                           // 54
  }, 3000);                                                                                                     // 55
};                                                                                                              // 56
                                                                                                                // 57
                                                                                                                // 58
var sha1 = function (contents) {                                                                                // 59
  var hash = crypto.createHash('sha1');                                                                         // 60
  hash.update(contents);                                                                                        // 61
  return hash.digest('hex');                                                                                    // 62
};                                                                                                              // 63
                                                                                                                // 64
// #BrowserIdentification                                                                                       // 65
//                                                                                                              // 66
// We have multiple places that want to identify the browser: the                                               // 67
// unsupported browser page, the appcache package, and, eventually                                              // 68
// delivering browser polyfills only as needed.                                                                 // 69
//                                                                                                              // 70
// To avoid detecting the browser in multiple places ad-hoc, we create a                                        // 71
// Meteor "browser" object. It uses but does not expose the npm                                                 // 72
// useragent module (we could choose a different mechanism to identify                                          // 73
// the browser in the future if we wanted to).  The browser object                                              // 74
// contains                                                                                                     // 75
//                                                                                                              // 76
// * `name`: the name of the browser in camel case                                                              // 77
// * `major`, `minor`, `patch`: integers describing the browser version                                         // 78
//                                                                                                              // 79
// Also here is an early version of a Meteor `request` object, intended                                         // 80
// to be a high-level description of the request without exposing                                               // 81
// details of connect's low-level `req`.  Currently it contains:                                                // 82
//                                                                                                              // 83
// * `browser`: browser identification object described above                                                   // 84
// * `url`: parsed url, including parsed query params                                                           // 85
//                                                                                                              // 86
// As a temporary hack there is a `categorizeRequest` function on WebApp which                                  // 87
// converts a connect `req` to a Meteor `request`. This can go away once smart                                  // 88
// packages such as appcache are being passed a `request` object directly when                                  // 89
// they serve content.                                                                                          // 90
//                                                                                                              // 91
// This allows `request` to be used uniformly: it is passed to the html                                         // 92
// attributes hook, and the appcache package can use it when deciding                                           // 93
// whether to generate a 404 for the manifest.                                                                  // 94
//                                                                                                              // 95
// Real routing / server side rendering will probably refactor this                                             // 96
// heavily.                                                                                                     // 97
                                                                                                                // 98
                                                                                                                // 99
// e.g. "Mobile Safari" => "mobileSafari"                                                                       // 100
var camelCase = function (name) {                                                                               // 101
  var parts = name.split(' ');                                                                                  // 102
  parts[0] = parts[0].toLowerCase();                                                                            // 103
  for (var i = 1;  i < parts.length;  ++i) {                                                                    // 104
    parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);                                           // 105
  }                                                                                                             // 106
  return parts.join('');                                                                                        // 107
};                                                                                                              // 108
                                                                                                                // 109
var identifyBrowser = function (userAgentString) {                                                              // 110
  var userAgent = useragent.lookup(userAgentString);                                                            // 111
  return {                                                                                                      // 112
    name: camelCase(userAgent.family),                                                                          // 113
    major: +userAgent.major,                                                                                    // 114
    minor: +userAgent.minor,                                                                                    // 115
    patch: +userAgent.patch                                                                                     // 116
  };                                                                                                            // 117
};                                                                                                              // 118
                                                                                                                // 119
// XXX Refactor as part of implementing real routing.                                                           // 120
WebAppInternals.identifyBrowser = identifyBrowser;                                                              // 121
                                                                                                                // 122
WebApp.categorizeRequest = function (req) {                                                                     // 123
  return {                                                                                                      // 124
    browser: identifyBrowser(req.headers['user-agent']),                                                        // 125
    url: url.parse(req.url, true)                                                                               // 126
  };                                                                                                            // 127
};                                                                                                              // 128
                                                                                                                // 129
// HTML attribute hooks: functions to be called to determine any attributes to                                  // 130
// be added to the '<html>' tag. Each function is passed a 'request' object (see                                // 131
// #BrowserIdentification) and should return a string,                                                          // 132
var htmlAttributeHooks = [];                                                                                    // 133
var htmlAttributes = function (template, request) {                                                             // 134
  var attributes = '';                                                                                          // 135
  _.each(htmlAttributeHooks || [], function (hook) {                                                            // 136
    var attribute = hook(request);                                                                              // 137
    if (attribute !== null && attribute !== undefined && attribute !== '')                                      // 138
      attributes += ' ' + attribute;                                                                            // 139
  });                                                                                                           // 140
  return template.replace('##HTML_ATTRIBUTES##', attributes);                                                   // 141
};                                                                                                              // 142
WebApp.addHtmlAttributeHook = function (hook) {                                                                 // 143
  htmlAttributeHooks.push(hook);                                                                                // 144
};                                                                                                              // 145
                                                                                                                // 146
// Serve app HTML for this URL?                                                                                 // 147
var appUrl = function (url) {                                                                                   // 148
  if (url === '/favicon.ico' || url === '/robots.txt')                                                          // 149
    return false;                                                                                               // 150
                                                                                                                // 151
  // NOTE: app.manifest is not a web standard like favicon.ico and                                              // 152
  // robots.txt. It is a file name we have chosen to use for HTML5                                              // 153
  // appcache URLs. It is included here to prevent using an appcache                                            // 154
  // then removing it from poisoning an app permanently. Eventually,                                            // 155
  // once we have server side routing, this won't be needed as                                                  // 156
  // unknown URLs with return a 404 automatically.                                                              // 157
  if (url === '/app.manifest')                                                                                  // 158
    return false;                                                                                               // 159
                                                                                                                // 160
  // Avoid serving app HTML for declared routes such as /sockjs/.                                               // 161
  if (RoutePolicy.classify(url))                                                                                // 162
    return false;                                                                                               // 163
                                                                                                                // 164
  // we currently return app HTML on all URLs by default                                                        // 165
  return true;                                                                                                  // 166
};                                                                                                              // 167
                                                                                                                // 168
                                                                                                                // 169
// Calculate a hash of all the client resources downloaded by the                                               // 170
// browser, including the application HTML, runtime config, code, and                                           // 171
// static files.                                                                                                // 172
//                                                                                                              // 173
// This hash *must* change if any resources seen by the browser                                                 // 174
// change, and ideally *doesn't* change for any server-only changes                                             // 175
// (but the second is a performance enhancement, not a hard                                                     // 176
// requirement).                                                                                                // 177
                                                                                                                // 178
var calculateClientHash = function () {                                                                         // 179
  var hash = crypto.createHash('sha1');                                                                         // 180
  hash.update(JSON.stringify(__meteor_runtime_config__), 'utf8');                                               // 181
  _.each(WebApp.clientProgram.manifest, function (resource) {                                                   // 182
    if (resource.where === 'client' || resource.where === 'internal') {                                         // 183
      hash.update(resource.path);                                                                               // 184
      hash.update(resource.hash);                                                                               // 185
    }                                                                                                           // 186
  });                                                                                                           // 187
  return hash.digest('hex');                                                                                    // 188
};                                                                                                              // 189
                                                                                                                // 190
                                                                                                                // 191
// We need to calculate the client hash after all packages have loaded                                          // 192
// to give them a chance to populate __meteor_runtime_config__.                                                 // 193
//                                                                                                              // 194
// Calculating the hash during startup means that packages can only                                             // 195
// populate __meteor_runtime_config__ during load, not during startup.                                          // 196
//                                                                                                              // 197
// Calculating instead it at the beginning of main after all startup                                            // 198
// hooks had run would allow packages to also populate                                                          // 199
// __meteor_runtime_config__ during startup, but that's too late for                                            // 200
// autoupdate because it needs to have the client hash at startup to                                            // 201
// insert the auto update version itself into                                                                   // 202
// __meteor_runtime_config__ to get it to the client.                                                           // 203
//                                                                                                              // 204
// An alternative would be to give autoupdate a "post-start,                                                    // 205
// pre-listen" hook to allow it to insert the auto update version at                                            // 206
// the right moment.                                                                                            // 207
                                                                                                                // 208
Meteor.startup(function () {                                                                                    // 209
  WebApp.clientHash = calculateClientHash();                                                                    // 210
});                                                                                                             // 211
                                                                                                                // 212
                                                                                                                // 213
                                                                                                                // 214
// When we have a request pending, we want the socket timeout to be long, to                                    // 215
// give ourselves a while to serve it, and to allow sockjs long polls to                                        // 216
// complete.  On the other hand, we want to close idle sockets relatively                                       // 217
// quickly, so that we can shut down relatively promptly but cleanly, without                                   // 218
// cutting off anyone's response.                                                                               // 219
WebApp._timeoutAdjustmentRequestCallback = function (req, res) {                                                // 220
  // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);                                            // 221
  req.setTimeout(LONG_SOCKET_TIMEOUT);                                                                          // 222
  // Insert our new finish listener to run BEFORE the existing one which removes                                // 223
  // the response from the socket.                                                                              // 224
  var finishListeners = res.listeners('finish');                                                                // 225
  // XXX Apparently in Node 0.12 this event is now called 'prefinish'.                                          // 226
  // https://github.com/joyent/node/commit/7c9b6070                                                             // 227
  res.removeAllListeners('finish');                                                                             // 228
  res.on('finish', function () {                                                                                // 229
    res.setTimeout(SHORT_SOCKET_TIMEOUT);                                                                       // 230
  });                                                                                                           // 231
  _.each(finishListeners, function (l) { res.on('finish', l); });                                               // 232
};                                                                                                              // 233
                                                                                                                // 234
var runWebAppServer = function () {                                                                             // 235
  var shuttingDown = false;                                                                                     // 236
  // read the control for the client we'll be serving up                                                        // 237
  var clientJsonPath = path.join(__meteor_bootstrap__.serverDir,                                                // 238
                                 __meteor_bootstrap__.configJson.client);                                       // 239
  var clientDir = path.dirname(clientJsonPath);                                                                 // 240
  var clientJson = JSON.parse(fs.readFileSync(clientJsonPath, 'utf8'));                                         // 241
                                                                                                                // 242
  if (clientJson.format !== "browser-program-pre1")                                                             // 243
    throw new Error("Unsupported format for client assets: " +                                                  // 244
                    JSON.stringify(clientJson.format));                                                         // 245
                                                                                                                // 246
  // webserver                                                                                                  // 247
  var app = connect();                                                                                          // 248
                                                                                                                // 249
  // Auto-compress any json, javascript, or text.                                                               // 250
  app.use(connect.compress());                                                                                  // 251
                                                                                                                // 252
  // Packages and apps can add handlers that run before any other Meteor                                        // 253
  // handlers via WebApp.rawConnectHandlers.                                                                    // 254
  var rawConnectHandlers = connect();                                                                           // 255
  app.use(rawConnectHandlers);                                                                                  // 256
                                                                                                                // 257
  // Strip off the path prefix, if it exists.                                                                   // 258
  app.use(function (request, response, next) {                                                                  // 259
    var pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;                                            // 260
    var url = Npm.require('url').parse(request.url);                                                            // 261
    var pathname = url.pathname;                                                                                // 262
    // check if the path in the url starts with the path prefix (and the part                                   // 263
    // after the path prefix must start with a / if it exists.)                                                 // 264
    if (pathPrefix && pathname.substring(0, pathPrefix.length) === pathPrefix &&                                // 265
       (pathname.length == pathPrefix.length                                                                    // 266
        || pathname.substring(pathPrefix.length, pathPrefix.length + 1) === "/")) {                             // 267
      request.url = request.url.substring(pathPrefix.length);                                                   // 268
      next();                                                                                                   // 269
    } else if (pathname === "/favicon.ico" || pathname === "/robots.txt") {                                     // 270
      next();                                                                                                   // 271
    } else if (pathPrefix) {                                                                                    // 272
      response.writeHead(404);                                                                                  // 273
      response.write("Unknown path");                                                                           // 274
      response.end();                                                                                           // 275
    } else {                                                                                                    // 276
      next();                                                                                                   // 277
    }                                                                                                           // 278
  });                                                                                                           // 279
                                                                                                                // 280
  // Parse the query string into res.query. Used by oauth_server, but it's                                      // 281
  // generally pretty handy..                                                                                   // 282
  app.use(connect.query());                                                                                     // 283
                                                                                                                // 284
  var getItemPathname = function (itemUrl) {                                                                    // 285
    return decodeURIComponent(url.parse(itemUrl).pathname);                                                     // 286
  };                                                                                                            // 287
                                                                                                                // 288
  var staticFiles = {};                                                                                         // 289
  _.each(clientJson.manifest, function (item) {                                                                 // 290
    if (item.url && item.where === "client") {                                                                  // 291
      staticFiles[getItemPathname(item.url)] = {                                                                // 292
        path: item.path,                                                                                        // 293
        cacheable: item.cacheable,                                                                              // 294
        // Link from source to its map                                                                          // 295
        sourceMapUrl: item.sourceMapUrl                                                                         // 296
      };                                                                                                        // 297
                                                                                                                // 298
      if (item.sourceMap) {                                                                                     // 299
        // Serve the source map too, under the specified URL. We assume all                                     // 300
        // source maps are cacheable.                                                                           // 301
        staticFiles[getItemPathname(item.sourceMapUrl)] = {                                                     // 302
          path: item.sourceMap,                                                                                 // 303
          cacheable: true                                                                                       // 304
        };                                                                                                      // 305
      }                                                                                                         // 306
    }                                                                                                           // 307
  });                                                                                                           // 308
                                                                                                                // 309
                                                                                                                // 310
  // Serve static files from the manifest.                                                                      // 311
  // This is inspired by the 'static' middleware.                                                               // 312
  app.use(function (req, res, next) {                                                                           // 313
    if ('GET' != req.method && 'HEAD' != req.method) {                                                          // 314
      next();                                                                                                   // 315
      return;                                                                                                   // 316
    }                                                                                                           // 317
    var pathname = connect.utils.parseUrl(req).pathname;                                                        // 318
                                                                                                                // 319
    try {                                                                                                       // 320
      pathname = decodeURIComponent(pathname);                                                                  // 321
    } catch (e) {                                                                                               // 322
      next();                                                                                                   // 323
      return;                                                                                                   // 324
    }                                                                                                           // 325
                                                                                                                // 326
    var serveStaticJs = function (s) {                                                                          // 327
      res.writeHead(200, { 'Content-type': 'application/javascript' });                                         // 328
      res.write(s);                                                                                             // 329
      res.end();                                                                                                // 330
    };                                                                                                          // 331
                                                                                                                // 332
    if (pathname === "/meteor_runtime_config.js" &&                                                             // 333
        ! WebAppInternals.inlineScriptsAllowed()) {                                                             // 334
      serveStaticJs("__meteor_runtime_config__ = " +                                                            // 335
                    JSON.stringify(__meteor_runtime_config__) + ";");                                           // 336
      return;                                                                                                   // 337
    } else if (pathname === "/meteor_reload_safetybelt.js" &&                                                   // 338
               ! WebAppInternals.inlineScriptsAllowed()) {                                                      // 339
      serveStaticJs(RELOAD_SAFETYBELT);                                                                         // 340
      return;                                                                                                   // 341
    }                                                                                                           // 342
                                                                                                                // 343
    if (!_.has(staticFiles, pathname)) {                                                                        // 344
      next();                                                                                                   // 345
      return;                                                                                                   // 346
    }                                                                                                           // 347
                                                                                                                // 348
    // We don't need to call pause because, unlike 'static', once we call into                                  // 349
    // 'send' and yield to the event loop, we never call another handler with                                   // 350
    // 'next'.                                                                                                  // 351
                                                                                                                // 352
    var info = staticFiles[pathname];                                                                           // 353
                                                                                                                // 354
    // Cacheable files are files that should never change. Typically                                            // 355
    // named by their hash (eg meteor bundled js and css files).                                                // 356
    // We cache them ~forever (1yr).                                                                            // 357
    //                                                                                                          // 358
    // We cache non-cacheable files anyway. This isn't really correct, as users                                 // 359
    // can change the files and changes won't propagate immediately. However, if                                // 360
    // we don't cache them, browsers will 'flicker' when rerendering                                            // 361
    // images. Eventually we will probably want to rewrite URLs of static assets                                // 362
    // to include a query parameter to bust caches. That way we can both get                                    // 363
    // good caching behavior and allow users to change assets without delay.                                    // 364
    // https://github.com/meteor/meteor/issues/773                                                              // 365
    var maxAge = info.cacheable                                                                                 // 366
          ? 1000 * 60 * 60 * 24 * 365                                                                           // 367
          : 1000 * 60 * 60 * 24;                                                                                // 368
                                                                                                                // 369
    // Set the X-SourceMap header, which current Chrome understands.                                            // 370
    // (The files also contain '//#' comments which FF 24 understands and                                       // 371
    // Chrome doesn't understand yet.)                                                                          // 372
    //                                                                                                          // 373
    // Eventually we should set the SourceMap header but the current version of                                 // 374
    // Chrome and no version of FF supports it.                                                                 // 375
    //                                                                                                          // 376
    // To figure out if your version of Chrome should support the SourceMap                                     // 377
    // header,                                                                                                  // 378
    //   - go to chrome://version. Let's say the Chrome version is                                              // 379
    //      28.0.1500.71 and the Blink version is 537.36 (@153022)                                              // 380
    //   - go to http://src.chromium.org/viewvc/blink/branches/chromium/1500/Source/core/inspector/InspectorPageAgent.cpp?view=log
    //     where the "1500" is the third part of your Chrome version                                            // 382
    //   - find the first revision that is no greater than the "153022"                                         // 383
    //     number.  That's probably the first one and it probably has                                           // 384
    //     a message of the form "Branch 1500 - blink@r149738"                                                  // 385
    //   - If *that* revision number (149738) is at least 151755,                                               // 386
    //     then Chrome should support SourceMap (not just X-SourceMap)                                          // 387
    // (The change is https://codereview.chromium.org/15832007)                                                 // 388
    //                                                                                                          // 389
    // You also need to enable source maps in Chrome: open dev tools, click                                     // 390
    // the gear in the bottom right corner, and select "enable source maps".                                    // 391
    //                                                                                                          // 392
    // Firefox 23+ supports source maps but doesn't support either header yet,                                  // 393
    // so we include the '//#' comment for it:                                                                  // 394
    //   https://bugzilla.mozilla.org/show_bug.cgi?id=765993                                                    // 395
    // In FF 23 you need to turn on `devtools.debugger.source-maps-enabled`                                     // 396
    // in `about:config` (it is on by default in FF 24).                                                        // 397
    if (info.sourceMapUrl)                                                                                      // 398
      res.setHeader('X-SourceMap', info.sourceMapUrl);                                                          // 399
    send(req, path.join(clientDir, info.path))                                                                  // 400
      .maxage(maxAge)                                                                                           // 401
      .hidden(true)  // if we specified a dotfile in the manifest, serve it                                     // 402
      .on('error', function (err) {                                                                             // 403
        Log.error("Error serving static file " + err);                                                          // 404
        res.writeHead(500);                                                                                     // 405
        res.end();                                                                                              // 406
      })                                                                                                        // 407
      .on('directory', function () {                                                                            // 408
        Log.error("Unexpected directory " + info.path);                                                         // 409
        res.writeHead(500);                                                                                     // 410
        res.end();                                                                                              // 411
      })                                                                                                        // 412
      .pipe(res);                                                                                               // 413
  });                                                                                                           // 414
                                                                                                                // 415
  // Packages and apps can add handlers to this via WebApp.connectHandlers.                                     // 416
  // They are inserted before our default handler.                                                              // 417
  var packageAndAppHandlers = connect();                                                                        // 418
  app.use(packageAndAppHandlers);                                                                               // 419
                                                                                                                // 420
  var suppressConnectErrors = false;                                                                            // 421
  // connect knows it is an error handler because it has 4 arguments instead of                                 // 422
  // 3. go figure.  (It is not smart enough to find such a thing if it's hidden                                 // 423
  // inside packageAndAppHandlers.)                                                                             // 424
  app.use(function (err, req, res, next) {                                                                      // 425
    if (!err || !suppressConnectErrors || !req.headers['x-suppress-error']) {                                   // 426
      next(err);                                                                                                // 427
      return;                                                                                                   // 428
    }                                                                                                           // 429
    res.writeHead(err.status, { 'Content-Type': 'text/plain' });                                                // 430
    res.end("An error message");                                                                                // 431
  });                                                                                                           // 432
                                                                                                                // 433
  // Will be updated by main before we listen.                                                                  // 434
  var boilerplateHtml = null;                                                                                   // 435
  app.use(function (req, res, next) {                                                                           // 436
    if (! appUrl(req.url))                                                                                      // 437
      return next();                                                                                            // 438
                                                                                                                // 439
    if (!boilerplateHtml)                                                                                       // 440
      throw new Error("boilerplateHtml should be set before listening!");                                       // 441
                                                                                                                // 442
                                                                                                                // 443
    var headers = {                                                                                             // 444
      'Content-Type':  'text/html; charset=utf-8'                                                               // 445
    };                                                                                                          // 446
    if (shuttingDown)                                                                                           // 447
      headers['Connection'] = 'Close';                                                                          // 448
                                                                                                                // 449
    var request = WebApp.categorizeRequest(req);                                                                // 450
                                                                                                                // 451
    if (request.url.query && request.url.query['meteor_css_resource']) {                                        // 452
      // In this case, we're requesting a CSS resource in the meteor-specific                                   // 453
      // way, but we don't have it.  Serve a static css file that indicates that                                // 454
      // we didn't have it, so we can detect that and refresh.                                                  // 455
      headers['Content-Type'] = 'text/css; charset=utf-8';                                                      // 456
      res.writeHead(200, headers);                                                                              // 457
      res.write(".meteor-css-not-found-error { width: 0px;}");                                                  // 458
      res.end();                                                                                                // 459
      return undefined;                                                                                         // 460
    }                                                                                                           // 461
    res.writeHead(200, headers);                                                                                // 462
    var requestSpecificHtml = htmlAttributes(boilerplateHtml, request);                                         // 463
    res.write(requestSpecificHtml);                                                                             // 464
    res.end();                                                                                                  // 465
    return undefined;                                                                                           // 466
  });                                                                                                           // 467
                                                                                                                // 468
  // Return 404 by default, if no other handlers serve this URL.                                                // 469
  app.use(function (req, res) {                                                                                 // 470
    res.writeHead(404);                                                                                         // 471
    res.end();                                                                                                  // 472
  });                                                                                                           // 473
                                                                                                                // 474
                                                                                                                // 475
  var httpServer = http.createServer(app);                                                                      // 476
  var onListeningCallbacks = [];                                                                                // 477
                                                                                                                // 478
  // After 5 seconds w/o data on a socket, kill it.  On the other hand, if                                      // 479
  // there's an outstanding request, give it a higher timeout instead (to avoid                                 // 480
  // killing long-polling requests)                                                                             // 481
  httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);                                                                  // 482
                                                                                                                // 483
  // Do this here, and then also in livedata/stream_server.js, because                                          // 484
  // stream_server.js kills all the current request handlers when installing its                                // 485
  // own.                                                                                                       // 486
  httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);                                           // 487
                                                                                                                // 488
                                                                                                                // 489
  // For now, handle SIGHUP here.  Later, this should be in some centralized                                    // 490
  // Meteor shutdown code.                                                                                      // 491
  process.on('SIGHUP', Meteor.bindEnvironment(function () {                                                     // 492
    shuttingDown = true;                                                                                        // 493
    // tell others with websockets open that we plan to close this.                                             // 494
    // XXX: Eventually, this should be done with a standard meteor shut-down                                    // 495
    // logic path.                                                                                              // 496
    httpServer.emit('meteor-closing');                                                                          // 497
                                                                                                                // 498
    httpServer.close(Meteor.bindEnvironment(function () {                                                       // 499
      if (proxy) {                                                                                              // 500
        try {                                                                                                   // 501
          proxy.call('removeBindingsForJob', process.env.GALAXY_JOB);                                           // 502
        } catch (e) {                                                                                           // 503
          Log.error("Error removing bindings: " + e.message);                                                   // 504
          process.exit(1);                                                                                      // 505
        }                                                                                                       // 506
      }                                                                                                         // 507
      process.exit(0);                                                                                          // 508
                                                                                                                // 509
    }, "On http server close failed"));                                                                         // 510
                                                                                                                // 511
    // Ideally we will close before this hits.                                                                  // 512
    Meteor.setTimeout(function () {                                                                             // 513
      Log.warn("Closed by SIGHUP but one or more HTTP requests may not have finished.");                        // 514
      process.exit(1);                                                                                          // 515
    }, 5000);                                                                                                   // 516
                                                                                                                // 517
  }, function (err) {                                                                                           // 518
    console.log(err);                                                                                           // 519
    process.exit(1);                                                                                            // 520
  }));                                                                                                          // 521
                                                                                                                // 522
  // start up app                                                                                               // 523
  _.extend(WebApp, {                                                                                            // 524
    connectHandlers: packageAndAppHandlers,                                                                     // 525
    rawConnectHandlers: rawConnectHandlers,                                                                     // 526
    httpServer: httpServer,                                                                                     // 527
    // metadata about the client program that we serve                                                          // 528
    clientProgram: {                                                                                            // 529
      manifest: clientJson.manifest                                                                             // 530
      // XXX do we need a "root: clientDir" field here? it used to be here but                                  // 531
      // was unused.                                                                                            // 532
    },                                                                                                          // 533
    // For testing.                                                                                             // 534
    suppressConnectErrors: function () {                                                                        // 535
      suppressConnectErrors = true;                                                                             // 536
    },                                                                                                          // 537
    onListening: function (f) {                                                                                 // 538
      if (onListeningCallbacks)                                                                                 // 539
        onListeningCallbacks.push(f);                                                                           // 540
      else                                                                                                      // 541
        f();                                                                                                    // 542
    },                                                                                                          // 543
    // Hack: allow http tests to call connect.basicAuth without making them                                     // 544
    // Npm.depends on another copy of connect. (That would be fine if we could                                  // 545
    // have test-only NPM dependencies but is overkill here.)                                                   // 546
    __basicAuth__: connect.basicAuth                                                                            // 547
  });                                                                                                           // 548
                                                                                                                // 549
  // Let the rest of the packages (and Meteor.startup hooks) insert connect                                     // 550
  // middlewares and update __meteor_runtime_config__, then keep going to set up                                // 551
  // actually serving HTML.                                                                                     // 552
  main = function (argv) {                                                                                      // 553
    // main happens post startup hooks, so we don't need a Meteor.startup() to                                  // 554
    // ensure this happens after the galaxy package is loaded.                                                  // 555
    var AppConfig = Package["application-configuration"].AppConfig;                                             // 556
    // We used to use the optimist npm package to parse argv here, but it's                                     // 557
    // overkill (and no longer in the dev bundle). Just assume any instance of                                  // 558
    // '--keepalive' is a use of the option.                                                                    // 559
    var expectKeepalives = _.contains(argv, '--keepalive');                                                     // 560
                                                                                                                // 561
    var boilerplateHtmlPath = path.join(clientDir, clientJson.page);                                            // 562
    boilerplateHtml = fs.readFileSync(boilerplateHtmlPath, 'utf8');                                             // 563
                                                                                                                // 564
    // Include __meteor_runtime_config__ in the app html, as an inline script if                                // 565
    // it's not forbidden by CSP.                                                                               // 566
    if (WebAppInternals.inlineScriptsAllowed()) {                                                               // 567
      boilerplateHtml = boilerplateHtml.replace(                                                                // 568
          /##RUNTIME_CONFIG##/,                                                                                 // 569
        "<script type='text/javascript'>__meteor_runtime_config__ = " +                                         // 570
          JSON.stringify(__meteor_runtime_config__) + ";</script>");                                            // 571
      boilerplateHtml = boilerplateHtml.replace(                                                                // 572
          /##RELOAD_SAFETYBELT##/,                                                                              // 573
        "<script type='text/javascript'>"+RELOAD_SAFETYBELT+"</script>");                                       // 574
    } else {                                                                                                    // 575
      boilerplateHtml = boilerplateHtml.replace(                                                                // 576
        /##RUNTIME_CONFIG##/,                                                                                   // 577
        "<script type='text/javascript' src='##ROOT_URL_PATH_PREFIX##/meteor_runtime_config.js'></script>"      // 578
      );                                                                                                        // 579
      boilerplateHtml = boilerplateHtml.replace(                                                                // 580
          /##RELOAD_SAFETYBELT##/,                                                                              // 581
        "<script type='text/javascript' src='##ROOT_URL_PATH_PREFIX##/meteor_reload_safetybelt.js'></script>"); // 582
                                                                                                                // 583
    }                                                                                                           // 584
    boilerplateHtml = boilerplateHtml.replace(                                                                  // 585
        /##ROOT_URL_PATH_PREFIX##/g,                                                                            // 586
      __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "");                                                    // 587
                                                                                                                // 588
    boilerplateHtml = boilerplateHtml.replace(                                                                  // 589
        /##BUNDLED_JS_CSS_PREFIX##/g,                                                                           // 590
      bundledJsCssPrefix ||                                                                                     // 591
        __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || "");                                                  // 592
                                                                                                                // 593
    // only start listening after all the startup code has run.                                                 // 594
    var localPort = parseInt(process.env.PORT) || 0;                                                            // 595
    var host = process.env.BIND_IP;                                                                             // 596
    var localIp = host || '0.0.0.0';                                                                            // 597
    httpServer.listen(localPort, localIp, Meteor.bindEnvironment(function() {                                   // 598
      if (expectKeepalives)                                                                                     // 599
        console.log("LISTENING"); // must match run-app.js                                                      // 600
      var proxyBinding;                                                                                         // 601
                                                                                                                // 602
      AppConfig.configurePackage('webapp', function (configuration) {                                           // 603
        if (proxyBinding)                                                                                       // 604
          proxyBinding.stop();                                                                                  // 605
        if (configuration && configuration.proxy) {                                                             // 606
          // TODO: We got rid of the place where this checks the app's                                          // 607
          // configuration, because this wants to be configured for some things                                 // 608
          // on a per-job basis.  Discuss w/ teammates.                                                         // 609
          proxyBinding = AppConfig.configureService(                                                            // 610
            "proxy",                                                                                            // 611
            "pre0",                                                                                             // 612
            function (proxyService) {                                                                           // 613
              if (proxyService && ! _.isEmpty(proxyService)) {                                                  // 614
                var proxyConf;                                                                                  // 615
                // XXX Figure out a per-job way to specify bind location                                        // 616
                // (besides hardcoding the location for ADMIN_APP jobs).                                        // 617
                if (process.env.ADMIN_APP) {                                                                    // 618
                  var bindPathPrefix = "";                                                                      // 619
                  if (process.env.GALAXY_APP !== "panel") {                                                     // 620
                    bindPathPrefix = "/" + bindPathPrefix +                                                     // 621
                      encodeURIComponent(                                                                       // 622
                        process.env.GALAXY_APP                                                                  // 623
                      ).replace(/\./g, '_');                                                                    // 624
                  }                                                                                             // 625
                  proxyConf = {                                                                                 // 626
                    bindHost: process.env.GALAXY_NAME,                                                          // 627
                    bindPathPrefix: bindPathPrefix,                                                             // 628
                    requiresAuth: true                                                                          // 629
                  };                                                                                            // 630
                } else {                                                                                        // 631
                  proxyConf = configuration.proxy;                                                              // 632
                }                                                                                               // 633
                Log("Attempting to bind to proxy at " +                                                         // 634
                    proxyService);                                                                              // 635
                WebAppInternals.bindToProxy(_.extend({                                                          // 636
                  proxyEndpoint: proxyService                                                                   // 637
                }, proxyConf));                                                                                 // 638
              }                                                                                                 // 639
            }                                                                                                   // 640
          );                                                                                                    // 641
        }                                                                                                       // 642
      });                                                                                                       // 643
                                                                                                                // 644
      var callbacks = onListeningCallbacks;                                                                     // 645
      onListeningCallbacks = null;                                                                              // 646
      _.each(callbacks, function (x) { x(); });                                                                 // 647
                                                                                                                // 648
    }, function (e) {                                                                                           // 649
      console.error("Error listening:", e);                                                                     // 650
      console.error(e && e.stack);                                                                              // 651
    }));                                                                                                        // 652
                                                                                                                // 653
    if (expectKeepalives)                                                                                       // 654
      initKeepalive();                                                                                          // 655
    return 'DAEMON';                                                                                            // 656
  };                                                                                                            // 657
};                                                                                                              // 658
                                                                                                                // 659
                                                                                                                // 660
var proxy;                                                                                                      // 661
WebAppInternals.bindToProxy = function (proxyConfig) {                                                          // 662
  var securePort = proxyConfig.securePort || 4433;                                                              // 663
  var insecurePort = proxyConfig.insecurePort || 8080;                                                          // 664
  var bindPathPrefix = proxyConfig.bindPathPrefix || "";                                                        // 665
  // XXX also support galaxy-based lookup                                                                       // 666
  if (!proxyConfig.proxyEndpoint)                                                                               // 667
    throw new Error("missing proxyEndpoint");                                                                   // 668
  if (!proxyConfig.bindHost)                                                                                    // 669
    throw new Error("missing bindHost");                                                                        // 670
  if (!process.env.GALAXY_JOB)                                                                                  // 671
    throw new Error("missing $GALAXY_JOB");                                                                     // 672
  if (!process.env.GALAXY_APP)                                                                                  // 673
    throw new Error("missing $GALAXY_APP");                                                                     // 674
  if (!process.env.LAST_START)                                                                                  // 675
    throw new Error("missing $LAST_START");                                                                     // 676
                                                                                                                // 677
  // XXX rename pid argument to bindTo.                                                                         // 678
  // XXX factor out into a 'getPid' function in a 'galaxy' package?                                             // 679
  var pid = {                                                                                                   // 680
    job: process.env.GALAXY_JOB,                                                                                // 681
    lastStarted: +(process.env.LAST_START),                                                                     // 682
    app: process.env.GALAXY_APP                                                                                 // 683
  };                                                                                                            // 684
  var myHost = os.hostname();                                                                                   // 685
                                                                                                                // 686
  WebAppInternals.usingDdpProxy = true;                                                                         // 687
                                                                                                                // 688
  // This is run after packages are loaded (in main) so we can use                                              // 689
  // Follower.connect.                                                                                          // 690
  if (proxy) {                                                                                                  // 691
    // XXX the concept here is that our configuration has changed and                                           // 692
    // we have connected to an entirely new follower set, which does                                            // 693
    // not have the state that we set up on the follower set that we                                            // 694
    // were previously connected to, and so we need to recreate all of                                          // 695
    // our bindings -- analogous to getting a SIGHUP and rereading                                              // 696
    // your configuration file. so probably this should actually tear                                           // 697
    // down the connection and make a whole new one, rather than                                                // 698
    // hot-reconnecting to a different URL.                                                                     // 699
    proxy.reconnect({                                                                                           // 700
      url: proxyConfig.proxyEndpoint                                                                            // 701
    });                                                                                                         // 702
  } else {                                                                                                      // 703
    proxy = Package["follower-livedata"].Follower.connect(                                                      // 704
      proxyConfig.proxyEndpoint, {                                                                              // 705
        group: "proxy"                                                                                          // 706
      }                                                                                                         // 707
    );                                                                                                          // 708
  }                                                                                                             // 709
                                                                                                                // 710
  var route = process.env.ROUTE;                                                                                // 711
  var ourHost = route.split(":")[0];                                                                            // 712
  var ourPort = +route.split(":")[1];                                                                           // 713
                                                                                                                // 714
  var outstanding = 0;                                                                                          // 715
  var startedAll = false;                                                                                       // 716
  var checkComplete = function () {                                                                             // 717
    if (startedAll && ! outstanding)                                                                            // 718
      Log("Bound to proxy.");                                                                                   // 719
  };                                                                                                            // 720
  var makeCallback = function () {                                                                              // 721
    outstanding++;                                                                                              // 722
    return function (err) {                                                                                     // 723
      if (err)                                                                                                  // 724
        throw err;                                                                                              // 725
      outstanding--;                                                                                            // 726
      checkComplete();                                                                                          // 727
    };                                                                                                          // 728
  };                                                                                                            // 729
                                                                                                                // 730
  // for now, have our (temporary) requiresAuth flag apply to all                                               // 731
  // routes created by this process.                                                                            // 732
  var requiresDdpAuth = !! proxyConfig.requiresAuth;                                                            // 733
  var requiresHttpAuth = (!! proxyConfig.requiresAuth) &&                                                       // 734
        (pid.app !== "panel" && pid.app !== "auth");                                                            // 735
                                                                                                                // 736
  // XXX a current limitation is that we treat securePort and                                                   // 737
  // insecurePort as a global configuration parameter -- we assume                                              // 738
  // that if the proxy wants us to ask for 8080 to get port 80 traffic                                          // 739
  // on our default hostname, that's the same port that we would use                                            // 740
  // to get traffic on some other hostname that our proxy listens                                               // 741
  // for. Likewise, we assume that if the proxy can receive secure                                              // 742
  // traffic for our domain, it can assume secure traffic for any                                               // 743
  // domain! Hopefully this will get cleaned up before too long by                                              // 744
  // pushing that logic into the proxy service, so we can just ask for                                          // 745
  // port 80.                                                                                                   // 746
                                                                                                                // 747
  // XXX BUG: if our configuration changes, and bindPathPrefix                                                  // 748
  // changes, it appears that we will not remove the routes derived                                             // 749
  // from the old bindPathPrefix from the proxy (until the process                                              // 750
  // exits). It is not actually normal for bindPathPrefix to change,                                            // 751
  // certainly not without a process restart for other reasons, but                                             // 752
  // it'd be nice to fix.                                                                                       // 753
                                                                                                                // 754
  _.each(routes, function (route) {                                                                             // 755
    var parsedUrl = url.parse(route.url, /* parseQueryString */ false,                                          // 756
                              /* slashesDenoteHost aka workRight */ true);                                      // 757
    if (parsedUrl.protocol || parsedUrl.port || parsedUrl.search)                                               // 758
      throw new Error("Bad url");                                                                               // 759
    parsedUrl.host = null;                                                                                      // 760
    parsedUrl.path = null;                                                                                      // 761
    if (! parsedUrl.hostname) {                                                                                 // 762
      parsedUrl.hostname = proxyConfig.bindHost;                                                                // 763
      if (! parsedUrl.pathname)                                                                                 // 764
        parsedUrl.pathname = "";                                                                                // 765
      if (! parsedUrl.pathname.indexOf("/") !== 0) {                                                            // 766
        // Relative path                                                                                        // 767
        parsedUrl.pathname = bindPathPrefix + parsedUrl.pathname;                                               // 768
      }                                                                                                         // 769
    }                                                                                                           // 770
    var version = "";                                                                                           // 771
                                                                                                                // 772
    var AppConfig = Package["application-configuration"].AppConfig;                                             // 773
    version = AppConfig.getStarForThisJob() || "";                                                              // 774
                                                                                                                // 775
                                                                                                                // 776
    var parsedDdpUrl = _.clone(parsedUrl);                                                                      // 777
    parsedDdpUrl.protocol = "ddp";                                                                              // 778
    // Node has a hardcoded list of protocols that get '://' instead                                            // 779
    // of ':'. ddp needs to be added to that whitelist. Until then, we                                          // 780
    // can set the undocumented attribute 'slashes' to get the right                                            // 781
    // behavior. It's not clear whether than is by design or accident.                                          // 782
    parsedDdpUrl.slashes = true;                                                                                // 783
    parsedDdpUrl.port = '' + securePort;                                                                        // 784
    var ddpUrl = url.format(parsedDdpUrl);                                                                      // 785
                                                                                                                // 786
    var proxyToHost, proxyToPort, proxyToPathPrefix;                                                            // 787
    if (! _.has(route, 'forwardTo')) {                                                                          // 788
      proxyToHost = ourHost;                                                                                    // 789
      proxyToPort = ourPort;                                                                                    // 790
      proxyToPathPrefix = parsedUrl.pathname;                                                                   // 791
    } else {                                                                                                    // 792
      var parsedFwdUrl = url.parse(route.forwardTo, false, true);                                               // 793
      if (! parsedFwdUrl.hostname || parsedFwdUrl.protocol)                                                     // 794
        throw new Error("Bad forward url");                                                                     // 795
      proxyToHost = parsedFwdUrl.hostname;                                                                      // 796
      proxyToPort = parseInt(parsedFwdUrl.port || "80");                                                        // 797
      proxyToPathPrefix = parsedFwdUrl.pathname || "";                                                          // 798
    }                                                                                                           // 799
                                                                                                                // 800
    if (route.ddp) {                                                                                            // 801
      proxy.call('bindDdp', {                                                                                   // 802
        pid: pid,                                                                                               // 803
        bindTo: {                                                                                               // 804
          ddpUrl: ddpUrl,                                                                                       // 805
          insecurePort: insecurePort                                                                            // 806
        },                                                                                                      // 807
        proxyTo: {                                                                                              // 808
          tags: [version],                                                                                      // 809
          host: proxyToHost,                                                                                    // 810
          port: proxyToPort,                                                                                    // 811
          pathPrefix: proxyToPathPrefix + '/websocket'                                                          // 812
        },                                                                                                      // 813
        requiresAuth: requiresDdpAuth                                                                           // 814
      }, makeCallback());                                                                                       // 815
    }                                                                                                           // 816
                                                                                                                // 817
    if (route.http) {                                                                                           // 818
      proxy.call('bindHttp', {                                                                                  // 819
        pid: pid,                                                                                               // 820
        bindTo: {                                                                                               // 821
          host: parsedUrl.hostname,                                                                             // 822
          port: insecurePort,                                                                                   // 823
          pathPrefix: parsedUrl.pathname                                                                        // 824
        },                                                                                                      // 825
        proxyTo: {                                                                                              // 826
          tags: [version],                                                                                      // 827
          host: proxyToHost,                                                                                    // 828
          port: proxyToPort,                                                                                    // 829
          pathPrefix: proxyToPathPrefix                                                                         // 830
        },                                                                                                      // 831
        requiresAuth: requiresHttpAuth                                                                          // 832
      }, makeCallback());                                                                                       // 833
                                                                                                                // 834
      // Only make the secure binding if we've been told that the                                               // 835
      // proxy knows how terminate secure connections for us (has an                                            // 836
      // appropriate cert, can bind the necessary port..)                                                       // 837
      if (proxyConfig.securePort !== null) {                                                                    // 838
        proxy.call('bindHttp', {                                                                                // 839
          pid: pid,                                                                                             // 840
          bindTo: {                                                                                             // 841
            host: parsedUrl.hostname,                                                                           // 842
            port: securePort,                                                                                   // 843
            pathPrefix: parsedUrl.pathname,                                                                     // 844
            ssl: true                                                                                           // 845
          },                                                                                                    // 846
          proxyTo: {                                                                                            // 847
            tags: [version],                                                                                    // 848
            host: proxyToHost,                                                                                  // 849
            port: proxyToPort,                                                                                  // 850
            pathPrefix: proxyToPathPrefix                                                                       // 851
          },                                                                                                    // 852
          requiresAuth: requiresHttpAuth                                                                        // 853
        }, makeCallback());                                                                                     // 854
      }                                                                                                         // 855
    }                                                                                                           // 856
  });                                                                                                           // 857
                                                                                                                // 858
  startedAll = true;                                                                                            // 859
  checkComplete();                                                                                              // 860
};                                                                                                              // 861
                                                                                                                // 862
// (Internal, unsupported interface -- subject to change)                                                       // 863
//                                                                                                              // 864
// Listen for HTTP and/or DDP traffic and route it somewhere. Only                                              // 865
// takes effect when using a proxy service.                                                                     // 866
//                                                                                                              // 867
// 'url' is the traffic that we want to route, interpreted relative to                                          // 868
// the default URL where this app has been told to serve itself. It                                             // 869
// may not have a scheme or port, but it may have a host and a path,                                            // 870
// and if no host is provided the path need not be absolute. The                                                // 871
// following cases are possible:                                                                                // 872
//                                                                                                              // 873
//   //somehost.com                                                                                             // 874
//     All incoming traffic for 'somehost.com'                                                                  // 875
//   //somehost.com/foo/bar                                                                                     // 876
//     All incoming traffic for 'somehost.com', but only when                                                   // 877
//     the first two path components are 'foo' and 'bar'.                                                       // 878
//   /foo/bar                                                                                                   // 879
//     Incoming traffic on our default host, but only when the                                                  // 880
//     first two path components are 'foo' and 'bar'.                                                           // 881
//   foo/bar                                                                                                    // 882
//     Incoming traffic on our default host, but only when the path                                             // 883
//     starts with our default path prefix, followed by 'foo' and                                               // 884
//     'bar'.                                                                                                   // 885
//                                                                                                              // 886
// (Yes, these scheme-less URLs that start with '//' are legal URLs.)                                           // 887
//                                                                                                              // 888
// You can select either DDP traffic, HTTP traffic, or both. Both                                               // 889
// secure and insecure traffic will be gathered (assuming the proxy                                             // 890
// service is capable, eg, has appropriate certs and port mappings).                                            // 891
//                                                                                                              // 892
// With no 'forwardTo' option, the traffic is received by this process                                          // 893
// for service by the hooks in this 'webapp' package. The original URL                                          // 894
// is preserved (that is, if you bind "/a", and a user visits "/a/b",                                           // 895
// the app receives a request with a path of "/a/b", not a path of                                              // 896
// "/b").                                                                                                       // 897
//                                                                                                              // 898
// With 'forwardTo', the process is instead sent to some other remote                                           // 899
// host. The URL is adjusted by stripping the path components in 'url'                                          // 900
// and putting the path components in the 'forwardTo' URL in their                                              // 901
// place. For example, if you forward "//somehost/a" to                                                         // 902
// "//otherhost/x", and the user types "//somehost/a/b" into their                                              // 903
// browser, then otherhost will receive a request with a Host header                                            // 904
// of "somehost" and a path of "/x/b".                                                                          // 905
//                                                                                                              // 906
// The routing continues until this process exits. For now, all of the                                          // 907
// routes must be set up ahead of time, before the initial                                                      // 908
// registration with the proxy. Calling addRoute from the top level of                                          // 909
// your JS should do the trick.                                                                                 // 910
//                                                                                                              // 911
// When multiple routes are present that match a given request, the                                             // 912
// most specific route wins. When routes with equal specificity are                                             // 913
// present, the proxy service will distribute the traffic between                                               // 914
// them.                                                                                                        // 915
//                                                                                                              // 916
// options may be:                                                                                              // 917
// - ddp: if true, the default, include DDP traffic. This includes                                              // 918
//   both secure and insecure traffic, and both websocket and sockjs                                            // 919
//   transports.                                                                                                // 920
// - http: if true, the default, include HTTP/HTTPS traffic.                                                    // 921
// - forwardTo: if provided, should be a URL with a host, optional                                              // 922
//   path and port, and no scheme (the scheme will be derived from the                                          // 923
//   traffic type; for now it will always be a http or ws connection,                                           // 924
//   never https or wss, but we could add a forwardSecure flag to                                               // 925
//   re-encrypt).                                                                                               // 926
var routes = [];                                                                                                // 927
WebAppInternals.addRoute = function (url, options) {                                                            // 928
  options = _.extend({                                                                                          // 929
    ddp: true,                                                                                                  // 930
    http: true                                                                                                  // 931
  }, options || {});                                                                                            // 932
                                                                                                                // 933
  if (proxy)                                                                                                    // 934
    // In the future, lift this restriction                                                                     // 935
    throw new Error("Too late to add routes");                                                                  // 936
                                                                                                                // 937
  routes.push(_.extend({ url: url }, options));                                                                 // 938
};                                                                                                              // 939
                                                                                                                // 940
// Receive traffic on our default URL.                                                                          // 941
WebAppInternals.addRoute("");                                                                                   // 942
                                                                                                                // 943
runWebAppServer();                                                                                              // 944
                                                                                                                // 945
                                                                                                                // 946
var inlineScriptsAllowed = true;                                                                                // 947
                                                                                                                // 948
WebAppInternals.inlineScriptsAllowed = function () {                                                            // 949
  return inlineScriptsAllowed;                                                                                  // 950
};                                                                                                              // 951
                                                                                                                // 952
WebAppInternals.setInlineScriptsAllowed = function (value) {                                                    // 953
  inlineScriptsAllowed = value;                                                                                 // 954
};                                                                                                              // 955
                                                                                                                // 956
WebAppInternals.setBundledJsCssPrefix = function (prefix) {                                                     // 957
  bundledJsCssPrefix = prefix;                                                                                  // 958
};                                                                                                              // 959
                                                                                                                // 960
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.webapp = {
  WebApp: WebApp,
  main: main,
  WebAppInternals: WebAppInternals
};

})();
