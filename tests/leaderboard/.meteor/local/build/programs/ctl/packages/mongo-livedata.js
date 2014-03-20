(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var _ = Package.underscore._;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var Log = Package.logging.Log;
var DDP = Package.livedata.DDP;
var DDPServer = Package.livedata.DDPServer;
var Deps = Package.deps.Deps;
var AppConfig = Package['application-configuration'].AppConfig;
var check = Package.check.check;
var Match = Package.check.Match;
var MaxHeap = Package['binary-heap'].MaxHeap;
var MinMaxHeap = Package['binary-heap'].MinMaxHeap;

/* Package-scope variables */
var MongoInternals, MongoTest, MongoConnection, CursorDescription, Cursor, listenAll, forEachTrigger, OPLOG_COLLECTION, idForOp, OplogHandle, ObserveMultiplexer, ObserveHandle, DocFetcher, PollingObserveDriver, OplogObserveDriver, LocalCollectionDriver;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/mongo_driver.js                                                             //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
/**                                                                                                    // 1
 * Provide a synchronous Collection API using fibers, backed by                                        // 2
 * MongoDB.  This is only for use on the server, and mostly identical                                  // 3
 * to the client API.                                                                                  // 4
 *                                                                                                     // 5
 * NOTE: the public API methods must be run within a fiber. If you call                                // 6
 * these outside of a fiber they will explode!                                                         // 7
 */                                                                                                    // 8
                                                                                                       // 9
var path = Npm.require('path');                                                                        // 10
var MongoDB = Npm.require('mongodb');                                                                  // 11
var Fiber = Npm.require('fibers');                                                                     // 12
var Future = Npm.require(path.join('fibers', 'future'));                                               // 13
                                                                                                       // 14
MongoInternals = {};                                                                                   // 15
MongoTest = {};                                                                                        // 16
                                                                                                       // 17
var replaceNames = function (filter, thing) {                                                          // 18
  if (typeof thing === "object") {                                                                     // 19
    if (_.isArray(thing)) {                                                                            // 20
      return _.map(thing, _.bind(replaceNames, null, filter));                                         // 21
    }                                                                                                  // 22
    var ret = {};                                                                                      // 23
    _.each(thing, function (value, key) {                                                              // 24
      ret[filter(key)] = replaceNames(filter, value);                                                  // 25
    });                                                                                                // 26
    return ret;                                                                                        // 27
  }                                                                                                    // 28
  return thing;                                                                                        // 29
};                                                                                                     // 30
                                                                                                       // 31
// Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just                           // 32
// doing a structural clone).                                                                          // 33
// XXX how ok is this? what if there are multiple copies of MongoDB loaded?                            // 34
MongoDB.Timestamp.prototype.clone = function () {                                                      // 35
  // Timestamps should be immutable.                                                                   // 36
  return this;                                                                                         // 37
};                                                                                                     // 38
                                                                                                       // 39
var makeMongoLegal = function (name) { return "EJSON" + name; };                                       // 40
var unmakeMongoLegal = function (name) { return name.substr(5); };                                     // 41
                                                                                                       // 42
var replaceMongoAtomWithMeteor = function (document) {                                                 // 43
  if (document instanceof MongoDB.Binary) {                                                            // 44
    var buffer = document.value(true);                                                                 // 45
    return new Uint8Array(buffer);                                                                     // 46
  }                                                                                                    // 47
  if (document instanceof MongoDB.ObjectID) {                                                          // 48
    return new Meteor.Collection.ObjectID(document.toHexString());                                     // 49
  }                                                                                                    // 50
  if (document["EJSON$type"] && document["EJSON$value"]) {                                             // 51
    return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));                              // 52
  }                                                                                                    // 53
  if (document instanceof MongoDB.Timestamp) {                                                         // 54
    // For now, the Meteor representation of a Mongo timestamp type (not a date!                       // 55
    // this is a weird internal thing used in the oplog!) is the same as the                           // 56
    // Mongo representation. We need to do this explicitly or else we would do a                       // 57
    // structural clone and lose the prototype.                                                        // 58
    return document;                                                                                   // 59
  }                                                                                                    // 60
  return undefined;                                                                                    // 61
};                                                                                                     // 62
                                                                                                       // 63
var replaceMeteorAtomWithMongo = function (document) {                                                 // 64
  if (EJSON.isBinary(document)) {                                                                      // 65
    // This does more copies than we'd like, but is necessary because                                  // 66
    // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually                        // 67
    // serialize it correctly).                                                                        // 68
    return new MongoDB.Binary(new Buffer(document));                                                   // 69
  }                                                                                                    // 70
  if (document instanceof Meteor.Collection.ObjectID) {                                                // 71
    return new MongoDB.ObjectID(document.toHexString());                                               // 72
  }                                                                                                    // 73
  if (document instanceof MongoDB.Timestamp) {                                                         // 74
    // For now, the Meteor representation of a Mongo timestamp type (not a date!                       // 75
    // this is a weird internal thing used in the oplog!) is the same as the                           // 76
    // Mongo representation. We need to do this explicitly or else we would do a                       // 77
    // structural clone and lose the prototype.                                                        // 78
    return document;                                                                                   // 79
  }                                                                                                    // 80
  if (EJSON._isCustomType(document)) {                                                                 // 81
    return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));                                  // 82
  }                                                                                                    // 83
  // It is not ordinarily possible to stick dollar-sign keys into mongo                                // 84
  // so we don't bother checking for things that need escaping at this time.                           // 85
  return undefined;                                                                                    // 86
};                                                                                                     // 87
                                                                                                       // 88
var replaceTypes = function (document, atomTransformer) {                                              // 89
  if (typeof document !== 'object' || document === null)                                               // 90
    return document;                                                                                   // 91
                                                                                                       // 92
  var replacedTopLevelAtom = atomTransformer(document);                                                // 93
  if (replacedTopLevelAtom !== undefined)                                                              // 94
    return replacedTopLevelAtom;                                                                       // 95
                                                                                                       // 96
  var ret = document;                                                                                  // 97
  _.each(document, function (val, key) {                                                               // 98
    var valReplaced = replaceTypes(val, atomTransformer);                                              // 99
    if (val !== valReplaced) {                                                                         // 100
      // Lazy clone. Shallow copy.                                                                     // 101
      if (ret === document)                                                                            // 102
        ret = _.clone(document);                                                                       // 103
      ret[key] = valReplaced;                                                                          // 104
    }                                                                                                  // 105
  });                                                                                                  // 106
  return ret;                                                                                          // 107
};                                                                                                     // 108
                                                                                                       // 109
                                                                                                       // 110
MongoConnection = function (url, options) {                                                            // 111
  var self = this;                                                                                     // 112
  options = options || {};                                                                             // 113
  self._connectCallbacks = [];                                                                         // 114
  self._observeMultiplexers = {};                                                                      // 115
                                                                                                       // 116
  var mongoOptions = {db: {safe: true}, server: {}, replSet: {}};                                      // 117
                                                                                                       // 118
  // Set autoReconnect to true, unless passed on the URL. Why someone                                  // 119
  // would want to set autoReconnect to false, I'm not really sure, but                                // 120
  // keeping this for backwards compatibility for now.                                                 // 121
  if (!(/[\?&]auto_?[rR]econnect=/.test(url))) {                                                       // 122
    mongoOptions.server.auto_reconnect = true;                                                         // 123
  }                                                                                                    // 124
                                                                                                       // 125
  // Disable the native parser by default, unless specifically enabled                                 // 126
  // in the mongo URL.                                                                                 // 127
  // - The native driver can cause errors which normally would be                                      // 128
  //   thrown, caught, and handled into segfaults that take down the                                   // 129
  //   whole app.                                                                                      // 130
  // - Binary modules don't yet work when you bundle and move the bundle                               // 131
  //   to a different platform (aka deploy)                                                            // 132
  // We should revisit this after binary npm module support lands.                                     // 133
  if (!(/[\?&]native_?[pP]arser=/.test(url))) {                                                        // 134
    mongoOptions.db.native_parser = false;                                                             // 135
  }                                                                                                    // 136
                                                                                                       // 137
  // XXX maybe we should have a better way of allowing users to configure the                          // 138
  // underlying Mongo driver                                                                           // 139
  if (_.has(options, 'poolSize')) {                                                                    // 140
    // If we just set this for "server", replSet will override it. If we just                          // 141
    // set it for replSet, it will be ignored if we're not using a replSet.                            // 142
    mongoOptions.server.poolSize = options.poolSize;                                                   // 143
    mongoOptions.replSet.poolSize = options.poolSize;                                                  // 144
  }                                                                                                    // 145
                                                                                                       // 146
  MongoDB.connect(url, mongoOptions, function(err, db) {                                               // 147
    if (err)                                                                                           // 148
      throw err;                                                                                       // 149
    self.db = db;                                                                                      // 150
                                                                                                       // 151
    Fiber(function () {                                                                                // 152
      // drain queue of pending callbacks                                                              // 153
      _.each(self._connectCallbacks, function (c) {                                                    // 154
        c(db);                                                                                         // 155
      });                                                                                              // 156
    }).run();                                                                                          // 157
  });                                                                                                  // 158
                                                                                                       // 159
  self._docFetcher = new DocFetcher(self);                                                             // 160
  self._oplogHandle = null;                                                                            // 161
                                                                                                       // 162
  if (options.oplogUrl && !Package['disable-oplog']) {                                                 // 163
    var dbNameFuture = new Future;                                                                     // 164
    self._withDb(function (db) {                                                                       // 165
      dbNameFuture.return(db.databaseName);                                                            // 166
    });                                                                                                // 167
    self._oplogHandle = new OplogHandle(options.oplogUrl, dbNameFuture.wait());                        // 168
  }                                                                                                    // 169
};                                                                                                     // 170
                                                                                                       // 171
MongoConnection.prototype.close = function() {                                                         // 172
  var self = this;                                                                                     // 173
                                                                                                       // 174
  // XXX probably untested                                                                             // 175
  var oplogHandle = self._oplogHandle;                                                                 // 176
  self._oplogHandle = null;                                                                            // 177
  if (oplogHandle)                                                                                     // 178
    oplogHandle.stop();                                                                                // 179
                                                                                                       // 180
  // Use Future.wrap so that errors get thrown. This happens to                                        // 181
  // work even outside a fiber since the 'close' method is not                                         // 182
  // actually asynchronous.                                                                            // 183
  Future.wrap(_.bind(self.db.close, self.db))(true).wait();                                            // 184
};                                                                                                     // 185
                                                                                                       // 186
MongoConnection.prototype._withDb = function (callback) {                                              // 187
  var self = this;                                                                                     // 188
  if (self.db) {                                                                                       // 189
    callback(self.db);                                                                                 // 190
  } else {                                                                                             // 191
    self._connectCallbacks.push(callback);                                                             // 192
  }                                                                                                    // 193
};                                                                                                     // 194
                                                                                                       // 195
// Returns the Mongo Collection object; may yield.                                                     // 196
MongoConnection.prototype._getCollection = function (collectionName) {                                 // 197
  var self = this;                                                                                     // 198
                                                                                                       // 199
  var future = new Future;                                                                             // 200
  self._withDb(function (db) {                                                                         // 201
    db.collection(collectionName, future.resolver());                                                  // 202
  });                                                                                                  // 203
  return future.wait();                                                                                // 204
};                                                                                                     // 205
                                                                                                       // 206
MongoConnection.prototype._createCappedCollection = function (collectionName,                          // 207
                                                              byteSize) {                              // 208
  var self = this;                                                                                     // 209
  var future = new Future();                                                                           // 210
  self._withDb(function (db) {                                                                         // 211
    db.createCollection(collectionName, {capped: true, size: byteSize},                                // 212
                        future.resolver());                                                            // 213
  });                                                                                                  // 214
  future.wait();                                                                                       // 215
};                                                                                                     // 216
                                                                                                       // 217
// This should be called synchronously with a write, to create a                                       // 218
// transaction on the current write fence, if any. After we can read                                   // 219
// the write, and after observers have been notified (or at least,                                     // 220
// after the observer notifiers have added themselves to the write                                     // 221
// fence), you should call 'committed()' on the object returned.                                       // 222
MongoConnection.prototype._maybeBeginWrite = function () {                                             // 223
  var self = this;                                                                                     // 224
  var fence = DDPServer._CurrentWriteFence.get();                                                      // 225
  if (fence)                                                                                           // 226
    return fence.beginWrite();                                                                         // 227
  else                                                                                                 // 228
    return {committed: function () {}};                                                                // 229
};                                                                                                     // 230
                                                                                                       // 231
                                                                                                       // 232
//////////// Public API //////////                                                                     // 233
                                                                                                       // 234
// The write methods block until the database has confirmed the write (it may                          // 235
// not be replicated or stable on disk, but one server has confirmed it) if no                         // 236
// callback is provided. If a callback is provided, then they call the callback                        // 237
// when the write is confirmed. They return nothing on success, and raise an                           // 238
// exception on failure.                                                                               // 239
//                                                                                                     // 240
// After making a write (with insert, update, remove), observers are                                   // 241
// notified asynchronously. If you want to receive a callback once all                                 // 242
// of the observer notifications have landed for your write, do the                                    // 243
// writes inside a write fence (set DDPServer._CurrentWriteFence to a new                              // 244
// _WriteFence, and then set a callback on the write fence.)                                           // 245
//                                                                                                     // 246
// Since our execution environment is single-threaded, this is                                         // 247
// well-defined -- a write "has been made" if it's returned, and an                                    // 248
// observer "has been notified" if its callback has returned.                                          // 249
                                                                                                       // 250
var writeCallback = function (write, refresh, callback) {                                              // 251
  return function (err, result) {                                                                      // 252
    if (! err) {                                                                                       // 253
      // XXX We don't have to run this on error, right?                                                // 254
      refresh();                                                                                       // 255
    }                                                                                                  // 256
    write.committed();                                                                                 // 257
    if (callback)                                                                                      // 258
      callback(err, result);                                                                           // 259
    else if (err)                                                                                      // 260
      throw err;                                                                                       // 261
  };                                                                                                   // 262
};                                                                                                     // 263
                                                                                                       // 264
var bindEnvironmentForWrite = function (callback) {                                                    // 265
  return Meteor.bindEnvironment(callback, "Mongo write");                                              // 266
};                                                                                                     // 267
                                                                                                       // 268
MongoConnection.prototype._insert = function (collection_name, document,                               // 269
                                              callback) {                                              // 270
  var self = this;                                                                                     // 271
  if (collection_name === "___meteor_failure_test_collection") {                                       // 272
    var e = new Error("Failure test");                                                                 // 273
    e.expected = true;                                                                                 // 274
    if (callback)                                                                                      // 275
      return callback(e);                                                                              // 276
    else                                                                                               // 277
      throw e;                                                                                         // 278
  }                                                                                                    // 279
                                                                                                       // 280
  var write = self._maybeBeginWrite();                                                                 // 281
  var refresh = function () {                                                                          // 282
    Meteor.refresh({collection: collection_name, id: document._id });                                  // 283
  };                                                                                                   // 284
  callback = bindEnvironmentForWrite(writeCallback(write, refresh, callback));                         // 285
  try {                                                                                                // 286
    var collection = self._getCollection(collection_name);                                             // 287
    collection.insert(replaceTypes(document, replaceMeteorAtomWithMongo),                              // 288
                      {safe: true}, callback);                                                         // 289
  } catch (e) {                                                                                        // 290
    write.committed();                                                                                 // 291
    throw e;                                                                                           // 292
  }                                                                                                    // 293
};                                                                                                     // 294
                                                                                                       // 295
// Cause queries that may be affected by the selector to poll in this write                            // 296
// fence.                                                                                              // 297
MongoConnection.prototype._refresh = function (collectionName, selector) {                             // 298
  var self = this;                                                                                     // 299
  var refreshKey = {collection: collectionName};                                                       // 300
  // If we know which documents we're removing, don't poll queries that are                            // 301
  // specific to other documents. (Note that multiple notifications here should                        // 302
  // not cause multiple polls, since all our listener is doing is enqueueing a                         // 303
  // poll.)                                                                                            // 304
  var specificIds = LocalCollection._idsMatchedBySelector(selector);                                   // 305
  if (specificIds) {                                                                                   // 306
    _.each(specificIds, function (id) {                                                                // 307
      Meteor.refresh(_.extend({id: id}, refreshKey));                                                  // 308
    });                                                                                                // 309
  } else {                                                                                             // 310
    Meteor.refresh(refreshKey);                                                                        // 311
  }                                                                                                    // 312
};                                                                                                     // 313
                                                                                                       // 314
MongoConnection.prototype._remove = function (collection_name, selector,                               // 315
                                              callback) {                                              // 316
  var self = this;                                                                                     // 317
                                                                                                       // 318
  if (collection_name === "___meteor_failure_test_collection") {                                       // 319
    var e = new Error("Failure test");                                                                 // 320
    e.expected = true;                                                                                 // 321
    if (callback)                                                                                      // 322
      return callback(e);                                                                              // 323
    else                                                                                               // 324
      throw e;                                                                                         // 325
  }                                                                                                    // 326
                                                                                                       // 327
  var write = self._maybeBeginWrite();                                                                 // 328
  var refresh = function () {                                                                          // 329
    self._refresh(collection_name, selector);                                                          // 330
  };                                                                                                   // 331
  callback = bindEnvironmentForWrite(writeCallback(write, refresh, callback));                         // 332
                                                                                                       // 333
  try {                                                                                                // 334
    var collection = self._getCollection(collection_name);                                             // 335
    collection.remove(replaceTypes(selector, replaceMeteorAtomWithMongo),                              // 336
                      {safe: true}, callback);                                                         // 337
  } catch (e) {                                                                                        // 338
    write.committed();                                                                                 // 339
    throw e;                                                                                           // 340
  }                                                                                                    // 341
};                                                                                                     // 342
                                                                                                       // 343
MongoConnection.prototype._dropCollection = function (collectionName, cb) {                            // 344
  var self = this;                                                                                     // 345
                                                                                                       // 346
  var write = self._maybeBeginWrite();                                                                 // 347
  var refresh = function () {                                                                          // 348
    Meteor.refresh({collection: collectionName, id: null,                                              // 349
                    dropCollection: true});                                                            // 350
  };                                                                                                   // 351
  cb = bindEnvironmentForWrite(writeCallback(write, refresh, cb));                                     // 352
                                                                                                       // 353
  try {                                                                                                // 354
    var collection = self._getCollection(collectionName);                                              // 355
    collection.drop(cb);                                                                               // 356
  } catch (e) {                                                                                        // 357
    write.committed();                                                                                 // 358
    throw e;                                                                                           // 359
  }                                                                                                    // 360
};                                                                                                     // 361
                                                                                                       // 362
MongoConnection.prototype._update = function (collection_name, selector, mod,                          // 363
                                              options, callback) {                                     // 364
  var self = this;                                                                                     // 365
                                                                                                       // 366
  if (! callback && options instanceof Function) {                                                     // 367
    callback = options;                                                                                // 368
    options = null;                                                                                    // 369
  }                                                                                                    // 370
                                                                                                       // 371
  if (collection_name === "___meteor_failure_test_collection") {                                       // 372
    var e = new Error("Failure test");                                                                 // 373
    e.expected = true;                                                                                 // 374
    if (callback)                                                                                      // 375
      return callback(e);                                                                              // 376
    else                                                                                               // 377
      throw e;                                                                                         // 378
  }                                                                                                    // 379
                                                                                                       // 380
  // explicit safety check. null and undefined can crash the mongo                                     // 381
  // driver. Although the node driver and minimongo do 'support'                                       // 382
  // non-object modifier in that they don't crash, they are not                                        // 383
  // meaningful operations and do not do anything. Defensively throw an                                // 384
  // error here.                                                                                       // 385
  if (!mod || typeof mod !== 'object')                                                                 // 386
    throw new Error("Invalid modifier. Modifier must be an object.");                                  // 387
                                                                                                       // 388
  if (!options) options = {};                                                                          // 389
                                                                                                       // 390
  var write = self._maybeBeginWrite();                                                                 // 391
  var refresh = function () {                                                                          // 392
    self._refresh(collection_name, selector);                                                          // 393
  };                                                                                                   // 394
  callback = writeCallback(write, refresh, callback);                                                  // 395
  try {                                                                                                // 396
    var collection = self._getCollection(collection_name);                                             // 397
    var mongoOpts = {safe: true};                                                                      // 398
    // explictly enumerate options that minimongo supports                                             // 399
    if (options.upsert) mongoOpts.upsert = true;                                                       // 400
    if (options.multi) mongoOpts.multi = true;                                                         // 401
                                                                                                       // 402
    var mongoSelector = replaceTypes(selector, replaceMeteorAtomWithMongo);                            // 403
    var mongoMod = replaceTypes(mod, replaceMeteorAtomWithMongo);                                      // 404
                                                                                                       // 405
    var isModify = isModificationMod(mongoMod);                                                        // 406
    var knownId = (isModify ? selector._id : mod._id);                                                 // 407
                                                                                                       // 408
    if (options.upsert && (! knownId) && options.insertedId) {                                         // 409
      // XXX In future we could do a real upsert for the mongo id generation                           // 410
      // case, if the the node mongo driver gives us back the id of the upserted                       // 411
      // doc (which our current version does not).                                                     // 412
      simulateUpsertWithInsertedId(                                                                    // 413
        collection, mongoSelector, mongoMod,                                                           // 414
        isModify, options,                                                                             // 415
        // This callback does not need to be bindEnvironment'ed because                                // 416
        // simulateUpsertWithInsertedId() wraps it and then passes it through                          // 417
        // bindEnvironmentForWrite.                                                                    // 418
        function (err, result) {                                                                       // 419
          // If we got here via a upsert() call, then options._returnObject will                       // 420
          // be set and we should return the whole object. Otherwise, we should                        // 421
          // just return the number of affected docs to match the mongo API.                           // 422
          if (result && ! options._returnObject)                                                       // 423
            callback(err, result.numberAffected);                                                      // 424
          else                                                                                         // 425
            callback(err, result);                                                                     // 426
        }                                                                                              // 427
      );                                                                                               // 428
    } else {                                                                                           // 429
      collection.update(                                                                               // 430
        mongoSelector, mongoMod, mongoOpts,                                                            // 431
        bindEnvironmentForWrite(function (err, result, extra) {                                        // 432
          if (! err) {                                                                                 // 433
            if (result && options._returnObject) {                                                     // 434
              result = { numberAffected: result };                                                     // 435
              // If this was an upsert() call, and we ended up                                         // 436
              // inserting a new doc and we know its id, then                                          // 437
              // return that id as well.                                                               // 438
              if (options.upsert && knownId &&                                                         // 439
                  ! extra.updatedExisting)                                                             // 440
                result.insertedId = knownId;                                                           // 441
            }                                                                                          // 442
          }                                                                                            // 443
          callback(err, result);                                                                       // 444
        }));                                                                                           // 445
    }                                                                                                  // 446
  } catch (e) {                                                                                        // 447
    write.committed();                                                                                 // 448
    throw e;                                                                                           // 449
  }                                                                                                    // 450
};                                                                                                     // 451
                                                                                                       // 452
var isModificationMod = function (mod) {                                                               // 453
  for (var k in mod)                                                                                   // 454
    if (k.substr(0, 1) === '$')                                                                        // 455
      return true;                                                                                     // 456
  return false;                                                                                        // 457
};                                                                                                     // 458
                                                                                                       // 459
var NUM_OPTIMISTIC_TRIES = 3;                                                                          // 460
                                                                                                       // 461
// exposed for testing                                                                                 // 462
MongoConnection._isCannotChangeIdError = function (err) {                                              // 463
  // either of these checks should work, but just to be safe...                                        // 464
  return (err.code === 13596 ||                                                                        // 465
          err.err.indexOf("cannot change _id of a document") === 0);                                   // 466
};                                                                                                     // 467
                                                                                                       // 468
var simulateUpsertWithInsertedId = function (collection, selector, mod,                                // 469
                                             isModify, options, callback) {                            // 470
  // STRATEGY:  First try doing a plain update.  If it affected 0 documents,                           // 471
  // then without affecting the database, we know we should probably do an                             // 472
  // insert.  We then do a *conditional* insert that will fail in the case                             // 473
  // of a race condition.  This conditional insert is actually an                                      // 474
  // upsert-replace with an _id, which will never successfully update an                               // 475
  // existing document.  If this upsert fails with an error saying it                                  // 476
  // couldn't change an existing _id, then we know an intervening write has                            // 477
  // caused the query to match something.  We go back to step one and repeat.                          // 478
  // Like all "optimistic write" schemes, we rely on the fact that it's                                // 479
  // unlikely our writes will continue to be interfered with under normal                              // 480
  // circumstances (though sufficiently heavy contention with writers                                  // 481
  // disagreeing on the existence of an object will cause writes to fail                               // 482
  // in theory).                                                                                       // 483
                                                                                                       // 484
  var newDoc;                                                                                          // 485
  // Run this code up front so that it fails fast if someone uses                                      // 486
  // a Mongo update operator we don't support.                                                         // 487
  if (isModify) {                                                                                      // 488
    // We've already run replaceTypes/replaceMeteorAtomWithMongo on                                    // 489
    // selector and mod.  We assume it doesn't matter, as far as                                       // 490
    // the behavior of modifiers is concerned, whether `_modify`                                       // 491
    // is run on EJSON or on mongo-converted EJSON.                                                    // 492
    var selectorDoc = LocalCollection._removeDollarOperators(selector);                                // 493
    LocalCollection._modify(selectorDoc, mod, {isInsert: true});                                       // 494
    newDoc = selectorDoc;                                                                              // 495
  } else {                                                                                             // 496
    newDoc = mod;                                                                                      // 497
  }                                                                                                    // 498
                                                                                                       // 499
  var insertedId = options.insertedId; // must exist                                                   // 500
  var mongoOptsForUpdate = {                                                                           // 501
    safe: true,                                                                                        // 502
    multi: options.multi                                                                               // 503
  };                                                                                                   // 504
  var mongoOptsForInsert = {                                                                           // 505
    safe: true,                                                                                        // 506
    upsert: true                                                                                       // 507
  };                                                                                                   // 508
                                                                                                       // 509
  var tries = NUM_OPTIMISTIC_TRIES;                                                                    // 510
                                                                                                       // 511
  var doUpdate = function () {                                                                         // 512
    tries--;                                                                                           // 513
    if (! tries) {                                                                                     // 514
      callback(new Error("Upsert failed after " + NUM_OPTIMISTIC_TRIES + " tries."));                  // 515
    } else {                                                                                           // 516
      collection.update(selector, mod, mongoOptsForUpdate,                                             // 517
                        bindEnvironmentForWrite(function (err, result) {                               // 518
                          if (err)                                                                     // 519
                            callback(err);                                                             // 520
                          else if (result)                                                             // 521
                            callback(null, {                                                           // 522
                              numberAffected: result                                                   // 523
                            });                                                                        // 524
                          else                                                                         // 525
                            doConditionalInsert();                                                     // 526
                        }));                                                                           // 527
    }                                                                                                  // 528
  };                                                                                                   // 529
                                                                                                       // 530
  var doConditionalInsert = function () {                                                              // 531
    var replacementWithId = _.extend(                                                                  // 532
      replaceTypes({_id: insertedId}, replaceMeteorAtomWithMongo),                                     // 533
      newDoc);                                                                                         // 534
    collection.update(selector, replacementWithId, mongoOptsForInsert,                                 // 535
                      bindEnvironmentForWrite(function (err, result) {                                 // 536
                        if (err) {                                                                     // 537
                          // figure out if this is a                                                   // 538
                          // "cannot change _id of document" error, and                                // 539
                          // if so, try doUpdate() again, up to 3 times.                               // 540
                          if (MongoConnection._isCannotChangeIdError(err)) {                           // 541
                            doUpdate();                                                                // 542
                          } else {                                                                     // 543
                            callback(err);                                                             // 544
                          }                                                                            // 545
                        } else {                                                                       // 546
                          callback(null, {                                                             // 547
                            numberAffected: result,                                                    // 548
                            insertedId: insertedId                                                     // 549
                          });                                                                          // 550
                        }                                                                              // 551
                      }));                                                                             // 552
  };                                                                                                   // 553
                                                                                                       // 554
  doUpdate();                                                                                          // 555
};                                                                                                     // 556
                                                                                                       // 557
_.each(["insert", "update", "remove", "dropCollection"], function (method) {                           // 558
  MongoConnection.prototype[method] = function (/* arguments */) {                                     // 559
    var self = this;                                                                                   // 560
    return Meteor._wrapAsync(self["_" + method]).apply(self, arguments);                               // 561
  };                                                                                                   // 562
});                                                                                                    // 563
                                                                                                       // 564
// XXX MongoConnection.upsert() does not return the id of the inserted document                        // 565
// unless you set it explicitly in the selector or modifier (as a replacement                          // 566
// doc).                                                                                               // 567
MongoConnection.prototype.upsert = function (collectionName, selector, mod,                            // 568
                                             options, callback) {                                      // 569
  var self = this;                                                                                     // 570
  if (typeof options === "function" && ! callback) {                                                   // 571
    callback = options;                                                                                // 572
    options = {};                                                                                      // 573
  }                                                                                                    // 574
                                                                                                       // 575
  return self.update(collectionName, selector, mod,                                                    // 576
                     _.extend({}, options, {                                                           // 577
                       upsert: true,                                                                   // 578
                       _returnObject: true                                                             // 579
                     }), callback);                                                                    // 580
};                                                                                                     // 581
                                                                                                       // 582
MongoConnection.prototype.find = function (collectionName, selector, options) {                        // 583
  var self = this;                                                                                     // 584
                                                                                                       // 585
  if (arguments.length === 1)                                                                          // 586
    selector = {};                                                                                     // 587
                                                                                                       // 588
  return new Cursor(                                                                                   // 589
    self, new CursorDescription(collectionName, selector, options));                                   // 590
};                                                                                                     // 591
                                                                                                       // 592
MongoConnection.prototype.findOne = function (collection_name, selector,                               // 593
                                              options) {                                               // 594
  var self = this;                                                                                     // 595
  if (arguments.length === 1)                                                                          // 596
    selector = {};                                                                                     // 597
                                                                                                       // 598
  options = options || {};                                                                             // 599
  options.limit = 1;                                                                                   // 600
  return self.find(collection_name, selector, options).fetch()[0];                                     // 601
};                                                                                                     // 602
                                                                                                       // 603
// We'll actually design an index API later. For now, we just pass through to                          // 604
// Mongo's, but make it synchronous.                                                                   // 605
MongoConnection.prototype._ensureIndex = function (collectionName, index,                              // 606
                                                   options) {                                          // 607
  var self = this;                                                                                     // 608
  options = _.extend({safe: true}, options);                                                           // 609
                                                                                                       // 610
  // We expect this function to be called at startup, not from within a method,                        // 611
  // so we don't interact with the write fence.                                                        // 612
  var collection = self._getCollection(collectionName);                                                // 613
  var future = new Future;                                                                             // 614
  var indexName = collection.ensureIndex(index, options, future.resolver());                           // 615
  future.wait();                                                                                       // 616
};                                                                                                     // 617
MongoConnection.prototype._dropIndex = function (collectionName, index) {                              // 618
  var self = this;                                                                                     // 619
                                                                                                       // 620
  // This function is only used by test code, not within a method, so we don't                         // 621
  // interact with the write fence.                                                                    // 622
  var collection = self._getCollection(collectionName);                                                // 623
  var future = new Future;                                                                             // 624
  var indexName = collection.dropIndex(index, future.resolver());                                      // 625
  future.wait();                                                                                       // 626
};                                                                                                     // 627
                                                                                                       // 628
// CURSORS                                                                                             // 629
                                                                                                       // 630
// There are several classes which relate to cursors:                                                  // 631
//                                                                                                     // 632
// CursorDescription represents the arguments used to construct a cursor:                              // 633
// collectionName, selector, and (find) options.  Because it is used as a key                          // 634
// for cursor de-dup, everything in it should either be JSON-stringifiable or                          // 635
// not affect observeChanges output (eg, options.transform functions are not                           // 636
// stringifiable but do not affect observeChanges).                                                    // 637
//                                                                                                     // 638
// SynchronousCursor is a wrapper around a MongoDB cursor                                              // 639
// which includes fully-synchronous versions of forEach, etc.                                          // 640
//                                                                                                     // 641
// Cursor is the cursor object returned from find(), which implements the                              // 642
// documented Meteor.Collection cursor API.  It wraps a CursorDescription and a                        // 643
// SynchronousCursor (lazily: it doesn't contact Mongo until you call a method                         // 644
// like fetch or forEach on it).                                                                       // 645
//                                                                                                     // 646
// ObserveHandle is the "observe handle" returned from observeChanges. It has a                        // 647
// reference to an ObserveMultiplexer.                                                                 // 648
//                                                                                                     // 649
// ObserveMultiplexer allows multiple identical ObserveHandles to be driven by a                       // 650
// single observe driver.                                                                              // 651
//                                                                                                     // 652
// There are two "observe drivers" which drive ObserveMultiplexers:                                    // 653
//   - PollingObserveDriver caches the results of a query and reruns it when                           // 654
//     necessary.                                                                                      // 655
//   - OplogObserveDriver follows the Mongo operation log to directly observe                          // 656
//     database changes.                                                                               // 657
// Both implementations follow the same simple interface: when you create them,                        // 658
// they start sending observeChanges callbacks (and a ready() invocation) to                           // 659
// their ObserveMultiplexer, and you stop them by calling their stop() method.                         // 660
                                                                                                       // 661
CursorDescription = function (collectionName, selector, options) {                                     // 662
  var self = this;                                                                                     // 663
  self.collectionName = collectionName;                                                                // 664
  self.selector = Meteor.Collection._rewriteSelector(selector);                                        // 665
  self.options = options || {};                                                                        // 666
};                                                                                                     // 667
                                                                                                       // 668
Cursor = function (mongo, cursorDescription) {                                                         // 669
  var self = this;                                                                                     // 670
                                                                                                       // 671
  self._mongo = mongo;                                                                                 // 672
  self._cursorDescription = cursorDescription;                                                         // 673
  self._synchronousCursor = null;                                                                      // 674
};                                                                                                     // 675
                                                                                                       // 676
_.each(['forEach', 'map', 'rewind', 'fetch', 'count'], function (method) {                             // 677
  Cursor.prototype[method] = function () {                                                             // 678
    var self = this;                                                                                   // 679
                                                                                                       // 680
    // You can only observe a tailable cursor.                                                         // 681
    if (self._cursorDescription.options.tailable)                                                      // 682
      throw new Error("Cannot call " + method + " on a tailable cursor");                              // 683
                                                                                                       // 684
    if (!self._synchronousCursor) {                                                                    // 685
      self._synchronousCursor = self._mongo._createSynchronousCursor(                                  // 686
        self._cursorDescription, {                                                                     // 687
          // Make sure that the "self" argument to forEach/map callbacks is the                        // 688
          // Cursor, not the SynchronousCursor.                                                        // 689
          selfForIteration: self,                                                                      // 690
          useTransform: true                                                                           // 691
        });                                                                                            // 692
    }                                                                                                  // 693
                                                                                                       // 694
    return self._synchronousCursor[method].apply(                                                      // 695
      self._synchronousCursor, arguments);                                                             // 696
  };                                                                                                   // 697
});                                                                                                    // 698
                                                                                                       // 699
Cursor.prototype.getTransform = function () {                                                          // 700
  return this._cursorDescription.options.transform;                                                    // 701
};                                                                                                     // 702
                                                                                                       // 703
// When you call Meteor.publish() with a function that returns a Cursor, we need                       // 704
// to transmute it into the equivalent subscription.  This is the function that                        // 705
// does that.                                                                                          // 706
                                                                                                       // 707
Cursor.prototype._publishCursor = function (sub) {                                                     // 708
  var self = this;                                                                                     // 709
  var collection = self._cursorDescription.collectionName;                                             // 710
  return Meteor.Collection._publishCursor(self, sub, collection);                                      // 711
};                                                                                                     // 712
                                                                                                       // 713
// Used to guarantee that publish functions return at most one cursor per                              // 714
// collection. Private, because we might later have cursors that include                               // 715
// documents from multiple collections somehow.                                                        // 716
Cursor.prototype._getCollectionName = function () {                                                    // 717
  var self = this;                                                                                     // 718
  return self._cursorDescription.collectionName;                                                       // 719
}                                                                                                      // 720
                                                                                                       // 721
Cursor.prototype.observe = function (callbacks) {                                                      // 722
  var self = this;                                                                                     // 723
  return LocalCollection._observeFromObserveChanges(self, callbacks);                                  // 724
};                                                                                                     // 725
                                                                                                       // 726
Cursor.prototype.observeChanges = function (callbacks) {                                               // 727
  var self = this;                                                                                     // 728
  var ordered = LocalCollection._observeChangesCallbacksAreOrdered(callbacks);                         // 729
  return self._mongo._observeChanges(                                                                  // 730
    self._cursorDescription, ordered, callbacks);                                                      // 731
};                                                                                                     // 732
                                                                                                       // 733
MongoConnection.prototype._createSynchronousCursor = function(                                         // 734
    cursorDescription, options) {                                                                      // 735
  var self = this;                                                                                     // 736
  options = _.pick(options || {}, 'selfForIteration', 'useTransform');                                 // 737
                                                                                                       // 738
  var collection = self._getCollection(cursorDescription.collectionName);                              // 739
  var cursorOptions = cursorDescription.options;                                                       // 740
  var mongoOptions = {                                                                                 // 741
    sort: cursorOptions.sort,                                                                          // 742
    limit: cursorOptions.limit,                                                                        // 743
    skip: cursorOptions.skip                                                                           // 744
  };                                                                                                   // 745
                                                                                                       // 746
  // Do we want a tailable cursor (which only works on capped collections)?                            // 747
  if (cursorOptions.tailable) {                                                                        // 748
    // We want a tailable cursor...                                                                    // 749
    mongoOptions.tailable = true;                                                                      // 750
    // ... and for the server to wait a bit if any getMore has no data (rather                         // 751
    // than making us put the relevant sleeps in the client)...                                        // 752
    mongoOptions.awaitdata = true;                                                                     // 753
    // ... and to keep querying the server indefinitely rather than just 5 times                       // 754
    // if there's no more data.                                                                        // 755
    mongoOptions.numberOfRetries = -1;                                                                 // 756
    // And if this is on the oplog collection and the cursor specifies a 'ts',                         // 757
    // then set the undocumented oplog replay flag, which does a special scan to                       // 758
    // find the first document (instead of creating an index on ts). This is a                         // 759
    // very hard-coded Mongo flag which only works on the oplog collection and                         // 760
    // only works with the ts field.                                                                   // 761
    if (cursorDescription.collectionName === OPLOG_COLLECTION &&                                       // 762
        cursorDescription.selector.ts) {                                                               // 763
      mongoOptions.oplogReplay = true;                                                                 // 764
    }                                                                                                  // 765
  }                                                                                                    // 766
                                                                                                       // 767
  var dbCursor = collection.find(                                                                      // 768
    replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo),                              // 769
    cursorOptions.fields, mongoOptions);                                                               // 770
                                                                                                       // 771
  return new SynchronousCursor(dbCursor, cursorDescription, options);                                  // 772
};                                                                                                     // 773
                                                                                                       // 774
var SynchronousCursor = function (dbCursor, cursorDescription, options) {                              // 775
  var self = this;                                                                                     // 776
  options = _.pick(options || {}, 'selfForIteration', 'useTransform');                                 // 777
                                                                                                       // 778
  self._dbCursor = dbCursor;                                                                           // 779
  self._cursorDescription = cursorDescription;                                                         // 780
  // The "self" argument passed to forEach/map callbacks. If we're wrapped                             // 781
  // inside a user-visible Cursor, we want to provide the outer cursor!                                // 782
  self._selfForIteration = options.selfForIteration || self;                                           // 783
  if (options.useTransform && cursorDescription.options.transform) {                                   // 784
    self._transform = LocalCollection.wrapTransform(                                                   // 785
      cursorDescription.options.transform);                                                            // 786
  } else {                                                                                             // 787
    self._transform = null;                                                                            // 788
  }                                                                                                    // 789
                                                                                                       // 790
  // Need to specify that the callback is the first argument to nextObject,                            // 791
  // since otherwise when we try to call it with no args the driver will                               // 792
  // interpret "undefined" first arg as an options hash and crash.                                     // 793
  self._synchronousNextObject = Future.wrap(                                                           // 794
    dbCursor.nextObject.bind(dbCursor), 0);                                                            // 795
  self._synchronousCount = Future.wrap(dbCursor.count.bind(dbCursor));                                 // 796
  self._visitedIds = new LocalCollection._IdMap;                                                       // 797
};                                                                                                     // 798
                                                                                                       // 799
_.extend(SynchronousCursor.prototype, {                                                                // 800
  _nextObject: function () {                                                                           // 801
    var self = this;                                                                                   // 802
                                                                                                       // 803
    while (true) {                                                                                     // 804
      var doc = self._synchronousNextObject().wait();                                                  // 805
                                                                                                       // 806
      if (!doc) return null;                                                                           // 807
      doc = replaceTypes(doc, replaceMongoAtomWithMeteor);                                             // 808
                                                                                                       // 809
      if (!self._cursorDescription.options.tailable && _.has(doc, '_id')) {                            // 810
        // Did Mongo give us duplicate documents in the same cursor? If so,                            // 811
        // ignore this one. (Do this before the transform, since transform might                       // 812
        // return some unrelated value.) We don't do this for tailable cursors,                        // 813
        // because we want to maintain O(1) memory usage. And if there isn't _id                       // 814
        // for some reason (maybe it's the oplog), then we don't do this either.                       // 815
        // (Be careful to do this for falsey but existing _id, though.)                                // 816
        if (self._visitedIds.has(doc._id)) continue;                                                   // 817
        self._visitedIds.set(doc._id, true);                                                           // 818
      }                                                                                                // 819
                                                                                                       // 820
      if (self._transform)                                                                             // 821
        doc = self._transform(doc);                                                                    // 822
                                                                                                       // 823
      return doc;                                                                                      // 824
    }                                                                                                  // 825
  },                                                                                                   // 826
                                                                                                       // 827
  forEach: function (callback, thisArg) {                                                              // 828
    var self = this;                                                                                   // 829
                                                                                                       // 830
    // We implement the loop ourself instead of using self._dbCursor.each,                             // 831
    // because "each" will call its callback outside of a fiber which makes it                         // 832
    // much more complex to make this function synchronous.                                            // 833
    var index = 0;                                                                                     // 834
    while (true) {                                                                                     // 835
      var doc = self._nextObject();                                                                    // 836
      if (!doc) return;                                                                                // 837
      callback.call(thisArg, doc, index++, self._selfForIteration);                                    // 838
    }                                                                                                  // 839
  },                                                                                                   // 840
                                                                                                       // 841
  // XXX Allow overlapping callback executions if callback yields.                                     // 842
  map: function (callback, thisArg) {                                                                  // 843
    var self = this;                                                                                   // 844
    var res = [];                                                                                      // 845
    self.forEach(function (doc, index) {                                                               // 846
      res.push(callback.call(thisArg, doc, index, self._selfForIteration));                            // 847
    });                                                                                                // 848
    return res;                                                                                        // 849
  },                                                                                                   // 850
                                                                                                       // 851
  rewind: function () {                                                                                // 852
    var self = this;                                                                                   // 853
                                                                                                       // 854
    // known to be synchronous                                                                         // 855
    self._dbCursor.rewind();                                                                           // 856
                                                                                                       // 857
    self._visitedIds = new LocalCollection._IdMap;                                                     // 858
  },                                                                                                   // 859
                                                                                                       // 860
  // Mostly usable for tailable cursors.                                                               // 861
  close: function () {                                                                                 // 862
    var self = this;                                                                                   // 863
                                                                                                       // 864
    self._dbCursor.close();                                                                            // 865
  },                                                                                                   // 866
                                                                                                       // 867
  fetch: function () {                                                                                 // 868
    var self = this;                                                                                   // 869
    return self.map(_.identity);                                                                       // 870
  },                                                                                                   // 871
                                                                                                       // 872
  count: function () {                                                                                 // 873
    var self = this;                                                                                   // 874
    return self._synchronousCount().wait();                                                            // 875
  },                                                                                                   // 876
                                                                                                       // 877
  // This method is NOT wrapped in Cursor.                                                             // 878
  getRawObjects: function (ordered) {                                                                  // 879
    var self = this;                                                                                   // 880
    if (ordered) {                                                                                     // 881
      return self.fetch();                                                                             // 882
    } else {                                                                                           // 883
      var results = new LocalCollection._IdMap;                                                        // 884
      self.forEach(function (doc) {                                                                    // 885
        results.set(doc._id, doc);                                                                     // 886
      });                                                                                              // 887
      return results;                                                                                  // 888
    }                                                                                                  // 889
  }                                                                                                    // 890
});                                                                                                    // 891
                                                                                                       // 892
MongoConnection.prototype.tail = function (cursorDescription, docCallback) {                           // 893
  var self = this;                                                                                     // 894
  if (!cursorDescription.options.tailable)                                                             // 895
    throw new Error("Can only tail a tailable cursor");                                                // 896
                                                                                                       // 897
  var cursor = self._createSynchronousCursor(cursorDescription);                                       // 898
                                                                                                       // 899
  var stopped = false;                                                                                 // 900
  var lastTS = undefined;                                                                              // 901
  var loop = function () {                                                                             // 902
    while (true) {                                                                                     // 903
      if (stopped)                                                                                     // 904
        return;                                                                                        // 905
      try {                                                                                            // 906
        var doc = cursor._nextObject();                                                                // 907
      } catch (err) {                                                                                  // 908
        // There's no good way to figure out if this was actually an error                             // 909
        // from Mongo. Ah well. But either way, we need to retry the cursor                            // 910
        // (unless the failure was because the observe got stopped).                                   // 911
        doc = null;                                                                                    // 912
      }                                                                                                // 913
      // Since cursor._nextObject can yield, we need to check again to see if                          // 914
      // we've been stopped before calling the callback.                                               // 915
      if (stopped)                                                                                     // 916
        return;                                                                                        // 917
      if (doc) {                                                                                       // 918
        // If a tailable cursor contains a "ts" field, use it to recreate the                          // 919
        // cursor on error. ("ts" is a standard that Mongo uses internally for                         // 920
        // the oplog, and there's a special flag that lets you do binary search                        // 921
        // on it instead of needing to use an index.)                                                  // 922
        lastTS = doc.ts;                                                                               // 923
        docCallback(doc);                                                                              // 924
      } else {                                                                                         // 925
        var newSelector = _.clone(cursorDescription.selector);                                         // 926
        if (lastTS) {                                                                                  // 927
          newSelector.ts = {$gt: lastTS};                                                              // 928
        }                                                                                              // 929
        cursor = self._createSynchronousCursor(new CursorDescription(                                  // 930
          cursorDescription.collectionName,                                                            // 931
          newSelector,                                                                                 // 932
          cursorDescription.options));                                                                 // 933
        // Mongo failover takes many seconds.  Retry in a bit.  (Without this                          // 934
        // setTimeout, we peg the CPU at 100% and never notice the actual                              // 935
        // failover.                                                                                   // 936
        Meteor.setTimeout(loop, 100);                                                                  // 937
        break;                                                                                         // 938
      }                                                                                                // 939
    }                                                                                                  // 940
  };                                                                                                   // 941
                                                                                                       // 942
  Meteor.defer(loop);                                                                                  // 943
                                                                                                       // 944
  return {                                                                                             // 945
    stop: function () {                                                                                // 946
      stopped = true;                                                                                  // 947
      cursor.close();                                                                                  // 948
    }                                                                                                  // 949
  };                                                                                                   // 950
};                                                                                                     // 951
                                                                                                       // 952
MongoConnection.prototype._observeChanges = function (                                                 // 953
    cursorDescription, ordered, callbacks) {                                                           // 954
  var self = this;                                                                                     // 955
                                                                                                       // 956
  if (cursorDescription.options.tailable) {                                                            // 957
    return self._observeChangesTailable(cursorDescription, ordered, callbacks);                        // 958
  }                                                                                                    // 959
                                                                                                       // 960
  // You may not filter out _id when observing changes, because the id is a core                       // 961
  // part of the observeChanges API.                                                                   // 962
  if (cursorDescription.options.fields &&                                                              // 963
      (cursorDescription.options.fields._id === 0 ||                                                   // 964
       cursorDescription.options.fields._id === false)) {                                              // 965
    throw Error("You may not observe a cursor with {fields: {_id: 0}}");                               // 966
  }                                                                                                    // 967
                                                                                                       // 968
  var observeKey = JSON.stringify(                                                                     // 969
    _.extend({ordered: ordered}, cursorDescription));                                                  // 970
                                                                                                       // 971
  var multiplexer, observeDriver;                                                                      // 972
  var firstHandle = false;                                                                             // 973
                                                                                                       // 974
  // Find a matching ObserveMultiplexer, or create a new one. This next block is                       // 975
  // guaranteed to not yield (and it doesn't call anything that can observe a                          // 976
  // new query), so no other calls to this function can interleave with it.                            // 977
  Meteor._noYieldsAllowed(function () {                                                                // 978
    if (_.has(self._observeMultiplexers, observeKey)) {                                                // 979
      multiplexer = self._observeMultiplexers[observeKey];                                             // 980
    } else {                                                                                           // 981
      firstHandle = true;                                                                              // 982
      // Create a new ObserveMultiplexer.                                                              // 983
      multiplexer = new ObserveMultiplexer({                                                           // 984
        ordered: ordered,                                                                              // 985
        onStop: function () {                                                                          // 986
          observeDriver.stop();                                                                        // 987
          delete self._observeMultiplexers[observeKey];                                                // 988
        }                                                                                              // 989
      });                                                                                              // 990
      self._observeMultiplexers[observeKey] = multiplexer;                                             // 991
    }                                                                                                  // 992
  });                                                                                                  // 993
                                                                                                       // 994
  var observeHandle = new ObserveHandle(multiplexer, callbacks);                                       // 995
                                                                                                       // 996
  if (firstHandle) {                                                                                   // 997
    var matcher, sorter;                                                                               // 998
    var canUseOplog = _.all([                                                                          // 999
      function () {                                                                                    // 1000
        // At a bare minimum, using the oplog requires us to have an oplog, to                         // 1001
        // want unordered callbacks, and to not want a callback on the polls                           // 1002
        // that won't happen.                                                                          // 1003
        return self._oplogHandle && !ordered &&                                                        // 1004
          !callbacks._testOnlyPollCallback;                                                            // 1005
      }, function () {                                                                                 // 1006
        // We need to be able to compile the selector. Fall back to polling for                        // 1007
        // some newfangled $selector that minimongo doesn't support yet.                               // 1008
        try {                                                                                          // 1009
          matcher = new Minimongo.Matcher(cursorDescription.selector);                                 // 1010
          return true;                                                                                 // 1011
        } catch (e) {                                                                                  // 1012
          // XXX make all compilation errors MinimongoError or something                               // 1013
          //     so that this doesn't ignore unrelated exceptions                                      // 1014
          return false;                                                                                // 1015
        }                                                                                              // 1016
      }, function () {                                                                                 // 1017
        // ... and the selector itself needs to support oplog.                                         // 1018
        return OplogObserveDriver.cursorSupported(cursorDescription, matcher);                         // 1019
      }, function () {                                                                                 // 1020
        // And we need to be able to compile the sort, if any.  eg, can't be                           // 1021
        // {$natural: 1}.                                                                              // 1022
        if (!cursorDescription.options.sort)                                                           // 1023
          return true;                                                                                 // 1024
        try {                                                                                          // 1025
          sorter = new Minimongo.Sorter(cursorDescription.options.sort,                                // 1026
                                        { matcher: matcher });                                         // 1027
          return true;                                                                                 // 1028
        } catch (e) {                                                                                  // 1029
          // XXX make all compilation errors MinimongoError or something                               // 1030
          //     so that this doesn't ignore unrelated exceptions                                      // 1031
          return false;                                                                                // 1032
        }                                                                                              // 1033
      }], function (f) { return f(); });  // invoke each function                                      // 1034
                                                                                                       // 1035
    var driverClass = canUseOplog ? OplogObserveDriver : PollingObserveDriver;                         // 1036
    observeDriver = new driverClass({                                                                  // 1037
      cursorDescription: cursorDescription,                                                            // 1038
      mongoHandle: self,                                                                               // 1039
      multiplexer: multiplexer,                                                                        // 1040
      ordered: ordered,                                                                                // 1041
      matcher: matcher,  // ignored by polling                                                         // 1042
      sorter: sorter,  // ignored by polling                                                           // 1043
      _testOnlyPollCallback: callbacks._testOnlyPollCallback                                           // 1044
    });                                                                                                // 1045
                                                                                                       // 1046
    // This field is only set for use in tests.                                                        // 1047
    multiplexer._observeDriver = observeDriver;                                                        // 1048
  }                                                                                                    // 1049
                                                                                                       // 1050
  // Blocks until the initial adds have been sent.                                                     // 1051
  multiplexer.addHandleAndSendInitialAdds(observeHandle);                                              // 1052
                                                                                                       // 1053
  return observeHandle;                                                                                // 1054
};                                                                                                     // 1055
                                                                                                       // 1056
// Listen for the invalidation messages that will trigger us to poll the                               // 1057
// database for changes. If this selector specifies specific IDs, specify them                         // 1058
// here, so that updates to different specific IDs don't cause us to poll.                             // 1059
// listenCallback is the same kind of (notification, complete) callback passed                         // 1060
// to InvalidationCrossbar.listen.                                                                     // 1061
                                                                                                       // 1062
listenAll = function (cursorDescription, listenCallback) {                                             // 1063
  var listeners = [];                                                                                  // 1064
  forEachTrigger(cursorDescription, function (trigger) {                                               // 1065
    listeners.push(DDPServer._InvalidationCrossbar.listen(                                             // 1066
      trigger, listenCallback));                                                                       // 1067
  });                                                                                                  // 1068
                                                                                                       // 1069
  return {                                                                                             // 1070
    stop: function () {                                                                                // 1071
      _.each(listeners, function (listener) {                                                          // 1072
        listener.stop();                                                                               // 1073
      });                                                                                              // 1074
    }                                                                                                  // 1075
  };                                                                                                   // 1076
};                                                                                                     // 1077
                                                                                                       // 1078
forEachTrigger = function (cursorDescription, triggerCallback) {                                       // 1079
  var key = {collection: cursorDescription.collectionName};                                            // 1080
  var specificIds = LocalCollection._idsMatchedBySelector(                                             // 1081
    cursorDescription.selector);                                                                       // 1082
  if (specificIds) {                                                                                   // 1083
    _.each(specificIds, function (id) {                                                                // 1084
      triggerCallback(_.extend({id: id}, key));                                                        // 1085
    });                                                                                                // 1086
    triggerCallback(_.extend({dropCollection: true, id: null}, key));                                  // 1087
  } else {                                                                                             // 1088
    triggerCallback(key);                                                                              // 1089
  }                                                                                                    // 1090
};                                                                                                     // 1091
                                                                                                       // 1092
// observeChanges for tailable cursors on capped collections.                                          // 1093
//                                                                                                     // 1094
// Some differences from normal cursors:                                                               // 1095
//   - Will never produce anything other than 'added' or 'addedBefore'. If you                         // 1096
//     do update a document that has already been produced, this will not notice                       // 1097
//     it.                                                                                             // 1098
//   - If you disconnect and reconnect from Mongo, it will essentially restart                         // 1099
//     the query, which will lead to duplicate results. This is pretty bad,                            // 1100
//     but if you include a field called 'ts' which is inserted as                                     // 1101
//     new MongoInternals.MongoTimestamp(0, 0) (which is initialized to the                            // 1102
//     current Mongo-style timestamp), we'll be able to find the place to                              // 1103
//     restart properly. (This field is specifically understood by Mongo with an                       // 1104
//     optimization which allows it to find the right place to start without                           // 1105
//     an index on ts. It's how the oplog works.)                                                      // 1106
//   - No callbacks are triggered synchronously with the call (there's no                              // 1107
//     differentiation between "initial data" and "later changes"; everything                          // 1108
//     that matches the query gets sent asynchronously).                                               // 1109
//   - De-duplication is not implemented.                                                              // 1110
//   - Does not yet interact with the write fence. Probably, this should work by                       // 1111
//     ignoring removes (which don't work on capped collections) and updates                           // 1112
//     (which don't affect tailable cursors), and just keeping track of the ID                         // 1113
//     of the inserted object, and closing the write fence once you get to that                        // 1114
//     ID (or timestamp?).  This doesn't work well if the document doesn't match                       // 1115
//     the query, though.  On the other hand, the write fence can close                                // 1116
//     immediately if it does not match the query. So if we trust minimongo                            // 1117
//     enough to accurately evaluate the query against the write fence, we                             // 1118
//     should be able to do this...  Of course, minimongo doesn't even support                         // 1119
//     Mongo Timestamps yet.                                                                           // 1120
MongoConnection.prototype._observeChangesTailable = function (                                         // 1121
    cursorDescription, ordered, callbacks) {                                                           // 1122
  var self = this;                                                                                     // 1123
                                                                                                       // 1124
  // Tailable cursors only ever call added/addedBefore callbacks, so it's an                           // 1125
  // error if you didn't provide them.                                                                 // 1126
  if ((ordered && !callbacks.addedBefore) ||                                                           // 1127
      (!ordered && !callbacks.added)) {                                                                // 1128
    throw new Error("Can't observe an " + (ordered ? "ordered" : "unordered")                          // 1129
                    + " tailable cursor without a "                                                    // 1130
                    + (ordered ? "addedBefore" : "added") + " callback");                              // 1131
  }                                                                                                    // 1132
                                                                                                       // 1133
  return self.tail(cursorDescription, function (doc) {                                                 // 1134
    var id = doc._id;                                                                                  // 1135
    delete doc._id;                                                                                    // 1136
    // The ts is an implementation detail. Hide it.                                                    // 1137
    delete doc.ts;                                                                                     // 1138
    if (ordered) {                                                                                     // 1139
      callbacks.addedBefore(id, doc, null);                                                            // 1140
    } else {                                                                                           // 1141
      callbacks.added(id, doc);                                                                        // 1142
    }                                                                                                  // 1143
  });                                                                                                  // 1144
};                                                                                                     // 1145
                                                                                                       // 1146
// XXX We probably need to find a better way to expose this. Right now                                 // 1147
// it's only used by tests, but in fact you need it in normal                                          // 1148
// operation to interact with capped collections (eg, Galaxy uses it).                                 // 1149
MongoInternals.MongoTimestamp = MongoDB.Timestamp;                                                     // 1150
                                                                                                       // 1151
MongoInternals.Connection = MongoConnection;                                                           // 1152
MongoInternals.NpmModule = MongoDB;                                                                    // 1153
                                                                                                       // 1154
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/oplog_tailing.js                                                            //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Future = Npm.require('fibers/future');                                                             // 1
                                                                                                       // 2
OPLOG_COLLECTION = 'oplog.rs';                                                                         // 3
var REPLSET_COLLECTION = 'system.replset';                                                             // 4
                                                                                                       // 5
// Like Perl's quotemeta: quotes all regexp metacharacters. See                                        // 6
//   https://github.com/substack/quotemeta/blob/master/index.js                                        // 7
// XXX this is duplicated with accounts_server.js                                                      // 8
var quotemeta = function (str) {                                                                       // 9
    return String(str).replace(/(\W)/g, '\\$1');                                                       // 10
};                                                                                                     // 11
                                                                                                       // 12
var showTS = function (ts) {                                                                           // 13
  return "Timestamp(" + ts.getHighBits() + ", " + ts.getLowBits() + ")";                               // 14
};                                                                                                     // 15
                                                                                                       // 16
idForOp = function (op) {                                                                              // 17
  if (op.op === 'd')                                                                                   // 18
    return op.o._id;                                                                                   // 19
  else if (op.op === 'i')                                                                              // 20
    return op.o._id;                                                                                   // 21
  else if (op.op === 'u')                                                                              // 22
    return op.o2._id;                                                                                  // 23
  else if (op.op === 'c')                                                                              // 24
    throw Error("Operator 'c' doesn't supply an object with id: " +                                    // 25
                EJSON.stringify(op));                                                                  // 26
  else                                                                                                 // 27
    throw Error("Unknown op: " + EJSON.stringify(op));                                                 // 28
};                                                                                                     // 29
                                                                                                       // 30
OplogHandle = function (oplogUrl, dbName) {                                                            // 31
  var self = this;                                                                                     // 32
  self._oplogUrl = oplogUrl;                                                                           // 33
  self._dbName = dbName;                                                                               // 34
                                                                                                       // 35
  self._oplogLastEntryConnection = null;                                                               // 36
  self._oplogTailConnection = null;                                                                    // 37
  self._stopped = false;                                                                               // 38
  self._tailHandle = null;                                                                             // 39
  self._readyFuture = new Future();                                                                    // 40
  self._crossbar = new DDPServer._Crossbar({                                                           // 41
    factPackage: "mongo-livedata", factName: "oplog-watchers"                                          // 42
  });                                                                                                  // 43
  self._lastProcessedTS = null;                                                                        // 44
  self._baseOplogSelector = {                                                                          // 45
    ns: new RegExp('^' + quotemeta(self._dbName) + '\\.'),                                             // 46
    $or: [                                                                                             // 47
      { op: {$in: ['i', 'u', 'd']} },                                                                  // 48
      // If it is not db.collection.drop(), ignore it                                                  // 49
      { op: 'c', 'o.drop': { $exists: true } }]                                                        // 50
  };                                                                                                   // 51
  // XXX doc                                                                                           // 52
  self._catchingUpFutures = [];                                                                        // 53
                                                                                                       // 54
  self._startTailing();                                                                                // 55
};                                                                                                     // 56
                                                                                                       // 57
_.extend(OplogHandle.prototype, {                                                                      // 58
  stop: function () {                                                                                  // 59
    var self = this;                                                                                   // 60
    if (self._stopped)                                                                                 // 61
      return;                                                                                          // 62
    self._stopped = true;                                                                              // 63
    if (self._tailHandle)                                                                              // 64
      self._tailHandle.stop();                                                                         // 65
    // XXX should close connections too                                                                // 66
  },                                                                                                   // 67
  onOplogEntry: function (trigger, callback) {                                                         // 68
    var self = this;                                                                                   // 69
    if (self._stopped)                                                                                 // 70
      throw new Error("Called onOplogEntry on stopped handle!");                                       // 71
                                                                                                       // 72
    // Calling onOplogEntry requires us to wait for the tailing to be ready.                           // 73
    self._readyFuture.wait();                                                                          // 74
                                                                                                       // 75
    var originalCallback = callback;                                                                   // 76
    callback = Meteor.bindEnvironment(function (notification) {                                        // 77
      // XXX can we avoid this clone by making oplog.js careful?                                       // 78
      originalCallback(EJSON.clone(notification));                                                     // 79
    }, function (err) {                                                                                // 80
      Meteor._debug("Error in oplog callback", err.stack);                                             // 81
    });                                                                                                // 82
    var listenHandle = self._crossbar.listen(trigger, callback);                                       // 83
    return {                                                                                           // 84
      stop: function () {                                                                              // 85
        listenHandle.stop();                                                                           // 86
      }                                                                                                // 87
    };                                                                                                 // 88
  },                                                                                                   // 89
  // Calls `callback` once the oplog has been processed up to a point that is                          // 90
  // roughly "now": specifically, once we've processed all ops that are                                // 91
  // currently visible.                                                                                // 92
  // XXX become convinced that this is actually safe even if oplogConnection                           // 93
  // is some kind of pool                                                                              // 94
  waitUntilCaughtUp: function () {                                                                     // 95
    var self = this;                                                                                   // 96
    if (self._stopped)                                                                                 // 97
      throw new Error("Called waitUntilCaughtUp on stopped handle!");                                  // 98
                                                                                                       // 99
    // Calling waitUntilCaughtUp requries us to wait for the oplog connection to                       // 100
    // be ready.                                                                                       // 101
    self._readyFuture.wait();                                                                          // 102
                                                                                                       // 103
    // We need to make the selector at least as restrictive as the actual                              // 104
    // tailing selector (ie, we need to specify the DB name) or else we might                          // 105
    // find a TS that won't show up in the actual tail stream.                                         // 106
    var lastEntry = self._oplogLastEntryConnection.findOne(                                            // 107
      OPLOG_COLLECTION, self._baseOplogSelector,                                                       // 108
      {fields: {ts: 1}, sort: {$natural: -1}});                                                        // 109
                                                                                                       // 110
    if (!lastEntry) {                                                                                  // 111
      // Really, nothing in the oplog? Well, we've processed everything.                               // 112
      return;                                                                                          // 113
    }                                                                                                  // 114
                                                                                                       // 115
    var ts = lastEntry.ts;                                                                             // 116
    if (!ts)                                                                                           // 117
      throw Error("oplog entry without ts: " + EJSON.stringify(lastEntry));                            // 118
                                                                                                       // 119
    if (self._lastProcessedTS && ts.lessThanOrEqual(self._lastProcessedTS)) {                          // 120
      // We've already caught up to here.                                                              // 121
      return;                                                                                          // 122
    }                                                                                                  // 123
                                                                                                       // 124
                                                                                                       // 125
    // Insert the future into our list. Almost always, this will be at the end,                        // 126
    // but it's conceivable that if we fail over from one primary to another,                          // 127
    // the oplog entries we see will go backwards.                                                     // 128
    var insertAfter = self._catchingUpFutures.length;                                                  // 129
    while (insertAfter - 1 > 0                                                                         // 130
           && self._catchingUpFutures[insertAfter - 1].ts.greaterThan(ts)) {                           // 131
      insertAfter--;                                                                                   // 132
    }                                                                                                  // 133
    var f = new Future;                                                                                // 134
    self._catchingUpFutures.splice(insertAfter, 0, {ts: ts, future: f});                               // 135
    f.wait();                                                                                          // 136
  },                                                                                                   // 137
  _startTailing: function () {                                                                         // 138
    var self = this;                                                                                   // 139
    // We make two separate connections to Mongo. The Node Mongo driver                                // 140
    // implements a naive round-robin connection pool: each "connection" is a                          // 141
    // pool of several (5 by default) TCP connections, and each request is                             // 142
    // rotated through the pools. Tailable cursor queries block on the server                          // 143
    // until there is some data to return (or until a few seconds have                                 // 144
    // passed). So if the connection pool used for tailing cursors is the same                         // 145
    // pool used for other queries, the other queries will be delayed by seconds                       // 146
    // 1/5 of the time.                                                                                // 147
    //                                                                                                 // 148
    // The tail connection will only ever be running a single tail command, so                         // 149
    // it only needs to make one underlying TCP connection.                                            // 150
    self._oplogTailConnection = new MongoConnection(                                                   // 151
      self._oplogUrl, {poolSize: 1});                                                                  // 152
    // XXX better docs, but: it's to get monotonic results                                             // 153
    // XXX is it safe to say "if there's an in flight query, just use its                              // 154
    //     results"? I don't think so but should consider that                                         // 155
    self._oplogLastEntryConnection = new MongoConnection(                                              // 156
      self._oplogUrl, {poolSize: 1});                                                                  // 157
                                                                                                       // 158
    // First, make sure that there actually is a repl set here. If not, oplog                          // 159
    // tailing won't ever find anything! (Blocks until the connection is ready.)                       // 160
    var replSetInfo = self._oplogLastEntryConnection.findOne(                                          // 161
      REPLSET_COLLECTION, {});                                                                         // 162
    if (!replSetInfo)                                                                                  // 163
      throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " +                         // 164
                  "a Mongo replica set");                                                              // 165
                                                                                                       // 166
    // Find the last oplog entry.                                                                      // 167
    var lastOplogEntry = self._oplogLastEntryConnection.findOne(                                       // 168
      OPLOG_COLLECTION, {}, {sort: {$natural: -1}});                                                   // 169
                                                                                                       // 170
    var oplogSelector = _.clone(self._baseOplogSelector);                                              // 171
    if (lastOplogEntry) {                                                                              // 172
      // Start after the last entry that currently exists.                                             // 173
      oplogSelector.ts = {$gt: lastOplogEntry.ts};                                                     // 174
      // If there are any calls to callWhenProcessedLatest before any other                            // 175
      // oplog entries show up, allow callWhenProcessedLatest to call its                              // 176
      // callback immediately.                                                                         // 177
      self._lastProcessedTS = lastOplogEntry.ts;                                                       // 178
    }                                                                                                  // 179
                                                                                                       // 180
    var cursorDescription = new CursorDescription(                                                     // 181
      OPLOG_COLLECTION, oplogSelector, {tailable: true});                                              // 182
                                                                                                       // 183
    self._tailHandle = self._oplogTailConnection.tail(                                                 // 184
      cursorDescription, function (doc) {                                                              // 185
        if (!(doc.ns && doc.ns.length > self._dbName.length + 1 &&                                     // 186
              doc.ns.substr(0, self._dbName.length + 1) ===                                            // 187
              (self._dbName + '.'))) {                                                                 // 188
          throw new Error("Unexpected ns");                                                            // 189
        }                                                                                              // 190
                                                                                                       // 191
        var trigger = {collection: doc.ns.substr(self._dbName.length + 1),                             // 192
                       dropCollection: false,                                                          // 193
                       op: doc};                                                                       // 194
                                                                                                       // 195
        // Is it a special command and the collection name is hidden somewhere                         // 196
        // in operator?                                                                                // 197
        if (trigger.collection === "$cmd") {                                                           // 198
          trigger.collection = doc.o.drop;                                                             // 199
          trigger.dropCollection = true;                                                               // 200
          trigger.id = null;                                                                           // 201
        } else {                                                                                       // 202
          // All other ops have an id.                                                                 // 203
          trigger.id = idForOp(doc);                                                                   // 204
        }                                                                                              // 205
                                                                                                       // 206
        self._crossbar.fire(trigger);                                                                  // 207
                                                                                                       // 208
        // Now that we've processed this operation, process pending sequencers.                        // 209
        if (!doc.ts)                                                                                   // 210
          throw Error("oplog entry without ts: " + EJSON.stringify(doc));                              // 211
        self._lastProcessedTS = doc.ts;                                                                // 212
        while (!_.isEmpty(self._catchingUpFutures)                                                     // 213
               && self._catchingUpFutures[0].ts.lessThanOrEqual(                                       // 214
                 self._lastProcessedTS)) {                                                             // 215
          var sequencer = self._catchingUpFutures.shift();                                             // 216
          sequencer.future.return();                                                                   // 217
        }                                                                                              // 218
      });                                                                                              // 219
    self._readyFuture.return();                                                                        // 220
  }                                                                                                    // 221
});                                                                                                    // 222
                                                                                                       // 223
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/observe_multiplex.js                                                        //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Future = Npm.require('fibers/future');                                                             // 1
                                                                                                       // 2
ObserveMultiplexer = function (options) {                                                              // 3
  var self = this;                                                                                     // 4
                                                                                                       // 5
  if (!options || !_.has(options, 'ordered'))                                                          // 6
    throw Error("must specified ordered");                                                             // 7
                                                                                                       // 8
  Package.facts && Package.facts.Facts.incrementServerFact(                                            // 9
    "mongo-livedata", "observe-multiplexers", 1);                                                      // 10
                                                                                                       // 11
  self._ordered = options.ordered;                                                                     // 12
  self._onStop = options.onStop || function () {};                                                     // 13
  self._queue = new Meteor._SynchronousQueue();                                                        // 14
  self._handles = {};                                                                                  // 15
  self._readyFuture = new Future;                                                                      // 16
  self._cache = new LocalCollection._CachingChangeObserver({                                           // 17
    ordered: options.ordered});                                                                        // 18
  // Number of addHandleAndSendInitialAdds tasks scheduled but not yet                                 // 19
  // running. removeHandle uses this to know if it's time to call the onStop                           // 20
  // callback.                                                                                         // 21
  self._addHandleTasksScheduledButNotPerformed = 0;                                                    // 22
                                                                                                       // 23
  _.each(self.callbackNames(), function (callbackName) {                                               // 24
    self[callbackName] = function (/* ... */) {                                                        // 25
      self._applyCallback(callbackName, _.toArray(arguments));                                         // 26
    };                                                                                                 // 27
  });                                                                                                  // 28
};                                                                                                     // 29
                                                                                                       // 30
_.extend(ObserveMultiplexer.prototype, {                                                               // 31
  addHandleAndSendInitialAdds: function (handle) {                                                     // 32
    var self = this;                                                                                   // 33
                                                                                                       // 34
    // Check this before calling runTask (even though runTask does the same                            // 35
    // check) so that we don't leak an ObserveMultiplexer on error by                                  // 36
    // incrementing _addHandleTasksScheduledButNotPerformed and never                                  // 37
    // decrementing it.                                                                                // 38
    if (!self._queue.safeToRunTask())                                                                  // 39
      throw new Error(                                                                                 // 40
        "Can't call observeChanges from an observe callback on the same query");                       // 41
    ++self._addHandleTasksScheduledButNotPerformed;                                                    // 42
                                                                                                       // 43
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 44
      "mongo-livedata", "observe-handles", 1);                                                         // 45
                                                                                                       // 46
    self._queue.runTask(function () {                                                                  // 47
      self._handles[handle._id] = handle;                                                              // 48
      // Send out whatever adds we have so far (whether or not we the                                  // 49
      // multiplexer is ready).                                                                        // 50
      self._sendAdds(handle);                                                                          // 51
      --self._addHandleTasksScheduledButNotPerformed;                                                  // 52
    });                                                                                                // 53
    // *outside* the task, since otherwise we'd deadlock                                               // 54
    self._readyFuture.wait();                                                                          // 55
  },                                                                                                   // 56
                                                                                                       // 57
  // Remove an observe handle. If it was the last observe handle, call the                             // 58
  // onStop callback; you cannot add any more observe handles after this.                              // 59
  //                                                                                                   // 60
  // This is not synchronized with polls and handle additions: this means that                         // 61
  // you can safely call it from within an observe callback, but it also means                         // 62
  // that we have to be careful when we iterate over _handles.                                         // 63
  removeHandle: function (id) {                                                                        // 64
    var self = this;                                                                                   // 65
                                                                                                       // 66
    // This should not be possible: you can only call removeHandle by having                           // 67
    // access to the ObserveHandle, which isn't returned to user code until the                        // 68
    // multiplex is ready.                                                                             // 69
    if (!self._ready())                                                                                // 70
      throw new Error("Can't remove handles until the multiplex is ready");                            // 71
                                                                                                       // 72
    delete self._handles[id];                                                                          // 73
                                                                                                       // 74
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 75
      "mongo-livedata", "observe-handles", -1);                                                        // 76
                                                                                                       // 77
    if (_.isEmpty(self._handles) &&                                                                    // 78
        self._addHandleTasksScheduledButNotPerformed === 0) {                                          // 79
      self._stop();                                                                                    // 80
    }                                                                                                  // 81
  },                                                                                                   // 82
  _stop: function () {                                                                                 // 83
    var self = this;                                                                                   // 84
    // It shouldn't be possible for us to stop when all our handles still                              // 85
    // haven't been returned from observeChanges!                                                      // 86
    if (!self._ready())                                                                                // 87
      throw Error("surprising _stop: not ready");                                                      // 88
                                                                                                       // 89
    // Call stop callback (which kills the underlying process which sends us                           // 90
    // callbacks and removes us from the connection's dictionary).                                     // 91
    self._onStop();                                                                                    // 92
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 93
      "mongo-livedata", "observe-multiplexers", -1);                                                   // 94
                                                                                                       // 95
    // Cause future addHandleAndSendInitialAdds calls to throw (but the onStop                         // 96
    // callback should make our connection forget about us).                                           // 97
    self._handles = null;                                                                              // 98
  },                                                                                                   // 99
  // Allows all addHandleAndSendInitialAdds calls to return, once all preceding                        // 100
  // adds have been processed. Does not block.                                                         // 101
  ready: function () {                                                                                 // 102
    var self = this;                                                                                   // 103
    self._queue.queueTask(function () {                                                                // 104
      if (self._ready())                                                                               // 105
        throw Error("can't make ObserveMultiplex ready twice!");                                       // 106
      self._readyFuture.return();                                                                      // 107
    });                                                                                                // 108
  },                                                                                                   // 109
  // Calls "cb" once the effects of all "ready", "addHandleAndSendInitialAdds"                         // 110
  // and observe callbacks which came before this call have been propagated to                         // 111
  // all handles. "ready" must have already been called on this multiplexer.                           // 112
  onFlush: function (cb) {                                                                             // 113
    var self = this;                                                                                   // 114
    self._queue.queueTask(function () {                                                                // 115
      if (!self._ready())                                                                              // 116
        throw Error("only call onFlush on a multiplexer that will be ready");                          // 117
      cb();                                                                                            // 118
    });                                                                                                // 119
  },                                                                                                   // 120
  callbackNames: function () {                                                                         // 121
    var self = this;                                                                                   // 122
    if (self._ordered)                                                                                 // 123
      return ["addedBefore", "changed", "movedBefore", "removed"];                                     // 124
    else                                                                                               // 125
      return ["added", "changed", "removed"];                                                          // 126
  },                                                                                                   // 127
  _ready: function () {                                                                                // 128
    return this._readyFuture.isResolved();                                                             // 129
  },                                                                                                   // 130
  _applyCallback: function (callbackName, args) {                                                      // 131
    var self = this;                                                                                   // 132
    self._queue.queueTask(function () {                                                                // 133
      // First, apply the change to the cache.                                                         // 134
      // XXX We could make applyChange callbacks promise not to hang on to any                         // 135
      // state from their arguments (assuming that their supplied callbacks                            // 136
      // don't) and skip this clone. Currently 'changed' hangs on to state                             // 137
      // though.                                                                                       // 138
      self._cache.applyChange[callbackName].apply(null, EJSON.clone(args));                            // 139
                                                                                                       // 140
      // If we haven't finished the initial adds, then we should only be getting                       // 141
      // adds.                                                                                         // 142
      if (!self._ready() &&                                                                            // 143
          (callbackName !== 'added' && callbackName !== 'addedBefore')) {                              // 144
        throw new Error("Got " + callbackName + " during initial adds");                               // 145
      }                                                                                                // 146
                                                                                                       // 147
      // Now multiplex the callbacks out to all observe handles. It's OK if                            // 148
      // these calls yield; since we're inside a task, no other use of our queue                       // 149
      // can continue until these are done. (But we do have to be careful to not                       // 150
      // use a handle that got removed, because removeHandle does not use the                          // 151
      // queue; thus, we iterate over an array of keys that we control.)                               // 152
      _.each(_.keys(self._handles), function (handleId) {                                              // 153
        var handle = self._handles[handleId];                                                          // 154
        if (!handle)                                                                                   // 155
          return;                                                                                      // 156
        var callback = handle['_' + callbackName];                                                     // 157
        // clone arguments so that callbacks can mutate their arguments                                // 158
        callback && callback.apply(null, EJSON.clone(args));                                           // 159
      });                                                                                              // 160
    });                                                                                                // 161
  },                                                                                                   // 162
                                                                                                       // 163
  // Sends initial adds to a handle. It should only be called from within a task                       // 164
  // (the task that is processing the addHandleAndSendInitialAdds call). It                            // 165
  // synchronously invokes the handle's added or addedBefore; there's no need to                       // 166
  // flush the queue afterwards to ensure that the callbacks get out.                                  // 167
  _sendAdds: function (handle) {                                                                       // 168
    var self = this;                                                                                   // 169
    if (self._queue.safeToRunTask())                                                                   // 170
      throw Error("_sendAdds may only be called from within a task!");                                 // 171
    var add = self._ordered ? handle._addedBefore : handle._added;                                     // 172
    if (!add)                                                                                          // 173
      return;                                                                                          // 174
    // note: docs may be an _IdMap or an OrderedDict                                                   // 175
    self._cache.docs.forEach(function (doc, id) {                                                      // 176
      if (!_.has(self._handles, handle._id))                                                           // 177
        throw Error("handle got removed before sending initial adds!");                                // 178
      var fields = EJSON.clone(doc);                                                                   // 179
      delete fields._id;                                                                               // 180
      if (self._ordered)                                                                               // 181
        add(id, fields, null); // we're going in order, so add at end                                  // 182
      else                                                                                             // 183
        add(id, fields);                                                                               // 184
    });                                                                                                // 185
  }                                                                                                    // 186
});                                                                                                    // 187
                                                                                                       // 188
                                                                                                       // 189
var nextObserveHandleId = 1;                                                                           // 190
ObserveHandle = function (multiplexer, callbacks) {                                                    // 191
  var self = this;                                                                                     // 192
  // The end user is only supposed to call stop().  The other fields are                               // 193
  // accessible to the multiplexer, though.                                                            // 194
  self._multiplexer = multiplexer;                                                                     // 195
  _.each(multiplexer.callbackNames(), function (name) {                                                // 196
    if (callbacks[name]) {                                                                             // 197
      self['_' + name] = callbacks[name];                                                              // 198
    } else if (name === "addedBefore" && callbacks.added) {                                            // 199
      // Special case: if you specify "added" and "movedBefore", you get an                            // 200
      // ordered observe where for some reason you don't get ordering data on                          // 201
      // the adds.  I dunno, we wrote tests for it, there must have been a                             // 202
      // reason.                                                                                       // 203
      self._addedBefore = function (id, fields, before) {                                              // 204
        callbacks.added(id, fields);                                                                   // 205
      };                                                                                               // 206
    }                                                                                                  // 207
  });                                                                                                  // 208
  self._stopped = false;                                                                               // 209
  self._id = nextObserveHandleId++;                                                                    // 210
};                                                                                                     // 211
ObserveHandle.prototype.stop = function () {                                                           // 212
  var self = this;                                                                                     // 213
  if (self._stopped)                                                                                   // 214
    return;                                                                                            // 215
  self._stopped = true;                                                                                // 216
  self._multiplexer.removeHandle(self._id);                                                            // 217
};                                                                                                     // 218
                                                                                                       // 219
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/doc_fetcher.js                                                              //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Fiber = Npm.require('fibers');                                                                     // 1
var Future = Npm.require('fibers/future');                                                             // 2
                                                                                                       // 3
DocFetcher = function (mongoConnection) {                                                              // 4
  var self = this;                                                                                     // 5
  self._mongoConnection = mongoConnection;                                                             // 6
  // Map from cache key -> [callback]                                                                  // 7
  self._callbacksForCacheKey = {};                                                                     // 8
};                                                                                                     // 9
                                                                                                       // 10
_.extend(DocFetcher.prototype, {                                                                       // 11
  // Fetches document "id" from collectionName, returning it or null if not                            // 12
  // found.                                                                                            // 13
  //                                                                                                   // 14
  // If you make multiple calls to fetch() with the same cacheKey (a string),                          // 15
  // DocFetcher may assume that they all return the same document. (It does                            // 16
  // not check to see if collectionName/id match.)                                                     // 17
  //                                                                                                   // 18
  // You may assume that callback is never called synchronously (and in fact                           // 19
  // OplogObserveDriver does so).                                                                      // 20
  fetch: function (collectionName, id, cacheKey, callback) {                                           // 21
    var self = this;                                                                                   // 22
                                                                                                       // 23
    check(collectionName, String);                                                                     // 24
    // id is some sort of scalar                                                                       // 25
    check(cacheKey, String);                                                                           // 26
                                                                                                       // 27
    // If there's already an in-progress fetch for this cache key, yield until                         // 28
    // it's done and return whatever it returns.                                                       // 29
    if (_.has(self._callbacksForCacheKey, cacheKey)) {                                                 // 30
      self._callbacksForCacheKey[cacheKey].push(callback);                                             // 31
      return;                                                                                          // 32
    }                                                                                                  // 33
                                                                                                       // 34
    var callbacks = self._callbacksForCacheKey[cacheKey] = [callback];                                 // 35
                                                                                                       // 36
    Fiber(function () {                                                                                // 37
      try {                                                                                            // 38
        var doc = self._mongoConnection.findOne(                                                       // 39
          collectionName, {_id: id}) || null;                                                          // 40
        // Return doc to all relevant callbacks. Note that this array can                              // 41
        // continue to grow during callback excecution.                                                // 42
        while (!_.isEmpty(callbacks)) {                                                                // 43
          // Clone the document so that the various calls to fetch don't return                        // 44
          // objects that are intertwingled with each other. Clone before                              // 45
          // popping the future, so that if clone throws, the error gets passed                        // 46
          // to the next callback.                                                                     // 47
          var clonedDoc = EJSON.clone(doc);                                                            // 48
          callbacks.pop()(null, clonedDoc);                                                            // 49
        }                                                                                              // 50
      } catch (e) {                                                                                    // 51
        while (!_.isEmpty(callbacks)) {                                                                // 52
          callbacks.pop()(e);                                                                          // 53
        }                                                                                              // 54
      } finally {                                                                                      // 55
        // XXX consider keeping the doc around for a period of time before                             // 56
        // removing from the cache                                                                     // 57
        delete self._callbacksForCacheKey[cacheKey];                                                   // 58
      }                                                                                                // 59
    }).run();                                                                                          // 60
  }                                                                                                    // 61
});                                                                                                    // 62
                                                                                                       // 63
MongoTest.DocFetcher = DocFetcher;                                                                     // 64
                                                                                                       // 65
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/polling_observe_driver.js                                                   //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
PollingObserveDriver = function (options) {                                                            // 1
  var self = this;                                                                                     // 2
                                                                                                       // 3
  self._cursorDescription = options.cursorDescription;                                                 // 4
  self._mongoHandle = options.mongoHandle;                                                             // 5
  self._ordered = options.ordered;                                                                     // 6
  self._multiplexer = options.multiplexer;                                                             // 7
  self._stopCallbacks = [];                                                                            // 8
  self._stopped = false;                                                                               // 9
                                                                                                       // 10
  self._synchronousCursor = self._mongoHandle._createSynchronousCursor(                                // 11
    self._cursorDescription);                                                                          // 12
                                                                                                       // 13
  // previous results snapshot.  on each poll cycle, diffs against                                     // 14
  // results drives the callbacks.                                                                     // 15
  self._results = null;                                                                                // 16
                                                                                                       // 17
  // The number of _pollMongo calls that have been added to self._taskQueue but                        // 18
  // have not started running. Used to make sure we never schedule more than one                       // 19
  // _pollMongo (other than possibly the one that is currently running). It's                          // 20
  // also used by _suspendPolling to pretend there's a poll scheduled. Usually,                        // 21
  // it's either 0 (for "no polls scheduled other than maybe one currently                             // 22
  // running") or 1 (for "a poll scheduled that isn't running yet"), but it can                        // 23
  // also be 2 if incremented by _suspendPolling.                                                      // 24
  self._pollsScheduledButNotStarted = 0;                                                               // 25
  self._pendingWrites = []; // people to notify when polling completes                                 // 26
                                                                                                       // 27
  // Make sure to create a separately throttled function for each                                      // 28
  // PollingObserveDriver object.                                                                      // 29
  self._ensurePollIsScheduled = _.throttle(                                                            // 30
    self._unthrottledEnsurePollIsScheduled, 50 /* ms */);                                              // 31
                                                                                                       // 32
  // XXX figure out if we still need a queue                                                           // 33
  self._taskQueue = new Meteor._SynchronousQueue();                                                    // 34
                                                                                                       // 35
  var listenersHandle = listenAll(                                                                     // 36
    self._cursorDescription, function (notification) {                                                 // 37
      // When someone does a transaction that might affect us, schedule a poll                         // 38
      // of the database. If that transaction happens inside of a write fence,                         // 39
      // block the fence until we've polled and notified observers.                                    // 40
      var fence = DDPServer._CurrentWriteFence.get();                                                  // 41
      if (fence)                                                                                       // 42
        self._pendingWrites.push(fence.beginWrite());                                                  // 43
      // Ensure a poll is scheduled... but if we already know that one is,                             // 44
      // don't hit the throttled _ensurePollIsScheduled function (which might                          // 45
      // lead to us calling it unnecessarily in 50ms).                                                 // 46
      if (self._pollsScheduledButNotStarted === 0)                                                     // 47
        self._ensurePollIsScheduled();                                                                 // 48
    }                                                                                                  // 49
  );                                                                                                   // 50
  self._stopCallbacks.push(function () { listenersHandle.stop(); });                                   // 51
                                                                                                       // 52
  // every once and a while, poll even if we don't think we're dirty, for                              // 53
  // eventual consistency with database writes from outside the Meteor                                 // 54
  // universe.                                                                                         // 55
  //                                                                                                   // 56
  // For testing, there's an undocumented callback argument to observeChanges                          // 57
  // which disables time-based polling and gets called at the beginning of each                        // 58
  // poll.                                                                                             // 59
  if (options._testOnlyPollCallback) {                                                                 // 60
    self._testOnlyPollCallback = options._testOnlyPollCallback;                                        // 61
  } else {                                                                                             // 62
    var intervalHandle = Meteor.setInterval(                                                           // 63
      _.bind(self._ensurePollIsScheduled, self), 10 * 1000);                                           // 64
    self._stopCallbacks.push(function () {                                                             // 65
      Meteor.clearInterval(intervalHandle);                                                            // 66
    });                                                                                                // 67
  }                                                                                                    // 68
                                                                                                       // 69
  // Make sure we actually poll soon!                                                                  // 70
  self._unthrottledEnsurePollIsScheduled();                                                            // 71
                                                                                                       // 72
  Package.facts && Package.facts.Facts.incrementServerFact(                                            // 73
    "mongo-livedata", "observe-drivers-polling", 1);                                                   // 74
};                                                                                                     // 75
                                                                                                       // 76
_.extend(PollingObserveDriver.prototype, {                                                             // 77
  // This is always called through _.throttle (except once at startup).                                // 78
  _unthrottledEnsurePollIsScheduled: function () {                                                     // 79
    var self = this;                                                                                   // 80
    if (self._pollsScheduledButNotStarted > 0)                                                         // 81
      return;                                                                                          // 82
    ++self._pollsScheduledButNotStarted;                                                               // 83
    self._taskQueue.queueTask(function () {                                                            // 84
      self._pollMongo();                                                                               // 85
    });                                                                                                // 86
  },                                                                                                   // 87
                                                                                                       // 88
  // test-only interface for controlling polling.                                                      // 89
  //                                                                                                   // 90
  // _suspendPolling blocks until any currently running and scheduled polls are                        // 91
  // done, and prevents any further polls from being scheduled. (new                                   // 92
  // ObserveHandles can be added and receive their initial added callbacks,                            // 93
  // though.)                                                                                          // 94
  //                                                                                                   // 95
  // _resumePolling immediately polls, and allows further polls to occur.                              // 96
  _suspendPolling: function() {                                                                        // 97
    var self = this;                                                                                   // 98
    // Pretend that there's another poll scheduled (which will prevent                                 // 99
    // _ensurePollIsScheduled from queueing any more polls).                                           // 100
    ++self._pollsScheduledButNotStarted;                                                               // 101
    // Now block until all currently running or scheduled polls are done.                              // 102
    self._taskQueue.runTask(function() {});                                                            // 103
                                                                                                       // 104
    // Confirm that there is only one "poll" (the fake one we're pretending to                         // 105
    // have) scheduled.                                                                                // 106
    if (self._pollsScheduledButNotStarted !== 1)                                                       // 107
      throw new Error("_pollsScheduledButNotStarted is " +                                             // 108
                      self._pollsScheduledButNotStarted);                                              // 109
  },                                                                                                   // 110
  _resumePolling: function() {                                                                         // 111
    var self = this;                                                                                   // 112
    // We should be in the same state as in the end of _suspendPolling.                                // 113
    if (self._pollsScheduledButNotStarted !== 1)                                                       // 114
      throw new Error("_pollsScheduledButNotStarted is " +                                             // 115
                      self._pollsScheduledButNotStarted);                                              // 116
    // Run a poll synchronously (which will counteract the                                             // 117
    // ++_pollsScheduledButNotStarted from _suspendPolling).                                           // 118
    self._taskQueue.runTask(function () {                                                              // 119
      self._pollMongo();                                                                               // 120
    });                                                                                                // 121
  },                                                                                                   // 122
                                                                                                       // 123
  _pollMongo: function () {                                                                            // 124
    var self = this;                                                                                   // 125
    --self._pollsScheduledButNotStarted;                                                               // 126
                                                                                                       // 127
    var first = false;                                                                                 // 128
    if (!self._results) {                                                                              // 129
      first = true;                                                                                    // 130
      // XXX maybe use OrderedDict instead?                                                            // 131
      self._results = self._ordered ? [] : new LocalCollection._IdMap;                                 // 132
    }                                                                                                  // 133
                                                                                                       // 134
    self._testOnlyPollCallback && self._testOnlyPollCallback();                                        // 135
                                                                                                       // 136
    // Save the list of pending writes which this round will commit.                                   // 137
    var writesForCycle = self._pendingWrites;                                                          // 138
    self._pendingWrites = [];                                                                          // 139
                                                                                                       // 140
    // Get the new query results. (These calls can yield.)                                             // 141
    if (!first)                                                                                        // 142
      self._synchronousCursor.rewind();                                                                // 143
    var newResults = self._synchronousCursor.getRawObjects(self._ordered);                             // 144
    var oldResults = self._results;                                                                    // 145
                                                                                                       // 146
    // Run diffs. (This can yield too.)                                                                // 147
    if (!self._stopped) {                                                                              // 148
      LocalCollection._diffQueryChanges(                                                               // 149
        self._ordered, oldResults, newResults, self._multiplexer);                                     // 150
    }                                                                                                  // 151
                                                                                                       // 152
    // Replace self._results atomically.                                                               // 153
    self._results = newResults;                                                                        // 154
                                                                                                       // 155
    // Signals the multiplexer to call all initial adds.                                               // 156
    if (first)                                                                                         // 157
      self._multiplexer.ready();                                                                       // 158
                                                                                                       // 159
    // Once the ObserveMultiplexer has processed everything we've done in this                         // 160
    // round, mark all the writes which existed before this call as                                    // 161
    // commmitted. (If new writes have shown up in the meantime, there'll                              // 162
    // already be another _pollMongo task scheduled.)                                                  // 163
    self._multiplexer.onFlush(function () {                                                            // 164
      _.each(writesForCycle, function (w) {                                                            // 165
        w.committed();                                                                                 // 166
      });                                                                                              // 167
    });                                                                                                // 168
  },                                                                                                   // 169
                                                                                                       // 170
  stop: function () {                                                                                  // 171
    var self = this;                                                                                   // 172
    self._stopped = true;                                                                              // 173
    _.each(self._stopCallbacks, function (c) { c(); });                                                // 174
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 175
      "mongo-livedata", "observe-drivers-polling", -1);                                                // 176
  }                                                                                                    // 177
});                                                                                                    // 178
                                                                                                       // 179
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/oplog_observe_driver.js                                                     //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
var Fiber = Npm.require('fibers');                                                                     // 1
var Future = Npm.require('fibers/future');                                                             // 2
                                                                                                       // 3
var PHASE = {                                                                                          // 4
  QUERYING: "QUERYING",                                                                                // 5
  FETCHING: "FETCHING",                                                                                // 6
  STEADY: "STEADY"                                                                                     // 7
};                                                                                                     // 8
                                                                                                       // 9
// Exception thrown by _needToPollQuery which unrolls the stack up to the                              // 10
// enclosing call to finishIfNeedToPollQuery.                                                          // 11
var SwitchedToQuery = function () {};                                                                  // 12
var finishIfNeedToPollQuery = function (f) {                                                           // 13
  return function () {                                                                                 // 14
    try {                                                                                              // 15
      f.apply(this, arguments);                                                                        // 16
    } catch (e) {                                                                                      // 17
      if (!(e instanceof SwitchedToQuery))                                                             // 18
        throw e;                                                                                       // 19
    }                                                                                                  // 20
  };                                                                                                   // 21
};                                                                                                     // 22
                                                                                                       // 23
// OplogObserveDriver is an alternative to PollingObserveDriver which follows                          // 24
// the Mongo operation log instead of just re-polling the query. It obeys the                          // 25
// same simple interface: constructing it starts sending observeChanges                                // 26
// callbacks (and a ready() invocation) to the ObserveMultiplexer, and you stop                        // 27
// it by calling the stop() method.                                                                    // 28
OplogObserveDriver = function (options) {                                                              // 29
  var self = this;                                                                                     // 30
  self._usesOplog = true;  // tests look at this                                                       // 31
                                                                                                       // 32
  self._cursorDescription = options.cursorDescription;                                                 // 33
  self._mongoHandle = options.mongoHandle;                                                             // 34
  self._multiplexer = options.multiplexer;                                                             // 35
                                                                                                       // 36
  if (options.ordered) {                                                                               // 37
    throw Error("OplogObserveDriver only supports unordered observeChanges");                          // 38
  }                                                                                                    // 39
                                                                                                       // 40
  var sorter = options.sorter;                                                                         // 41
  // We don't support $near and other geo-queries so it's OK to initialize the                         // 42
  // comparator only once in the constructor.                                                          // 43
  var comparator = sorter && sorter.getComparator();                                                   // 44
                                                                                                       // 45
  if (options.cursorDescription.options.limit) {                                                       // 46
    // There are several properties ordered driver implements:                                         // 47
    // - _limit is a positive number                                                                   // 48
    // - _comparator is a function-comparator by which the query is ordered                            // 49
    // - _unpublishedBuffer is non-null Min/Max Heap,                                                  // 50
    //                      the empty buffer in STEADY phase implies that the                          // 51
    //                      everything that matches the queries selector fits                          // 52
    //                      into published set.                                                        // 53
    // - _published - Min Heap (also implements IdMap methods)                                         // 54
                                                                                                       // 55
    var heapOptions = { IdMap: LocalCollection._IdMap };                                               // 56
    self._limit = self._cursorDescription.options.limit;                                               // 57
    self._comparator = comparator;                                                                     // 58
    self._sorter = sorter;                                                                             // 59
    self._unpublishedBuffer = new MinMaxHeap(comparator, heapOptions);                                 // 60
    // We need something that can find Max value in addition to IdMap interface                        // 61
    self._published = new MaxHeap(comparator, heapOptions);                                            // 62
  } else {                                                                                             // 63
    self._limit = 0;                                                                                   // 64
    self._comparator = null;                                                                           // 65
    self._sorter = null;                                                                               // 66
    self._unpublishedBuffer = null;                                                                    // 67
    self._published = new LocalCollection._IdMap;                                                      // 68
  }                                                                                                    // 69
                                                                                                       // 70
  // Indicates if it is safe to insert a new document at the end of the buffer                         // 71
  // for this query. i.e. it is known that there are no documents matching the                         // 72
  // selector those are not in published or buffer.                                                    // 73
  self._safeAppendToBuffer = false;                                                                    // 74
                                                                                                       // 75
  self._stopped = false;                                                                               // 76
  self._stopHandles = [];                                                                              // 77
                                                                                                       // 78
  Package.facts && Package.facts.Facts.incrementServerFact(                                            // 79
    "mongo-livedata", "observe-drivers-oplog", 1);                                                     // 80
                                                                                                       // 81
  self._registerPhaseChange(PHASE.QUERYING);                                                           // 82
                                                                                                       // 83
  var selector = self._cursorDescription.selector;                                                     // 84
  self._matcher = options.matcher;                                                                     // 85
  var projection = self._cursorDescription.options.fields || {};                                       // 86
  self._projectionFn = LocalCollection._compileProjection(projection);                                 // 87
  // Projection function, result of combining important fields for selector and                        // 88
  // existing fields projection                                                                        // 89
  self._sharedProjection = self._matcher.combineIntoProjection(projection);                            // 90
  if (sorter)                                                                                          // 91
    self._sharedProjection = sorter.combineIntoProjection(self._sharedProjection);                     // 92
  self._sharedProjectionFn = LocalCollection._compileProjection(                                       // 93
    self._sharedProjection);                                                                           // 94
                                                                                                       // 95
  self._needToFetch = new LocalCollection._IdMap;                                                      // 96
  self._currentlyFetching = null;                                                                      // 97
  self._fetchGeneration = 0;                                                                           // 98
                                                                                                       // 99
  self._requeryWhenDoneThisQuery = false;                                                              // 100
  self._writesToCommitWhenWeReachSteady = [];                                                          // 101
                                                                                                       // 102
  forEachTrigger(self._cursorDescription, function (trigger) {                                         // 103
    self._stopHandles.push(self._mongoHandle._oplogHandle.onOplogEntry(                                // 104
      trigger, function (notification) {                                                               // 105
        Meteor._noYieldsAllowed(finishIfNeedToPollQuery(function () {                                  // 106
          var op = notification.op;                                                                    // 107
          if (notification.dropCollection) {                                                           // 108
            // Note: this call is not allowed to block on anything (especially                         // 109
            // on waiting for oplog entries to catch up) because that will block                       // 110
            // onOplogEntry!                                                                           // 111
            self._needToPollQuery();                                                                   // 112
          } else {                                                                                     // 113
            // All other operators should be handled depending on phase                                // 114
            if (self._phase === PHASE.QUERYING)                                                        // 115
              self._handleOplogEntryQuerying(op);                                                      // 116
            else                                                                                       // 117
              self._handleOplogEntrySteadyOrFetching(op);                                              // 118
          }                                                                                            // 119
        }));                                                                                           // 120
      }                                                                                                // 121
    ));                                                                                                // 122
  });                                                                                                  // 123
                                                                                                       // 124
  // XXX ordering w.r.t. everything else?                                                              // 125
  self._stopHandles.push(listenAll(                                                                    // 126
    self._cursorDescription, function (notification) {                                                 // 127
      // If we're not in a write fence, we don't have to do anything.                                  // 128
      var fence = DDPServer._CurrentWriteFence.get();                                                  // 129
      if (!fence)                                                                                      // 130
        return;                                                                                        // 131
      var write = fence.beginWrite();                                                                  // 132
      // This write cannot complete until we've caught up to "this point" in the                       // 133
      // oplog, and then made it back to the steady state.                                             // 134
      Meteor.defer(function () {                                                                       // 135
        self._mongoHandle._oplogHandle.waitUntilCaughtUp();                                            // 136
        if (self._stopped) {                                                                           // 137
          // We're stopped, so just immediately commit.                                                // 138
          write.committed();                                                                           // 139
        } else if (self._phase === PHASE.STEADY) {                                                     // 140
          // Make sure that all of the callbacks have made it through the                              // 141
          // multiplexer and been delivered to ObserveHandles before committing                        // 142
          // writes.                                                                                   // 143
          self._multiplexer.onFlush(function () {                                                      // 144
            write.committed();                                                                         // 145
          });                                                                                          // 146
        } else {                                                                                       // 147
          self._writesToCommitWhenWeReachSteady.push(write);                                           // 148
        }                                                                                              // 149
      });                                                                                              // 150
    }                                                                                                  // 151
  ));                                                                                                  // 152
                                                                                                       // 153
  // Give _observeChanges a chance to add the new ObserveHandle to our                                 // 154
  // multiplexer, so that the added calls get streamed.                                                // 155
  Meteor.defer(finishIfNeedToPollQuery(function () {                                                   // 156
    self._runInitialQuery();                                                                           // 157
  }));                                                                                                 // 158
};                                                                                                     // 159
                                                                                                       // 160
_.extend(OplogObserveDriver.prototype, {                                                               // 161
  _addPublished: function (id, doc) {                                                                  // 162
    var self = this;                                                                                   // 163
    var fields = _.clone(doc);                                                                         // 164
    delete fields._id;                                                                                 // 165
    self._published.set(id, self._sharedProjectionFn(doc));                                            // 166
    self._multiplexer.added(id, self._projectionFn(fields));                                           // 167
                                                                                                       // 168
    // After adding this document, the published set might be overflowed                               // 169
    // (exceeding capacity specified by limit). If so, push the maximum element                        // 170
    // to the buffer, we might want to save it in memory to reduce the amount of                       // 171
    // Mongo lookups in the future.                                                                    // 172
    if (self._limit && self._published.size() > self._limit) {                                         // 173
      // XXX in theory the size of published is no more than limit+1                                   // 174
      if (self._published.size() !== self._limit + 1) {                                                // 175
        throw new Error("After adding to published, " +                                                // 176
                        (self._published.size() - self._limit) +                                       // 177
                        " documents are overflowing the set");                                         // 178
      }                                                                                                // 179
                                                                                                       // 180
      var overflowingDocId = self._published.maxElementId();                                           // 181
      var overflowingDoc = self._published.get(overflowingDocId);                                      // 182
                                                                                                       // 183
      if (EJSON.equals(overflowingDocId, id)) {                                                        // 184
        throw new Error("The document just added is overflowing the published set");                   // 185
      }                                                                                                // 186
                                                                                                       // 187
      self._published.remove(overflowingDocId);                                                        // 188
      self._multiplexer.removed(overflowingDocId);                                                     // 189
      self._addBuffered(overflowingDocId, overflowingDoc);                                             // 190
    }                                                                                                  // 191
  },                                                                                                   // 192
  _removePublished: function (id) {                                                                    // 193
    var self = this;                                                                                   // 194
    self._published.remove(id);                                                                        // 195
    self._multiplexer.removed(id);                                                                     // 196
    if (! self._limit || self._published.size() === self._limit)                                       // 197
      return;                                                                                          // 198
                                                                                                       // 199
    if (self._published.size() > self._limit)                                                          // 200
      throw Error("self._published got too big");                                                      // 201
                                                                                                       // 202
    // OK, we are publishing less than the limit. Maybe we should look in the                          // 203
    // buffer to find the next element past what we were publishing before.                            // 204
                                                                                                       // 205
    if (!self._unpublishedBuffer.empty()) {                                                            // 206
      // There's something in the buffer; move the first thing in it to                                // 207
      // _published.                                                                                   // 208
      var newDocId = self._unpublishedBuffer.minElementId();                                           // 209
      var newDoc = self._unpublishedBuffer.get(newDocId);                                              // 210
      self._removeBuffered(newDocId);                                                                  // 211
      self._addPublished(newDocId, newDoc);                                                            // 212
      return;                                                                                          // 213
    }                                                                                                  // 214
                                                                                                       // 215
    // There's nothing in the buffer.  This could mean one of a few things.                            // 216
                                                                                                       // 217
    // (a) We could be in the middle of re-running the query (specifically, we                         // 218
    // could be in _publishNewResults). In that case, _unpublishedBuffer is                            // 219
    // empty because we clear it at the beginning of _publishNewResults. In this                       // 220
    // case, our caller already knows the entire answer to the query and we                            // 221
    // don't need to do anything fancy here.  Just return.                                             // 222
    if (self._phase === PHASE.QUERYING)                                                                // 223
      return;                                                                                          // 224
                                                                                                       // 225
    // (b) We're pretty confident that the union of _published and                                     // 226
    // _unpublishedBuffer contain all documents that match selector. Because                           // 227
    // _unpublishedBuffer is empty, that means we're confident that _published                         // 228
    // contains all documents that match selector. So we have nothing to do.                           // 229
    if (self._safeAppendToBuffer)                                                                      // 230
      return;                                                                                          // 231
                                                                                                       // 232
    // (c) Maybe there are other documents out there that should be in our                             // 233
    // buffer. But in that case, when we emptied _unpublishedBuffer in                                 // 234
    // _removeBuffered, we should have called _needToPollQuery, which will                             // 235
    // either put something in _unpublishedBuffer or set _safeAppendToBuffer (or                       // 236
    // both), and it will put us in QUERYING for that whole time. So in fact, we                       // 237
    // shouldn't be able to get here.                                                                  // 238
                                                                                                       // 239
    throw new Error("Buffer inexplicably empty");                                                      // 240
  },                                                                                                   // 241
  _changePublished: function (id, oldDoc, newDoc) {                                                    // 242
    var self = this;                                                                                   // 243
    self._published.set(id, self._sharedProjectionFn(newDoc));                                         // 244
    var changed = LocalCollection._makeChangedFields(_.clone(newDoc), oldDoc);                         // 245
    changed = self._projectionFn(changed);                                                             // 246
    if (!_.isEmpty(changed))                                                                           // 247
      self._multiplexer.changed(id, changed);                                                          // 248
  },                                                                                                   // 249
  _addBuffered: function (id, doc) {                                                                   // 250
    var self = this;                                                                                   // 251
    self._unpublishedBuffer.set(id, self._sharedProjectionFn(doc));                                    // 252
                                                                                                       // 253
    // If something is overflowing the buffer, we just remove it from cache                            // 254
    if (self._unpublishedBuffer.size() > self._limit) {                                                // 255
      var maxBufferedId = self._unpublishedBuffer.maxElementId();                                      // 256
                                                                                                       // 257
      self._unpublishedBuffer.remove(maxBufferedId);                                                   // 258
                                                                                                       // 259
      // Since something matching is removed from cache (both published set and                        // 260
      // buffer), set flag to false                                                                    // 261
      self._safeAppendToBuffer = false;                                                                // 262
    }                                                                                                  // 263
  },                                                                                                   // 264
  // Is called either to remove the doc completely from matching set or to move                        // 265
  // it to the published set later.                                                                    // 266
  _removeBuffered: function (id) {                                                                     // 267
    var self = this;                                                                                   // 268
    self._unpublishedBuffer.remove(id);                                                                // 269
    // To keep the contract "buffer is never empty in STEADY phase unless the                          // 270
    // everything matching fits into published" true, we poll everything as soon                       // 271
    // as we see the buffer becoming empty.                                                            // 272
    if (! self._unpublishedBuffer.size() && ! self._safeAppendToBuffer)                                // 273
      self._needToPollQuery();                                                                         // 274
  },                                                                                                   // 275
  // Called when a document has joined the "Matching" results set.                                     // 276
  // Takes responsibility of keeping _unpublishedBuffer in sync with _published                        // 277
  // and the effect of limit enforced.                                                                 // 278
  _addMatching: function (doc) {                                                                       // 279
    var self = this;                                                                                   // 280
    var id = doc._id;                                                                                  // 281
    if (self._published.has(id))                                                                       // 282
      throw Error("tried to add something already published " + id);                                   // 283
    if (self._limit && self._unpublishedBuffer.has(id))                                                // 284
      throw Error("tried to add something already existed in buffer " + id);                           // 285
                                                                                                       // 286
    var limit = self._limit;                                                                           // 287
    var comparator = self._comparator;                                                                 // 288
    var maxPublished = (limit && self._published.size() > 0) ?                                         // 289
      self._published.get(self._published.maxElementId()) : null;                                      // 290
    var maxBuffered = (limit && self._unpublishedBuffer.size() > 0) ?                                  // 291
      self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId()) : null;                      // 292
    // The query is unlimited or didn't publish enough documents yet or the new                        // 293
    // document would fit into published set pushing the maximum element out,                          // 294
    // then we need to publish the doc.                                                                // 295
    var toPublish = ! limit || self._published.size() < limit ||                                       // 296
                    comparator(doc, maxPublished) < 0;                                                 // 297
                                                                                                       // 298
    // Otherwise we might need to buffer it (only in case of limited query).                           // 299
    // Buffering is allowed if the buffer is not filled up yet and all matching                        // 300
    // docs are either in the published set or in the buffer.                                          // 301
    var canAppendToBuffer = !toPublish && self._safeAppendToBuffer &&                                  // 302
                            self._unpublishedBuffer.size() < limit;                                    // 303
                                                                                                       // 304
    // Or if it is small enough to be safely inserted to the middle or the                             // 305
    // beginning of the buffer.                                                                        // 306
    var canInsertIntoBuffer = !toPublish && maxBuffered &&                                             // 307
                              comparator(doc, maxBuffered) <= 0;                                       // 308
                                                                                                       // 309
    var toBuffer = canAppendToBuffer || canInsertIntoBuffer;                                           // 310
                                                                                                       // 311
    if (toPublish) {                                                                                   // 312
      self._addPublished(id, doc);                                                                     // 313
    } else if (toBuffer) {                                                                             // 314
      self._addBuffered(id, doc);                                                                      // 315
    } else {                                                                                           // 316
      // dropping it and not saving to the cache                                                       // 317
      self._safeAppendToBuffer = false;                                                                // 318
    }                                                                                                  // 319
  },                                                                                                   // 320
  // Called when a document leaves the "Matching" results set.                                         // 321
  // Takes responsibility of keeping _unpublishedBuffer in sync with _published                        // 322
  // and the effect of limit enforced.                                                                 // 323
  _removeMatching: function (id) {                                                                     // 324
    var self = this;                                                                                   // 325
    if (! self._published.has(id) && ! self._limit)                                                    // 326
      throw Error("tried to remove something matching but not cached " + id);                          // 327
                                                                                                       // 328
    if (self._published.has(id)) {                                                                     // 329
      self._removePublished(id);                                                                       // 330
    } else if (self._unpublishedBuffer.has(id)) {                                                      // 331
      self._removeBuffered(id);                                                                        // 332
    }                                                                                                  // 333
  },                                                                                                   // 334
  _handleDoc: function (id, newDoc) {                                                                  // 335
    var self = this;                                                                                   // 336
    var matchesNow = newDoc && self._matcher.documentMatches(newDoc).result;                           // 337
                                                                                                       // 338
    var publishedBefore = self._published.has(id);                                                     // 339
    var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);                               // 340
    var cachedBefore = publishedBefore || bufferedBefore;                                              // 341
                                                                                                       // 342
    if (matchesNow && !cachedBefore) {                                                                 // 343
      self._addMatching(newDoc);                                                                       // 344
    } else if (cachedBefore && !matchesNow) {                                                          // 345
      self._removeMatching(id);                                                                        // 346
    } else if (cachedBefore && matchesNow) {                                                           // 347
      var oldDoc = self._published.get(id);                                                            // 348
      var comparator = self._comparator;                                                               // 349
      var minBuffered = self._limit && self._unpublishedBuffer.size() &&                               // 350
        self._unpublishedBuffer.get(self._unpublishedBuffer.minElementId());                           // 351
                                                                                                       // 352
      if (publishedBefore) {                                                                           // 353
        // Unlimited case where the document stays in published once it matches                        // 354
        // or the case when we don't have enough matching docs to publish or the                       // 355
        // changed but matching doc will stay in published anyways.                                    // 356
        // XXX: We rely on the emptiness of buffer. Be sure to maintain the fact                       // 357
        // that buffer can't be empty if there are matching documents not                              // 358
        // published. Notably, we don't want to schedule repoll and continue                           // 359
        // relying on this property.                                                                   // 360
        var staysInPublished = ! self._limit ||                                                        // 361
                               self._unpublishedBuffer.size() === 0 ||                                 // 362
                               comparator(newDoc, minBuffered) <= 0;                                   // 363
                                                                                                       // 364
        if (staysInPublished) {                                                                        // 365
          self._changePublished(id, oldDoc, newDoc);                                                   // 366
        } else {                                                                                       // 367
          // after the change doc doesn't stay in the published, remove it                             // 368
          self._removePublished(id);                                                                   // 369
          // but it can move into buffered now, check it                                               // 370
          var maxBuffered = self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());       // 371
                                                                                                       // 372
          var toBuffer = self._safeAppendToBuffer ||                                                   // 373
                         (maxBuffered && comparator(newDoc, maxBuffered) <= 0);                        // 374
                                                                                                       // 375
          if (toBuffer) {                                                                              // 376
            self._addBuffered(id, newDoc);                                                             // 377
          } else {                                                                                     // 378
            // Throw away from both published set and buffer                                           // 379
            self._safeAppendToBuffer = false;                                                          // 380
          }                                                                                            // 381
        }                                                                                              // 382
      } else if (bufferedBefore) {                                                                     // 383
        oldDoc = self._unpublishedBuffer.get(id);                                                      // 384
        // remove the old version manually so we don't trigger the querying                            // 385
        // immediately                                                                                 // 386
        self._unpublishedBuffer.remove(id);                                                            // 387
                                                                                                       // 388
        var maxPublished = self._published.get(self._published.maxElementId());                        // 389
        var maxBuffered = self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());
                                                                                                       // 391
        // the buffered doc was updated, it could move to published                                    // 392
        var toPublish = comparator(newDoc, maxPublished) < 0;                                          // 393
                                                                                                       // 394
        // or stays in buffer even after the change                                                    // 395
        var staysInBuffer = (! toPublish && self._safeAppendToBuffer) ||                               // 396
          (!toPublish && maxBuffered && comparator(newDoc, maxBuffered) <= 0);                         // 397
                                                                                                       // 398
        if (toPublish) {                                                                               // 399
          self._addPublished(id, newDoc);                                                              // 400
        } else if (staysInBuffer) {                                                                    // 401
          // stays in buffer but changes                                                               // 402
          self._unpublishedBuffer.set(id, newDoc);                                                     // 403
        } else {                                                                                       // 404
          // Throw away from both published set and buffer                                             // 405
          self._safeAppendToBuffer = false;                                                            // 406
        }                                                                                              // 407
      } else {                                                                                         // 408
        throw new Error("cachedBefore implies either of publishedBefore or bufferedBefore is true.");  // 409
      }                                                                                                // 410
    }                                                                                                  // 411
  },                                                                                                   // 412
  _fetchModifiedDocuments: function () {                                                               // 413
    var self = this;                                                                                   // 414
    self._registerPhaseChange(PHASE.FETCHING);                                                         // 415
    // Defer, because nothing called from the oplog entry handler may yield, but                       // 416
    // fetch() yields.                                                                                 // 417
    Meteor.defer(finishIfNeedToPollQuery(function () {                                                 // 418
      while (!self._stopped && !self._needToFetch.empty()) {                                           // 419
        if (self._phase !== PHASE.FETCHING)                                                            // 420
          throw new Error("phase in fetchModifiedDocuments: " + self._phase);                          // 421
                                                                                                       // 422
        self._currentlyFetching = self._needToFetch;                                                   // 423
        var thisGeneration = ++self._fetchGeneration;                                                  // 424
        self._needToFetch = new LocalCollection._IdMap;                                                // 425
        var waiting = 0;                                                                               // 426
        var anyError = null;                                                                           // 427
        var fut = new Future;                                                                          // 428
        // This loop is safe, because _currentlyFetching will not be updated                           // 429
        // during this loop (in fact, it is never mutated).                                            // 430
        self._currentlyFetching.forEach(function (cacheKey, id) {                                      // 431
          waiting++;                                                                                   // 432
          self._mongoHandle._docFetcher.fetch(                                                         // 433
            self._cursorDescription.collectionName, id, cacheKey,                                      // 434
            finishIfNeedToPollQuery(function (err, doc) {                                              // 435
              try {                                                                                    // 436
                if (err) {                                                                             // 437
                  if (!anyError)                                                                       // 438
                    anyError = err;                                                                    // 439
                } else if (!self._stopped && self._phase === PHASE.FETCHING                            // 440
                           && self._fetchGeneration === thisGeneration) {                              // 441
                  // We re-check the generation in case we've had an explicit                          // 442
                  // _pollQuery call (eg, in another fiber) which should                               // 443
                  // effectively cancel this round of fetches.  (_pollQuery                            // 444
                  // increments the generation.)                                                       // 445
                  self._handleDoc(id, doc);                                                            // 446
                }                                                                                      // 447
              } finally {                                                                              // 448
                waiting--;                                                                             // 449
                // Because fetch() never calls its callback synchronously, this                        // 450
                // is safe (ie, we won't call fut.return() before the forEach is                       // 451
                // done).                                                                              // 452
                if (waiting === 0)                                                                     // 453
                  fut.return();                                                                        // 454
              }                                                                                        // 455
            }));                                                                                       // 456
        });                                                                                            // 457
        fut.wait();                                                                                    // 458
        // XXX do this even if we've switched to PHASE.QUERYING?                                       // 459
        if (anyError)                                                                                  // 460
          throw anyError;                                                                              // 461
        // Exit now if we've had a _pollQuery call (here or in another fiber).                         // 462
        if (self._phase === PHASE.QUERYING)                                                            // 463
          return;                                                                                      // 464
        self._currentlyFetching = null;                                                                // 465
      }                                                                                                // 466
      self._beSteady();                                                                                // 467
    }));                                                                                               // 468
  },                                                                                                   // 469
  _beSteady: function () {                                                                             // 470
    var self = this;                                                                                   // 471
    self._registerPhaseChange(PHASE.STEADY);                                                           // 472
    var writes = self._writesToCommitWhenWeReachSteady;                                                // 473
    self._writesToCommitWhenWeReachSteady = [];                                                        // 474
    self._multiplexer.onFlush(function () {                                                            // 475
      _.each(writes, function (w) {                                                                    // 476
        w.committed();                                                                                 // 477
      });                                                                                              // 478
    });                                                                                                // 479
  },                                                                                                   // 480
  _handleOplogEntryQuerying: function (op) {                                                           // 481
    var self = this;                                                                                   // 482
    self._needToFetch.set(idForOp(op), op.ts.toString());                                              // 483
  },                                                                                                   // 484
  _handleOplogEntrySteadyOrFetching: function (op) {                                                   // 485
    var self = this;                                                                                   // 486
    var id = idForOp(op);                                                                              // 487
    // If we're already fetching this one, or about to, we can't optimize; make                        // 488
    // sure that we fetch it again if necessary.                                                       // 489
    if (self._phase === PHASE.FETCHING &&                                                              // 490
        ((self._currentlyFetching && self._currentlyFetching.has(id)) ||                               // 491
         self._needToFetch.has(id))) {                                                                 // 492
      self._needToFetch.set(id, op.ts.toString());                                                     // 493
      return;                                                                                          // 494
    }                                                                                                  // 495
                                                                                                       // 496
    if (op.op === 'd') {                                                                               // 497
      if (self._published.has(id) || (self._limit && self._unpublishedBuffer.has(id)))                 // 498
        self._removeMatching(id);                                                                      // 499
    } else if (op.op === 'i') {                                                                        // 500
      if (self._published.has(id))                                                                     // 501
        throw new Error("insert found for already-existing ID in published");                          // 502
      if (self._unpublishedBuffer && self._unpublishedBuffer.has(id))                                  // 503
        throw new Error("insert found for already-existing ID in buffer");                             // 504
                                                                                                       // 505
      // XXX what if selector yields?  for now it can't but later it could have                        // 506
      // $where                                                                                        // 507
      if (self._matcher.documentMatches(op.o).result)                                                  // 508
        self._addMatching(op.o);                                                                       // 509
    } else if (op.op === 'u') {                                                                        // 510
      // Is this a modifier ($set/$unset, which may require us to poll the                             // 511
      // database to figure out if the whole document matches the selector) or a                       // 512
      // replacement (in which case we can just directly re-evaluate the                               // 513
      // selector)?                                                                                    // 514
      var isReplace = !_.has(op.o, '$set') && !_.has(op.o, '$unset');                                  // 515
      // If this modifier modifies something inside an EJSON custom type (ie,                          // 516
      // anything with EJSON$), then we can't try to use                                               // 517
      // LocalCollection._modify, since that just mutates the EJSON encoding,                          // 518
      // not the actual object.                                                                        // 519
      var canDirectlyModifyDoc =                                                                       // 520
            !isReplace && modifierCanBeDirectlyApplied(op.o);                                          // 521
                                                                                                       // 522
      var publishedBefore = self._published.has(id);                                                   // 523
      var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);                             // 524
                                                                                                       // 525
      if (isReplace) {                                                                                 // 526
        self._handleDoc(id, _.extend({_id: id}, op.o));                                                // 527
      } else if ((publishedBefore || bufferedBefore) && canDirectlyModifyDoc) {                        // 528
        // Oh great, we actually know what the document is, so we can apply                            // 529
        // this directly.                                                                              // 530
        var newDoc = self._published.has(id) ?                                                         // 531
          self._published.get(id) :                                                                    // 532
          self._unpublishedBuffer.get(id);                                                             // 533
        newDoc = EJSON.clone(newDoc);                                                                  // 534
                                                                                                       // 535
        newDoc._id = id;                                                                               // 536
        LocalCollection._modify(newDoc, op.o);                                                         // 537
        self._handleDoc(id, self._sharedProjectionFn(newDoc));                                         // 538
      } else if (!canDirectlyModifyDoc ||                                                              // 539
                 self._matcher.canBecomeTrueByModifier(op.o) ||                                        // 540
                 (self._sorter && self._sorter.affectedByModifier(op.o))) {                            // 541
        self._needToFetch.set(id, op.ts.toString());                                                   // 542
        if (self._phase === PHASE.STEADY)                                                              // 543
          self._fetchModifiedDocuments();                                                              // 544
      }                                                                                                // 545
    } else {                                                                                           // 546
      throw Error("XXX SURPRISING OPERATION: " + op);                                                  // 547
    }                                                                                                  // 548
  },                                                                                                   // 549
  _runInitialQuery: function () {                                                                      // 550
    var self = this;                                                                                   // 551
    if (self._stopped)                                                                                 // 552
      throw new Error("oplog stopped surprisingly early");                                             // 553
                                                                                                       // 554
    self._runQuery();                                                                                  // 555
                                                                                                       // 556
    if (self._stopped)                                                                                 // 557
      throw new Error("oplog stopped quite early");                                                    // 558
    // Allow observeChanges calls to return. (After this, it's possible for                            // 559
    // stop() to be called.)                                                                           // 560
    self._multiplexer.ready();                                                                         // 561
                                                                                                       // 562
    self._doneQuerying();                                                                              // 563
  },                                                                                                   // 564
                                                                                                       // 565
  // In various circumstances, we may just want to stop processing the oplog and                       // 566
  // re-run the initial query, just as if we were a PollingObserveDriver.                              // 567
  //                                                                                                   // 568
  // This function may not block, because it is called from an oplog entry                             // 569
  // handler.                                                                                          // 570
  //                                                                                                   // 571
  // XXX We should call this when we detect that we've been in FETCHING for "too                       // 572
  // long".                                                                                            // 573
  //                                                                                                   // 574
  // XXX We should call this when we detect Mongo failover (since that might                           // 575
  // mean that some of the oplog entries we have processed have been rolled                            // 576
  // back). The Node Mongo driver is in the middle of a bunch of huge                                  // 577
  // refactorings, including the way that it notifies you when primary                                 // 578
  // changes. Will put off implementing this until driver 1.4 is out.                                  // 579
  _pollQuery: function () {                                                                            // 580
    var self = this;                                                                                   // 581
                                                                                                       // 582
    if (self._stopped)                                                                                 // 583
      return;                                                                                          // 584
                                                                                                       // 585
    // Yay, we get to forget about all the things we thought we had to fetch.                          // 586
    self._needToFetch = new LocalCollection._IdMap;                                                    // 587
    self._currentlyFetching = null;                                                                    // 588
    ++self._fetchGeneration;  // ignore any in-flight fetches                                          // 589
    self._registerPhaseChange(PHASE.QUERYING);                                                         // 590
                                                                                                       // 591
    // Defer so that we don't block.  We don't need finishIfNeedToPollQuery here                       // 592
    // because SwitchedToQuery is not called in QUERYING mode.                                         // 593
    Meteor.defer(function () {                                                                         // 594
      self._runQuery();                                                                                // 595
      self._doneQuerying();                                                                            // 596
    });                                                                                                // 597
  },                                                                                                   // 598
                                                                                                       // 599
  _runQuery: function () {                                                                             // 600
    var self = this;                                                                                   // 601
    var newResults = new LocalCollection._IdMap;                                                       // 602
    var newBuffer = new LocalCollection._IdMap;                                                        // 603
                                                                                                       // 604
    // Query 2x documents as the half excluded from the original query will go                         // 605
    // into unpublished buffer to reduce additional Mongo lookups in cases when                        // 606
    // documents are removed from the published set and need a replacement.                            // 607
    // XXX needs more thought on non-zero skip                                                         // 608
    // XXX 2 is a "magic number" meaning there is an extra chunk of docs for                           // 609
    // buffer if such is needed.                                                                       // 610
    var cursor = self._cursorForQuery({ limit: self._limit * 2 });                                     // 611
    cursor.forEach(function (doc, i) {                                                                 // 612
      if (!self._limit || i < self._limit)                                                             // 613
        newResults.set(doc._id, doc);                                                                  // 614
      else                                                                                             // 615
        newBuffer.set(doc._id, doc);                                                                   // 616
    });                                                                                                // 617
                                                                                                       // 618
    self._publishNewResults(newResults, newBuffer);                                                    // 619
  },                                                                                                   // 620
                                                                                                       // 621
  // Transitions to QUERYING and runs another query, or (if already in QUERYING)                       // 622
  // ensures that we will query again later.                                                           // 623
  //                                                                                                   // 624
  // This function may not block, because it is called from an oplog entry                             // 625
  // handler. However, if we were not already in the QUERYING phase, it throws                         // 626
  // an exception that is caught by the closest surrounding                                            // 627
  // finishIfNeedToPollQuery call; this ensures that we don't continue running                         // 628
  // close that was designed for another phase inside PHASE.QUERYING.                                  // 629
  //                                                                                                   // 630
  // (It's also necessary whenever logic in this file yields to check that other                       // 631
  // phases haven't put us into QUERYING mode, though; eg,                                             // 632
  // _fetchModifiedDocuments does this.)                                                               // 633
  _needToPollQuery: function () {                                                                      // 634
    var self = this;                                                                                   // 635
    if (self._stopped)                                                                                 // 636
      return;                                                                                          // 637
                                                                                                       // 638
    // If we're not already in the middle of a query, we can query now (possibly                       // 639
    // pausing FETCHING).                                                                              // 640
    if (self._phase !== PHASE.QUERYING) {                                                              // 641
      self._pollQuery();                                                                               // 642
      throw new SwitchedToQuery;                                                                       // 643
    }                                                                                                  // 644
                                                                                                       // 645
    // We're currently in QUERYING. Set a flag to ensure that we run another                           // 646
    // query when we're done.                                                                          // 647
    self._requeryWhenDoneThisQuery = true;                                                             // 648
  },                                                                                                   // 649
                                                                                                       // 650
  _doneQuerying: function () {                                                                         // 651
    var self = this;                                                                                   // 652
                                                                                                       // 653
    if (self._stopped)                                                                                 // 654
      return;                                                                                          // 655
    self._mongoHandle._oplogHandle.waitUntilCaughtUp();                                                // 656
                                                                                                       // 657
    if (self._stopped)                                                                                 // 658
      return;                                                                                          // 659
    if (self._phase !== PHASE.QUERYING)                                                                // 660
      throw Error("Phase unexpectedly " + self._phase);                                                // 661
                                                                                                       // 662
    if (self._requeryWhenDoneThisQuery) {                                                              // 663
      self._requeryWhenDoneThisQuery = false;                                                          // 664
      self._pollQuery();                                                                               // 665
    } else if (self._needToFetch.empty()) {                                                            // 666
      self._beSteady();                                                                                // 667
    } else {                                                                                           // 668
      self._fetchModifiedDocuments();                                                                  // 669
    }                                                                                                  // 670
  },                                                                                                   // 671
                                                                                                       // 672
  _cursorForQuery: function (optionsOverwrite) {                                                       // 673
    var self = this;                                                                                   // 674
                                                                                                       // 675
    // The query we run is almost the same as the cursor we are observing, with                        // 676
    // a few changes. We need to read all the fields that are relevant to the                          // 677
    // selector, not just the fields we are going to publish (that's the                               // 678
    // "shared" projection). And we don't want to apply any transform in the                           // 679
    // cursor, because observeChanges shouldn't use the transform.                                     // 680
    var options = _.clone(self._cursorDescription.options);                                            // 681
                                                                                                       // 682
    // Allow the caller to modify the options. Useful to specify different skip                        // 683
    // and limit values.                                                                               // 684
    _.extend(options, optionsOverwrite);                                                               // 685
                                                                                                       // 686
    options.fields = self._sharedProjection;                                                           // 687
    delete options.transform;                                                                          // 688
    // We are NOT deep cloning fields or selector here, which should be OK.                            // 689
    var description = new CursorDescription(                                                           // 690
      self._cursorDescription.collectionName,                                                          // 691
      self._cursorDescription.selector,                                                                // 692
      options);                                                                                        // 693
    return new Cursor(self._mongoHandle, description);                                                 // 694
  },                                                                                                   // 695
                                                                                                       // 696
                                                                                                       // 697
  // Replace self._published with newResults (both are IdMaps), invoking observe                       // 698
  // callbacks on the multiplexer.                                                                     // 699
  // Replace self._unpublishedBuffer with newBuffer.                                                   // 700
  //                                                                                                   // 701
  // XXX This is very similar to LocalCollection._diffQueryUnorderedChanges. We                        // 702
  // should really: (a) Unify IdMap and OrderedDict into Unordered/OrderedDict (b)                     // 703
  // Rewrite diff.js to use these classes instead of arrays and objects.                               // 704
  _publishNewResults: function (newResults, newBuffer) {                                               // 705
    var self = this;                                                                                   // 706
                                                                                                       // 707
    // If the query is limited and there is a buffer, shut down so it doesn't                          // 708
    // stay in a way.                                                                                  // 709
    if (self._limit) {                                                                                 // 710
      self._unpublishedBuffer.clear();                                                                 // 711
    }                                                                                                  // 712
                                                                                                       // 713
    // First remove anything that's gone. Be careful not to modify                                     // 714
    // self._published while iterating over it.                                                        // 715
    var idsToRemove = [];                                                                              // 716
    self._published.forEach(function (doc, id) {                                                       // 717
      if (!newResults.has(id))                                                                         // 718
        idsToRemove.push(id);                                                                          // 719
    });                                                                                                // 720
    _.each(idsToRemove, function (id) {                                                                // 721
      self._removePublished(id);                                                                       // 722
    });                                                                                                // 723
                                                                                                       // 724
    // Now do adds and changes.                                                                        // 725
    // If self has a buffer and limit, the new fetched result will be                                  // 726
    // limited correctly as the query has sort specifier.                                              // 727
    newResults.forEach(function (doc, id) {                                                            // 728
      self._handleDoc(id, doc);                                                                        // 729
    });                                                                                                // 730
                                                                                                       // 731
    // Sanity-check that everything we tried to put into _published ended up                           // 732
    // there.                                                                                          // 733
    // XXX if this is slow, remove it later                                                            // 734
    if (self._published.size() !== newResults.size()) {                                                // 735
      throw Error("failed to copy newResults into _published!");                                       // 736
    }                                                                                                  // 737
    self._published.forEach(function (doc, id) {                                                       // 738
      if (!newResults.has(id))                                                                         // 739
        throw Error("_published has a doc that newResults doesn't; " + id);                            // 740
    });                                                                                                // 741
                                                                                                       // 742
    // Finally, replace the buffer                                                                     // 743
    newBuffer.forEach(function (doc, id) {                                                             // 744
      self._addBuffered(id, doc);                                                                      // 745
    });                                                                                                // 746
                                                                                                       // 747
    self._safeAppendToBuffer = newBuffer.size() < self._limit;                                         // 748
  },                                                                                                   // 749
                                                                                                       // 750
  // This stop function is invoked from the onStop of the ObserveMultiplexer, so                       // 751
  // it shouldn't actually be possible to call it until the multiplexer is                             // 752
  // ready.                                                                                            // 753
  stop: function () {                                                                                  // 754
    var self = this;                                                                                   // 755
    if (self._stopped)                                                                                 // 756
      return;                                                                                          // 757
    self._stopped = true;                                                                              // 758
    _.each(self._stopHandles, function (handle) {                                                      // 759
      handle.stop();                                                                                   // 760
    });                                                                                                // 761
                                                                                                       // 762
    // Note: we *don't* use multiplexer.onFlush here because this stop                                 // 763
    // callback is actually invoked by the multiplexer itself when it has                              // 764
    // determined that there are no handles left. So nothing is actually going                         // 765
    // to get flushed (and it's probably not valid to call methods on the                              // 766
    // dying multiplexer).                                                                             // 767
    _.each(self._writesToCommitWhenWeReachSteady, function (w) {                                       // 768
      w.committed();                                                                                   // 769
    });                                                                                                // 770
    self._writesToCommitWhenWeReachSteady = null;                                                      // 771
                                                                                                       // 772
    // Proactively drop references to potentially big things.                                          // 773
    self._published = null;                                                                            // 774
    self._unpublishedBuffer = null;                                                                    // 775
    self._needToFetch = null;                                                                          // 776
    self._currentlyFetching = null;                                                                    // 777
    self._oplogEntryHandle = null;                                                                     // 778
    self._listenersHandle = null;                                                                      // 779
                                                                                                       // 780
    Package.facts && Package.facts.Facts.incrementServerFact(                                          // 781
      "mongo-livedata", "observe-drivers-oplog", -1);                                                  // 782
  },                                                                                                   // 783
                                                                                                       // 784
  _registerPhaseChange: function (phase) {                                                             // 785
    var self = this;                                                                                   // 786
    var now = new Date;                                                                                // 787
                                                                                                       // 788
    if (self._phase) {                                                                                 // 789
      var timeDiff = now - self._phaseStartTime;                                                       // 790
      Package.facts && Package.facts.Facts.incrementServerFact(                                        // 791
        "mongo-livedata", "time-spent-in-" + self._phase + "-phase", timeDiff);                        // 792
    }                                                                                                  // 793
                                                                                                       // 794
    self._phase = phase;                                                                               // 795
    self._phaseStartTime = now;                                                                        // 796
  }                                                                                                    // 797
});                                                                                                    // 798
                                                                                                       // 799
// Does our oplog tailing code support this cursor? For now, we are being very                         // 800
// conservative and allowing only simple queries with simple options.                                  // 801
// (This is a "static method".)                                                                        // 802
OplogObserveDriver.cursorSupported = function (cursorDescription, matcher) {                           // 803
  // First, check the options.                                                                         // 804
  var options = cursorDescription.options;                                                             // 805
                                                                                                       // 806
  // Did the user say no explicitly?                                                                   // 807
  if (options._disableOplog)                                                                           // 808
    return false;                                                                                      // 809
                                                                                                       // 810
  // skip is not supported: to support it we would need to keep track of all                           // 811
  // "skipped" documents or at least their ids.                                                        // 812
  // limit w/o a sort specifier is not supported: current implementation needs a                       // 813
  // deterministic way to order documents.                                                             // 814
  if (options.skip || (options.limit && !options.sort)) return false;                                  // 815
                                                                                                       // 816
  // If a fields projection option is given check if it is supported by                                // 817
  // minimongo (some operators are not supported).                                                     // 818
  if (options.fields) {                                                                                // 819
    try {                                                                                              // 820
      LocalCollection._checkSupportedProjection(options.fields);                                       // 821
    } catch (e) {                                                                                      // 822
      if (e.name === "MinimongoError")                                                                 // 823
        return false;                                                                                  // 824
      else                                                                                             // 825
        throw e;                                                                                       // 826
    }                                                                                                  // 827
  }                                                                                                    // 828
                                                                                                       // 829
  // We don't allow the following selectors:                                                           // 830
  //   - $where (not confident that we provide the same JS environment                                 // 831
  //             as Mongo, and can yield!)                                                             // 832
  //   - $near (has "interesting" properties in MongoDB, like the possibility                          // 833
  //            of returning an ID multiple times, though even polling maybe                           // 834
  //            have a bug there)                                                                      // 835
  //           XXX: once we support it, we would need to think more on how we                          // 836
  //           initialize the comparators when we create the driver.                                   // 837
  return !matcher.hasWhere() && !matcher.hasGeoQuery();                                                // 838
};                                                                                                     // 839
                                                                                                       // 840
var modifierCanBeDirectlyApplied = function (modifier) {                                               // 841
  return _.all(modifier, function (fields, operation) {                                                // 842
    return _.all(fields, function (value, field) {                                                     // 843
      return !/EJSON\$/.test(field);                                                                   // 844
    });                                                                                                // 845
  });                                                                                                  // 846
};                                                                                                     // 847
                                                                                                       // 848
MongoTest.OplogObserveDriver = OplogObserveDriver;                                                     // 849
                                                                                                       // 850
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/local_collection_driver.js                                                  //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
LocalCollectionDriver = function () {                                                                  // 1
  var self = this;                                                                                     // 2
  self.noConnCollections = {};                                                                         // 3
};                                                                                                     // 4
                                                                                                       // 5
var ensureCollection = function (name, collections) {                                                  // 6
  if (!(name in collections))                                                                          // 7
    collections[name] = new LocalCollection(name);                                                     // 8
  return collections[name];                                                                            // 9
};                                                                                                     // 10
                                                                                                       // 11
_.extend(LocalCollectionDriver.prototype, {                                                            // 12
  open: function (name, conn) {                                                                        // 13
    var self = this;                                                                                   // 14
    if (!name)                                                                                         // 15
      return new LocalCollection;                                                                      // 16
    if (! conn) {                                                                                      // 17
      return ensureCollection(name, self.noConnCollections);                                           // 18
    }                                                                                                  // 19
    if (! conn._mongo_livedata_collections)                                                            // 20
      conn._mongo_livedata_collections = {};                                                           // 21
    // XXX is there a way to keep track of a connection's collections without                          // 22
    // dangling it off the connection object?                                                          // 23
    return ensureCollection(name, conn._mongo_livedata_collections);                                   // 24
  }                                                                                                    // 25
});                                                                                                    // 26
                                                                                                       // 27
// singleton                                                                                           // 28
LocalCollectionDriver = new LocalCollectionDriver;                                                     // 29
                                                                                                       // 30
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/remote_collection_driver.js                                                 //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
MongoInternals.RemoteCollectionDriver = function (                                                     // 1
  mongo_url, options) {                                                                                // 2
  var self = this;                                                                                     // 3
  self.mongo = new MongoConnection(mongo_url, options);                                                // 4
};                                                                                                     // 5
                                                                                                       // 6
_.extend(MongoInternals.RemoteCollectionDriver.prototype, {                                            // 7
  open: function (name) {                                                                              // 8
    var self = this;                                                                                   // 9
    var ret = {};                                                                                      // 10
    _.each(                                                                                            // 11
      ['find', 'findOne', 'insert', 'update', , 'upsert',                                              // 12
       'remove', '_ensureIndex', '_dropIndex', '_createCappedCollection',                              // 13
       'dropCollection'],                                                                              // 14
      function (m) {                                                                                   // 15
        ret[m] = _.bind(self.mongo[m], self.mongo, name);                                              // 16
      });                                                                                              // 17
    return ret;                                                                                        // 18
  }                                                                                                    // 19
});                                                                                                    // 20
                                                                                                       // 21
                                                                                                       // 22
// Create the singleton RemoteCollectionDriver only on demand, so we                                   // 23
// only require Mongo configuration if it's actually used (eg, not if                                  // 24
// you're only trying to receive data from a remote DDP server.)                                       // 25
MongoInternals.defaultRemoteCollectionDriver = _.once(function () {                                    // 26
  var mongoUrl;                                                                                        // 27
  var connectionOptions = {};                                                                          // 28
                                                                                                       // 29
  AppConfig.configurePackage("mongo-livedata", function (config) {                                     // 30
    // This will keep running if mongo gets reconfigured.  That's not ideal, but                       // 31
    // should be ok for now.                                                                           // 32
    mongoUrl = config.url;                                                                             // 33
                                                                                                       // 34
    if (config.oplog)                                                                                  // 35
      connectionOptions.oplogUrl = config.oplog;                                                       // 36
  });                                                                                                  // 37
                                                                                                       // 38
  // XXX bad error since it could also be set directly in METEOR_DEPLOY_CONFIG                         // 39
  if (! mongoUrl)                                                                                      // 40
    throw new Error("MONGO_URL must be set in environment");                                           // 41
                                                                                                       // 42
                                                                                                       // 43
  return new MongoInternals.RemoteCollectionDriver(mongoUrl, connectionOptions);                       // 44
});                                                                                                    // 45
                                                                                                       // 46
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

/////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                     //
// packages/mongo-livedata/collection.js                                                               //
//                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                       //
// options.connection, if given, is a LivedataClient or LivedataServer                                 // 1
// XXX presently there is no way to destroy/clean up a Collection                                      // 2
                                                                                                       // 3
Meteor.Collection = function (name, options) {                                                         // 4
  var self = this;                                                                                     // 5
  if (! (self instanceof Meteor.Collection))                                                           // 6
    throw new Error('use "new" to construct a Meteor.Collection');                                     // 7
                                                                                                       // 8
  if (!name && (name !== null)) {                                                                      // 9
    Meteor._debug("Warning: creating anonymous collection. It will not be " +                          // 10
                  "saved or synchronized over the network. (Pass null for " +                          // 11
                  "the collection name to turn off this warning.)");                                   // 12
    name = null;                                                                                       // 13
  }                                                                                                    // 14
                                                                                                       // 15
  if (name !== null && typeof name !== "string") {                                                     // 16
    throw new Error(                                                                                   // 17
      "First argument to new Meteor.Collection must be a string or null");                             // 18
  }                                                                                                    // 19
                                                                                                       // 20
  if (options && options.methods) {                                                                    // 21
    // Backwards compatibility hack with original signature (which passed                              // 22
    // "connection" directly instead of in options. (Connections must have a "methods"                 // 23
    // method.)                                                                                        // 24
    // XXX remove before 1.0                                                                           // 25
    options = {connection: options};                                                                   // 26
  }                                                                                                    // 27
  // Backwards compatibility: "connection" used to be called "manager".                                // 28
  if (options && options.manager && !options.connection) {                                             // 29
    options.connection = options.manager;                                                              // 30
  }                                                                                                    // 31
  options = _.extend({                                                                                 // 32
    connection: undefined,                                                                             // 33
    idGeneration: 'STRING',                                                                            // 34
    transform: null,                                                                                   // 35
    _driver: undefined,                                                                                // 36
    _preventAutopublish: false                                                                         // 37
  }, options);                                                                                         // 38
                                                                                                       // 39
  switch (options.idGeneration) {                                                                      // 40
  case 'MONGO':                                                                                        // 41
    self._makeNewID = function () {                                                                    // 42
      return new Meteor.Collection.ObjectID();                                                         // 43
    };                                                                                                 // 44
    break;                                                                                             // 45
  case 'STRING':                                                                                       // 46
  default:                                                                                             // 47
    self._makeNewID = function () {                                                                    // 48
      return Random.id();                                                                              // 49
    };                                                                                                 // 50
    break;                                                                                             // 51
  }                                                                                                    // 52
                                                                                                       // 53
  self._transform = LocalCollection.wrapTransform(options.transform);                                  // 54
                                                                                                       // 55
  if (! name || options.connection === null)                                                           // 56
    // note: nameless collections never have a connection                                              // 57
    self._connection = null;                                                                           // 58
  else if (options.connection)                                                                         // 59
    self._connection = options.connection;                                                             // 60
  else if (Meteor.isClient)                                                                            // 61
    self._connection = Meteor.connection;                                                              // 62
  else                                                                                                 // 63
    self._connection = Meteor.server;                                                                  // 64
                                                                                                       // 65
  if (!options._driver) {                                                                              // 66
    if (name && self._connection === Meteor.server &&                                                  // 67
        typeof MongoInternals !== "undefined" &&                                                       // 68
        MongoInternals.defaultRemoteCollectionDriver) {                                                // 69
      options._driver = MongoInternals.defaultRemoteCollectionDriver();                                // 70
    } else {                                                                                           // 71
      options._driver = LocalCollectionDriver;                                                         // 72
    }                                                                                                  // 73
  }                                                                                                    // 74
                                                                                                       // 75
  self._collection = options._driver.open(name, self._connection);                                     // 76
  self._name = name;                                                                                   // 77
                                                                                                       // 78
  if (self._connection && self._connection.registerStore) {                                            // 79
    // OK, we're going to be a slave, replicating some remote                                          // 80
    // database, except possibly with some temporary divergence while                                  // 81
    // we have unacknowledged RPC's.                                                                   // 82
    var ok = self._connection.registerStore(name, {                                                    // 83
      // Called at the beginning of a batch of updates. batchSize is the number                        // 84
      // of update calls to expect.                                                                    // 85
      //                                                                                               // 86
      // XXX This interface is pretty janky. reset probably ought to go back to                        // 87
      // being its own function, and callers shouldn't have to calculate                               // 88
      // batchSize. The optimization of not calling pause/remove should be                             // 89
      // delayed until later: the first call to update() should buffer its                             // 90
      // message, and then we can either directly apply it at endUpdate time if                        // 91
      // it was the only update, or do pauseObservers/apply/apply at the next                          // 92
      // update() if there's another one.                                                              // 93
      beginUpdate: function (batchSize, reset) {                                                       // 94
        // pause observers so users don't see flicker when updating several                            // 95
        // objects at once (including the post-reconnect reset-and-reapply                             // 96
        // stage), and so that a re-sorting of a query can take advantage of the                       // 97
        // full _diffQuery moved calculation instead of applying change one at a                       // 98
        // time.                                                                                       // 99
        if (batchSize > 1 || reset)                                                                    // 100
          self._collection.pauseObservers();                                                           // 101
                                                                                                       // 102
        if (reset)                                                                                     // 103
          self._collection.remove({});                                                                 // 104
      },                                                                                               // 105
                                                                                                       // 106
      // Apply an update.                                                                              // 107
      // XXX better specify this interface (not in terms of a wire message)?                           // 108
      update: function (msg) {                                                                         // 109
        var mongoId = LocalCollection._idParse(msg.id);                                                // 110
        var doc = self._collection.findOne(mongoId);                                                   // 111
                                                                                                       // 112
        // Is this a "replace the whole doc" message coming from the quiescence                        // 113
        // of method writes to an object? (Note that 'undefined' is a valid                            // 114
        // value meaning "remove it".)                                                                 // 115
        if (msg.msg === 'replace') {                                                                   // 116
          var replace = msg.replace;                                                                   // 117
          if (!replace) {                                                                              // 118
            if (doc)                                                                                   // 119
              self._collection.remove(mongoId);                                                        // 120
          } else if (!doc) {                                                                           // 121
            self._collection.insert(replace);                                                          // 122
          } else {                                                                                     // 123
            // XXX check that replace has no $ ops                                                     // 124
            self._collection.update(mongoId, replace);                                                 // 125
          }                                                                                            // 126
          return;                                                                                      // 127
        } else if (msg.msg === 'added') {                                                              // 128
          if (doc) {                                                                                   // 129
            throw new Error("Expected not to find a document already present for an add");             // 130
          }                                                                                            // 131
          self._collection.insert(_.extend({_id: mongoId}, msg.fields));                               // 132
        } else if (msg.msg === 'removed') {                                                            // 133
          if (!doc)                                                                                    // 134
            throw new Error("Expected to find a document already present for removed");                // 135
          self._collection.remove(mongoId);                                                            // 136
        } else if (msg.msg === 'changed') {                                                            // 137
          if (!doc)                                                                                    // 138
            throw new Error("Expected to find a document to change");                                  // 139
          if (!_.isEmpty(msg.fields)) {                                                                // 140
            var modifier = {};                                                                         // 141
            _.each(msg.fields, function (value, key) {                                                 // 142
              if (value === undefined) {                                                               // 143
                if (!modifier.$unset)                                                                  // 144
                  modifier.$unset = {};                                                                // 145
                modifier.$unset[key] = 1;                                                              // 146
              } else {                                                                                 // 147
                if (!modifier.$set)                                                                    // 148
                  modifier.$set = {};                                                                  // 149
                modifier.$set[key] = value;                                                            // 150
              }                                                                                        // 151
            });                                                                                        // 152
            self._collection.update(mongoId, modifier);                                                // 153
          }                                                                                            // 154
        } else {                                                                                       // 155
          throw new Error("I don't know how to deal with this message");                               // 156
        }                                                                                              // 157
                                                                                                       // 158
      },                                                                                               // 159
                                                                                                       // 160
      // Called at the end of a batch of updates.                                                      // 161
      endUpdate: function () {                                                                         // 162
        self._collection.resumeObservers();                                                            // 163
      },                                                                                               // 164
                                                                                                       // 165
      // Called around method stub invocations to capture the original versions                        // 166
      // of modified documents.                                                                        // 167
      saveOriginals: function () {                                                                     // 168
        self._collection.saveOriginals();                                                              // 169
      },                                                                                               // 170
      retrieveOriginals: function () {                                                                 // 171
        return self._collection.retrieveOriginals();                                                   // 172
      }                                                                                                // 173
    });                                                                                                // 174
                                                                                                       // 175
    if (!ok)                                                                                           // 176
      throw new Error("There is already a collection named '" + name + "'");                           // 177
  }                                                                                                    // 178
                                                                                                       // 179
  self._defineMutationMethods();                                                                       // 180
                                                                                                       // 181
  // autopublish                                                                                       // 182
  if (Package.autopublish && !options._preventAutopublish && self._connection                          // 183
      && self._connection.publish) {                                                                   // 184
    self._connection.publish(null, function () {                                                       // 185
      return self.find();                                                                              // 186
    }, {is_auto: true});                                                                               // 187
  }                                                                                                    // 188
};                                                                                                     // 189
                                                                                                       // 190
///                                                                                                    // 191
/// Main collection API                                                                                // 192
///                                                                                                    // 193
                                                                                                       // 194
                                                                                                       // 195
_.extend(Meteor.Collection.prototype, {                                                                // 196
                                                                                                       // 197
  _getFindSelector: function (args) {                                                                  // 198
    if (args.length == 0)                                                                              // 199
      return {};                                                                                       // 200
    else                                                                                               // 201
      return args[0];                                                                                  // 202
  },                                                                                                   // 203
                                                                                                       // 204
  _getFindOptions: function (args) {                                                                   // 205
    var self = this;                                                                                   // 206
    if (args.length < 2) {                                                                             // 207
      return { transform: self._transform };                                                           // 208
    } else {                                                                                           // 209
      return _.extend({                                                                                // 210
        transform: self._transform                                                                     // 211
      }, args[1]);                                                                                     // 212
    }                                                                                                  // 213
  },                                                                                                   // 214
                                                                                                       // 215
  find: function (/* selector, options */) {                                                           // 216
    // Collection.find() (return all docs) behaves differently                                         // 217
    // from Collection.find(undefined) (return 0 docs).  so be                                         // 218
    // careful about the length of arguments.                                                          // 219
    var self = this;                                                                                   // 220
    var argArray = _.toArray(arguments);                                                               // 221
    return self._collection.find(self._getFindSelector(argArray),                                      // 222
                                 self._getFindOptions(argArray));                                      // 223
  },                                                                                                   // 224
                                                                                                       // 225
  findOne: function (/* selector, options */) {                                                        // 226
    var self = this;                                                                                   // 227
    var argArray = _.toArray(arguments);                                                               // 228
    return self._collection.findOne(self._getFindSelector(argArray),                                   // 229
                                    self._getFindOptions(argArray));                                   // 230
  }                                                                                                    // 231
                                                                                                       // 232
});                                                                                                    // 233
                                                                                                       // 234
Meteor.Collection._publishCursor = function (cursor, sub, collection) {                                // 235
  var observeHandle = cursor.observeChanges({                                                          // 236
    added: function (id, fields) {                                                                     // 237
      sub.added(collection, id, fields);                                                               // 238
    },                                                                                                 // 239
    changed: function (id, fields) {                                                                   // 240
      sub.changed(collection, id, fields);                                                             // 241
    },                                                                                                 // 242
    removed: function (id) {                                                                           // 243
      sub.removed(collection, id);                                                                     // 244
    }                                                                                                  // 245
  });                                                                                                  // 246
                                                                                                       // 247
  // We don't call sub.ready() here: it gets called in livedata_server, after                          // 248
  // possibly calling _publishCursor on multiple returned cursors.                                     // 249
                                                                                                       // 250
  // register stop callback (expects lambda w/ no args).                                               // 251
  sub.onStop(function () {observeHandle.stop();});                                                     // 252
};                                                                                                     // 253
                                                                                                       // 254
// protect against dangerous selectors.  falsey and {_id: falsey} are both                             // 255
// likely programmer error, and not what you want, particularly for destructive                        // 256
// operations.  JS regexps don't serialize over DDP but can be trivially                               // 257
// replaced by $regex.                                                                                 // 258
Meteor.Collection._rewriteSelector = function (selector) {                                             // 259
  // shorthand -- scalars match _id                                                                    // 260
  if (LocalCollection._selectorIsId(selector))                                                         // 261
    selector = {_id: selector};                                                                        // 262
                                                                                                       // 263
  if (!selector || (('_id' in selector) && !selector._id))                                             // 264
    // can't match anything                                                                            // 265
    return {_id: Random.id()};                                                                         // 266
                                                                                                       // 267
  var ret = {};                                                                                        // 268
  _.each(selector, function (value, key) {                                                             // 269
    // Mongo supports both {field: /foo/} and {field: {$regex: /foo/}}                                 // 270
    if (value instanceof RegExp) {                                                                     // 271
      ret[key] = convertRegexpToMongoSelector(value);                                                  // 272
    } else if (value && value.$regex instanceof RegExp) {                                              // 273
      ret[key] = convertRegexpToMongoSelector(value.$regex);                                           // 274
      // if value is {$regex: /foo/, $options: ...} then $options                                      // 275
      // override the ones set on $regex.                                                              // 276
      if (value.$options !== undefined)                                                                // 277
        ret[key].$options = value.$options;                                                            // 278
    }                                                                                                  // 279
    else if (_.contains(['$or','$and','$nor'], key)) {                                                 // 280
      // Translate lower levels of $and/$or/$nor                                                       // 281
      ret[key] = _.map(value, function (v) {                                                           // 282
        return Meteor.Collection._rewriteSelector(v);                                                  // 283
      });                                                                                              // 284
    } else {                                                                                           // 285
      ret[key] = value;                                                                                // 286
    }                                                                                                  // 287
  });                                                                                                  // 288
  return ret;                                                                                          // 289
};                                                                                                     // 290
                                                                                                       // 291
// convert a JS RegExp object to a Mongo {$regex: ..., $options: ...}                                  // 292
// selector                                                                                            // 293
var convertRegexpToMongoSelector = function (regexp) {                                                 // 294
  check(regexp, RegExp); // safety belt                                                                // 295
                                                                                                       // 296
  var selector = {$regex: regexp.source};                                                              // 297
  var regexOptions = '';                                                                               // 298
  // JS RegExp objects support 'i', 'm', and 'g'. Mongo regex $options                                 // 299
  // support 'i', 'm', 'x', and 's'. So we support 'i' and 'm' here.                                   // 300
  if (regexp.ignoreCase)                                                                               // 301
    regexOptions += 'i';                                                                               // 302
  if (regexp.multiline)                                                                                // 303
    regexOptions += 'm';                                                                               // 304
  if (regexOptions)                                                                                    // 305
    selector.$options = regexOptions;                                                                  // 306
                                                                                                       // 307
  return selector;                                                                                     // 308
};                                                                                                     // 309
                                                                                                       // 310
var throwIfSelectorIsNotId = function (selector, methodName) {                                         // 311
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) {                                       // 312
    throw new Meteor.Error(                                                                            // 313
      403, "Not permitted. Untrusted code may only " + methodName +                                    // 314
        " documents by ID.");                                                                          // 315
  }                                                                                                    // 316
};                                                                                                     // 317
                                                                                                       // 318
// 'insert' immediately returns the inserted document's new _id.                                       // 319
// The others return values immediately if you are in a stub, an in-memory                             // 320
// unmanaged collection, or a mongo-backed collection and you don't pass a                             // 321
// callback. 'update' and 'remove' return the number of affected                                       // 322
// documents. 'upsert' returns an object with keys 'numberAffected' and, if an                         // 323
// insert happened, 'insertedId'.                                                                      // 324
//                                                                                                     // 325
// Otherwise, the semantics are exactly like other methods: they take                                  // 326
// a callback as an optional last argument; if no callback is                                          // 327
// provided, they block until the operation is complete, and throw an                                  // 328
// exception if it fails; if a callback is provided, then they don't                                   // 329
// necessarily block, and they call the callback when they finish with error and                       // 330
// result arguments.  (The insert method provides the document ID as its result;                       // 331
// update and remove provide the number of affected docs as the result; upsert                         // 332
// provides an object with numberAffected and maybe insertedId.)                                       // 333
//                                                                                                     // 334
// On the client, blocking is impossible, so if a callback                                             // 335
// isn't provided, they just return immediately and any error                                          // 336
// information is lost.                                                                                // 337
//                                                                                                     // 338
// There's one more tweak. On the client, if you don't provide a                                       // 339
// callback, then if there is an error, a message will be logged with                                  // 340
// Meteor._debug.                                                                                      // 341
//                                                                                                     // 342
// The intent (though this is actually determined by the underlying                                    // 343
// drivers) is that the operations should be done synchronously, not                                   // 344
// generating their result until the database has acknowledged                                         // 345
// them. In the future maybe we should provide a flag to turn this                                     // 346
// off.                                                                                                // 347
_.each(["insert", "update", "remove"], function (name) {                                               // 348
  Meteor.Collection.prototype[name] = function (/* arguments */) {                                     // 349
    var self = this;                                                                                   // 350
    var args = _.toArray(arguments);                                                                   // 351
    var callback;                                                                                      // 352
    var insertId;                                                                                      // 353
    var ret;                                                                                           // 354
                                                                                                       // 355
    if (args.length && args[args.length - 1] instanceof Function)                                      // 356
      callback = args.pop();                                                                           // 357
                                                                                                       // 358
    if (name === "insert") {                                                                           // 359
      if (!args.length)                                                                                // 360
        throw new Error("insert requires an argument");                                                // 361
      // shallow-copy the document and generate an ID                                                  // 362
      args[0] = _.extend({}, args[0]);                                                                 // 363
      if ('_id' in args[0]) {                                                                          // 364
        insertId = args[0]._id;                                                                        // 365
        if (!insertId || !(typeof insertId === 'string'                                                // 366
              || insertId instanceof Meteor.Collection.ObjectID))                                      // 367
          throw new Error("Meteor requires document _id fields to be non-empty strings or ObjectIDs"); // 368
      } else {                                                                                         // 369
        insertId = args[0]._id = self._makeNewID();                                                    // 370
      }                                                                                                // 371
    } else {                                                                                           // 372
      args[0] = Meteor.Collection._rewriteSelector(args[0]);                                           // 373
                                                                                                       // 374
      if (name === "update") {                                                                         // 375
        // Mutate args but copy the original options object. We need to add                            // 376
        // insertedId to options, but don't want to mutate the caller's options                        // 377
        // object. We need to mutate `args` because we pass `args` into the                            // 378
        // driver below.                                                                               // 379
        var options = args[2] = _.clone(args[2]) || {};                                                // 380
        if (options && typeof options !== "function" && options.upsert) {                              // 381
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.                          // 382
          if (options.insertedId) {                                                                    // 383
            if (!(typeof options.insertedId === 'string'                                               // 384
                  || options.insertedId instanceof Meteor.Collection.ObjectID))                        // 385
              throw new Error("insertedId must be string or ObjectID");                                // 386
          } else {                                                                                     // 387
            options.insertedId = self._makeNewID();                                                    // 388
          }                                                                                            // 389
        }                                                                                              // 390
      }                                                                                                // 391
    }                                                                                                  // 392
                                                                                                       // 393
    // On inserts, always return the id that we generated; on all other                                // 394
    // operations, just return the result from the collection.                                         // 395
    var chooseReturnValueFromCollectionResult = function (result) {                                    // 396
      if (name === "insert")                                                                           // 397
        return insertId;                                                                               // 398
      else                                                                                             // 399
        return result;                                                                                 // 400
    };                                                                                                 // 401
                                                                                                       // 402
    var wrappedCallback;                                                                               // 403
    if (callback) {                                                                                    // 404
      wrappedCallback = function (error, result) {                                                     // 405
        callback(error, ! error && chooseReturnValueFromCollectionResult(result));                     // 406
      };                                                                                               // 407
    }                                                                                                  // 408
                                                                                                       // 409
    if (self._connection && self._connection !== Meteor.server) {                                      // 410
      // just remote to another endpoint, propagate return value or                                    // 411
      // exception.                                                                                    // 412
                                                                                                       // 413
      var enclosing = DDP._CurrentInvocation.get();                                                    // 414
      var alreadyInSimulation = enclosing && enclosing.isSimulation;                                   // 415
                                                                                                       // 416
      if (Meteor.isClient && !wrappedCallback && ! alreadyInSimulation) {                              // 417
        // Client can't block, so it can't report errors by exception,                                 // 418
        // only by callback. If they forget the callback, give them a                                  // 419
        // default one that logs the error, so they aren't totally                                     // 420
        // baffled if their writes don't work because their database is                                // 421
        // down.                                                                                       // 422
        // Don't give a default callback in simulation, because inside stubs we                        // 423
        // want to return the results from the local collection immediately and                        // 424
        // not force a callback.                                                                       // 425
        wrappedCallback = function (err) {                                                             // 426
          if (err)                                                                                     // 427
            Meteor._debug(name + " failed: " + (err.reason || err.stack));                             // 428
        };                                                                                             // 429
      }                                                                                                // 430
                                                                                                       // 431
      if (!alreadyInSimulation && name !== "insert") {                                                 // 432
        // If we're about to actually send an RPC, we should throw an error if                         // 433
        // this is a non-ID selector, because the mutation methods only allow                          // 434
        // single-ID selectors. (If we don't throw here, we'll see flicker.)                           // 435
        throwIfSelectorIsNotId(args[0], name);                                                         // 436
      }                                                                                                // 437
                                                                                                       // 438
      ret = chooseReturnValueFromCollectionResult(                                                     // 439
        self._connection.apply(self._prefix + name, args, wrappedCallback)                             // 440
      );                                                                                               // 441
                                                                                                       // 442
    } else {                                                                                           // 443
      // it's my collection.  descend into the collection object                                       // 444
      // and propagate any exception.                                                                  // 445
      args.push(wrappedCallback);                                                                      // 446
      try {                                                                                            // 447
        // If the user provided a callback and the collection implements this                          // 448
        // operation asynchronously, then queryRet will be undefined, and the                          // 449
        // result will be returned through the callback instead.                                       // 450
        var queryRet = self._collection[name].apply(self._collection, args);                           // 451
        ret = chooseReturnValueFromCollectionResult(queryRet);                                         // 452
      } catch (e) {                                                                                    // 453
        if (callback) {                                                                                // 454
          callback(e);                                                                                 // 455
          return null;                                                                                 // 456
        }                                                                                              // 457
        throw e;                                                                                       // 458
      }                                                                                                // 459
    }                                                                                                  // 460
                                                                                                       // 461
    // both sync and async, unless we threw an exception, return ret                                   // 462
    // (new document ID for insert, num affected for update/remove, object with                        // 463
    // numberAffected and maybe insertedId for upsert).                                                // 464
    return ret;                                                                                        // 465
  };                                                                                                   // 466
});                                                                                                    // 467
                                                                                                       // 468
Meteor.Collection.prototype.upsert = function (selector, modifier,                                     // 469
                                               options, callback) {                                    // 470
  var self = this;                                                                                     // 471
  if (! callback && typeof options === "function") {                                                   // 472
    callback = options;                                                                                // 473
    options = {};                                                                                      // 474
  }                                                                                                    // 475
  return self.update(selector, modifier,                                                               // 476
              _.extend({}, options, { _returnObject: true, upsert: true }),                            // 477
              callback);                                                                               // 478
};                                                                                                     // 479
                                                                                                       // 480
// We'll actually design an index API later. For now, we just pass through to                          // 481
// Mongo's, but make it synchronous.                                                                   // 482
Meteor.Collection.prototype._ensureIndex = function (index, options) {                                 // 483
  var self = this;                                                                                     // 484
  if (!self._collection._ensureIndex)                                                                  // 485
    throw new Error("Can only call _ensureIndex on server collections");                               // 486
  self._collection._ensureIndex(index, options);                                                       // 487
};                                                                                                     // 488
Meteor.Collection.prototype._dropIndex = function (index) {                                            // 489
  var self = this;                                                                                     // 490
  if (!self._collection._dropIndex)                                                                    // 491
    throw new Error("Can only call _dropIndex on server collections");                                 // 492
  self._collection._dropIndex(index);                                                                  // 493
};                                                                                                     // 494
Meteor.Collection.prototype._dropCollection = function () {                                            // 495
  var self = this;                                                                                     // 496
  if (!self._collection.dropCollection)                                                                // 497
    throw new Error("Can only call _dropCollection on server collections");                            // 498
  self._collection.dropCollection();                                                                   // 499
};                                                                                                     // 500
Meteor.Collection.prototype._createCappedCollection = function (byteSize) {                            // 501
  var self = this;                                                                                     // 502
  if (!self._collection._createCappedCollection)                                                       // 503
    throw new Error("Can only call _createCappedCollection on server collections");                    // 504
  self._collection._createCappedCollection(byteSize);                                                  // 505
};                                                                                                     // 506
                                                                                                       // 507
Meteor.Collection.ObjectID = LocalCollection._ObjectID;                                                // 508
                                                                                                       // 509
///                                                                                                    // 510
/// Remote methods and access control.                                                                 // 511
///                                                                                                    // 512
                                                                                                       // 513
// Restrict default mutators on collection. allow() and deny() take the                                // 514
// same options:                                                                                       // 515
//                                                                                                     // 516
// options.insert {Function(userId, doc)}                                                              // 517
//   return true to allow/deny adding this document                                                    // 518
//                                                                                                     // 519
// options.update {Function(userId, docs, fields, modifier)}                                           // 520
//   return true to allow/deny updating these documents.                                               // 521
//   `fields` is passed as an array of fields that are to be modified                                  // 522
//                                                                                                     // 523
// options.remove {Function(userId, docs)}                                                             // 524
//   return true to allow/deny removing these documents                                                // 525
//                                                                                                     // 526
// options.fetch {Array}                                                                               // 527
//   Fields to fetch for these validators. If any call to allow or deny                                // 528
//   does not have this option then all fields are loaded.                                             // 529
//                                                                                                     // 530
// allow and deny can be called multiple times. The validators are                                     // 531
// evaluated as follows:                                                                               // 532
// - If neither deny() nor allow() has been called on the collection,                                  // 533
//   then the request is allowed if and only if the "insecure" smart                                   // 534
//   package is in use.                                                                                // 535
// - Otherwise, if any deny() function returns true, the request is denied.                            // 536
// - Otherwise, if any allow() function returns true, the request is allowed.                          // 537
// - Otherwise, the request is denied.                                                                 // 538
//                                                                                                     // 539
// Meteor may call your deny() and allow() functions in any order, and may not                         // 540
// call all of them if it is able to make a decision without calling them all                          // 541
// (so don't include side effects).                                                                    // 542
                                                                                                       // 543
(function () {                                                                                         // 544
  var addValidator = function(allowOrDeny, options) {                                                  // 545
    // validate keys                                                                                   // 546
    var VALID_KEYS = ['insert', 'update', 'remove', 'fetch', 'transform'];                             // 547
    _.each(_.keys(options), function (key) {                                                           // 548
      if (!_.contains(VALID_KEYS, key))                                                                // 549
        throw new Error(allowOrDeny + ": Invalid key: " + key);                                        // 550
    });                                                                                                // 551
                                                                                                       // 552
    var self = this;                                                                                   // 553
    self._restricted = true;                                                                           // 554
                                                                                                       // 555
    _.each(['insert', 'update', 'remove'], function (name) {                                           // 556
      if (options[name]) {                                                                             // 557
        if (!(options[name] instanceof Function)) {                                                    // 558
          throw new Error(allowOrDeny + ": Value for `" + name + "` must be a function");              // 559
        }                                                                                              // 560
                                                                                                       // 561
        // If the transform is specified at all (including as 'null') in this                          // 562
        // call, then take that; otherwise, take the transform from the                                // 563
        // collection.                                                                                 // 564
        if (options.transform === undefined) {                                                         // 565
          options[name].transform = self._transform;  // already wrapped                               // 566
        } else {                                                                                       // 567
          options[name].transform = LocalCollection.wrapTransform(                                     // 568
            options.transform);                                                                        // 569
        }                                                                                              // 570
                                                                                                       // 571
        self._validators[name][allowOrDeny].push(options[name]);                                       // 572
      }                                                                                                // 573
    });                                                                                                // 574
                                                                                                       // 575
    // Only update the fetch fields if we're passed things that affect                                 // 576
    // fetching. This way allow({}) and allow({insert: f}) don't result in                             // 577
    // setting fetchAllFields                                                                          // 578
    if (options.update || options.remove || options.fetch) {                                           // 579
      if (options.fetch && !(options.fetch instanceof Array)) {                                        // 580
        throw new Error(allowOrDeny + ": Value for `fetch` must be an array");                         // 581
      }                                                                                                // 582
      self._updateFetch(options.fetch);                                                                // 583
    }                                                                                                  // 584
  };                                                                                                   // 585
                                                                                                       // 586
  Meteor.Collection.prototype.allow = function(options) {                                              // 587
    addValidator.call(this, 'allow', options);                                                         // 588
  };                                                                                                   // 589
  Meteor.Collection.prototype.deny = function(options) {                                               // 590
    addValidator.call(this, 'deny', options);                                                          // 591
  };                                                                                                   // 592
})();                                                                                                  // 593
                                                                                                       // 594
                                                                                                       // 595
Meteor.Collection.prototype._defineMutationMethods = function() {                                      // 596
  var self = this;                                                                                     // 597
                                                                                                       // 598
  // set to true once we call any allow or deny methods. If true, use                                  // 599
  // allow/deny semantics. If false, use insecure mode semantics.                                      // 600
  self._restricted = false;                                                                            // 601
                                                                                                       // 602
  // Insecure mode (default to allowing writes). Defaults to 'undefined' which                         // 603
  // means insecure iff the insecure package is loaded. This property can be                           // 604
  // overriden by tests or packages wishing to change insecure mode behavior of                        // 605
  // their collections.                                                                                // 606
  self._insecure = undefined;                                                                          // 607
                                                                                                       // 608
  self._validators = {                                                                                 // 609
    insert: {allow: [], deny: []},                                                                     // 610
    update: {allow: [], deny: []},                                                                     // 611
    remove: {allow: [], deny: []},                                                                     // 612
    upsert: {allow: [], deny: []}, // dummy arrays; can't set these!                                   // 613
    fetch: [],                                                                                         // 614
    fetchAllFields: false                                                                              // 615
  };                                                                                                   // 616
                                                                                                       // 617
  if (!self._name)                                                                                     // 618
    return; // anonymous collection                                                                    // 619
                                                                                                       // 620
  // XXX Think about method namespacing. Maybe methods should be                                       // 621
  // "Meteor:Mongo:insert/NAME"?                                                                       // 622
  self._prefix = '/' + self._name + '/';                                                               // 623
                                                                                                       // 624
  // mutation methods                                                                                  // 625
  if (self._connection) {                                                                              // 626
    var m = {};                                                                                        // 627
                                                                                                       // 628
    _.each(['insert', 'update', 'remove'], function (method) {                                         // 629
      m[self._prefix + method] = function (/* ... */) {                                                // 630
        // All the methods do their own validation, instead of using check().                          // 631
        check(arguments, [Match.Any]);                                                                 // 632
        try {                                                                                          // 633
          if (this.isSimulation) {                                                                     // 634
                                                                                                       // 635
            // In a client simulation, you can do any mutation (even with a                            // 636
            // complex selector).                                                                      // 637
            return self._collection[method].apply(                                                     // 638
              self._collection, _.toArray(arguments));                                                 // 639
          }                                                                                            // 640
                                                                                                       // 641
          // This is the server receiving a method call from the client.                               // 642
                                                                                                       // 643
          // We don't allow arbitrary selectors in mutations from the client: only                     // 644
          // single-ID selectors.                                                                      // 645
          if (method !== 'insert')                                                                     // 646
            throwIfSelectorIsNotId(arguments[0], method);                                              // 647
                                                                                                       // 648
          if (self._restricted) {                                                                      // 649
            // short circuit if there is no way it will pass.                                          // 650
            if (self._validators[method].allow.length === 0) {                                         // 651
              throw new Meteor.Error(                                                                  // 652
                403, "Access denied. No allow validators set on restricted " +                         // 653
                  "collection for method '" + method + "'.");                                          // 654
            }                                                                                          // 655
                                                                                                       // 656
            var validatedMethodName =                                                                  // 657
                  '_validated' + method.charAt(0).toUpperCase() + method.slice(1);                     // 658
            var argsWithUserId = [this.userId].concat(_.toArray(arguments));                           // 659
            return self[validatedMethodName].apply(self, argsWithUserId);                              // 660
          } else if (self._isInsecure()) {                                                             // 661
            // In insecure mode, allow any mutation (with a simple selector).                          // 662
            return self._collection[method].apply(self._collection,                                    // 663
                                                  _.toArray(arguments));                               // 664
          } else {                                                                                     // 665
            // In secure mode, if we haven't called allow or deny, then nothing                        // 666
            // is permitted.                                                                           // 667
            throw new Meteor.Error(403, "Access denied");                                              // 668
          }                                                                                            // 669
        } catch (e) {                                                                                  // 670
          if (e.name === 'MongoError' || e.name === 'MinimongoError') {                                // 671
            throw new Meteor.Error(409, e.toString());                                                 // 672
          } else {                                                                                     // 673
            throw e;                                                                                   // 674
          }                                                                                            // 675
        }                                                                                              // 676
      };                                                                                               // 677
    });                                                                                                // 678
    // Minimongo on the server gets no stubs; instead, by default                                      // 679
    // it wait()s until its result is ready, yielding.                                                 // 680
    // This matches the behavior of macromongo on the server better.                                   // 681
    if (Meteor.isClient || self._connection === Meteor.server)                                         // 682
      self._connection.methods(m);                                                                     // 683
  }                                                                                                    // 684
};                                                                                                     // 685
                                                                                                       // 686
                                                                                                       // 687
Meteor.Collection.prototype._updateFetch = function (fields) {                                         // 688
  var self = this;                                                                                     // 689
                                                                                                       // 690
  if (!self._validators.fetchAllFields) {                                                              // 691
    if (fields) {                                                                                      // 692
      self._validators.fetch = _.union(self._validators.fetch, fields);                                // 693
    } else {                                                                                           // 694
      self._validators.fetchAllFields = true;                                                          // 695
      // clear fetch just to make sure we don't accidentally read it                                   // 696
      self._validators.fetch = null;                                                                   // 697
    }                                                                                                  // 698
  }                                                                                                    // 699
};                                                                                                     // 700
                                                                                                       // 701
Meteor.Collection.prototype._isInsecure = function () {                                                // 702
  var self = this;                                                                                     // 703
  if (self._insecure === undefined)                                                                    // 704
    return !!Package.insecure;                                                                         // 705
  return self._insecure;                                                                               // 706
};                                                                                                     // 707
                                                                                                       // 708
var docToValidate = function (validator, doc) {                                                        // 709
  var ret = doc;                                                                                       // 710
  if (validator.transform)                                                                             // 711
    ret = validator.transform(EJSON.clone(doc));                                                       // 712
  return ret;                                                                                          // 713
};                                                                                                     // 714
                                                                                                       // 715
Meteor.Collection.prototype._validatedInsert = function(userId, doc) {                                 // 716
  var self = this;                                                                                     // 717
                                                                                                       // 718
  // call user validators.                                                                             // 719
  // Any deny returns true means denied.                                                               // 720
  if (_.any(self._validators.insert.deny, function(validator) {                                        // 721
    return validator(userId, docToValidate(validator, doc));                                           // 722
  })) {                                                                                                // 723
    throw new Meteor.Error(403, "Access denied");                                                      // 724
  }                                                                                                    // 725
  // Any allow returns true means proceed. Throw error if they all fail.                               // 726
  if (_.all(self._validators.insert.allow, function(validator) {                                       // 727
    return !validator(userId, docToValidate(validator, doc));                                          // 728
  })) {                                                                                                // 729
    throw new Meteor.Error(403, "Access denied");                                                      // 730
  }                                                                                                    // 731
                                                                                                       // 732
  self._collection.insert.call(self._collection, doc);                                                 // 733
};                                                                                                     // 734
                                                                                                       // 735
var transformDoc = function (validator, doc) {                                                         // 736
  if (validator.transform)                                                                             // 737
    return validator.transform(doc);                                                                   // 738
  return doc;                                                                                          // 739
};                                                                                                     // 740
                                                                                                       // 741
// Simulate a mongo `update` operation while validating that the access                                // 742
// control rules set by calls to `allow/deny` are satisfied. If all                                    // 743
// pass, rewrite the mongo operation to use $in to set the list of                                     // 744
// document ids to change ##ValidatedChange                                                            // 745
Meteor.Collection.prototype._validatedUpdate = function(                                               // 746
    userId, selector, mutator, options) {                                                              // 747
  var self = this;                                                                                     // 748
                                                                                                       // 749
  options = options || {};                                                                             // 750
                                                                                                       // 751
  if (!LocalCollection._selectorIsIdPerhapsAsObject(selector))                                         // 752
    throw new Error("validated update should be of a single ID");                                      // 753
                                                                                                       // 754
  // We don't support upserts because they don't fit nicely into allow/deny                            // 755
  // rules.                                                                                            // 756
  if (options.upsert)                                                                                  // 757
    throw new Meteor.Error(403, "Access denied. Upserts not " +                                        // 758
                           "allowed in a restricted collection.");                                     // 759
                                                                                                       // 760
  // compute modified fields                                                                           // 761
  var fields = [];                                                                                     // 762
  _.each(mutator, function (params, op) {                                                              // 763
    if (op.charAt(0) !== '$') {                                                                        // 764
      throw new Meteor.Error(                                                                          // 765
        403, "Access denied. In a restricted collection you can only update documents, not replace them. Use a Mongo update operator, such as '$set'.");
    } else if (!_.has(ALLOWED_UPDATE_OPERATIONS, op)) {                                                // 767
      throw new Meteor.Error(                                                                          // 768
        403, "Access denied. Operator " + op + " not allowed in a restricted collection.");            // 769
    } else {                                                                                           // 770
      _.each(_.keys(params), function (field) {                                                        // 771
        // treat dotted fields as if they are replacing their                                          // 772
        // top-level part                                                                              // 773
        if (field.indexOf('.') !== -1)                                                                 // 774
          field = field.substring(0, field.indexOf('.'));                                              // 775
                                                                                                       // 776
        // record the field we are trying to change                                                    // 777
        if (!_.contains(fields, field))                                                                // 778
          fields.push(field);                                                                          // 779
      });                                                                                              // 780
    }                                                                                                  // 781
  });                                                                                                  // 782
                                                                                                       // 783
  var findOptions = {transform: null};                                                                 // 784
  if (!self._validators.fetchAllFields) {                                                              // 785
    findOptions.fields = {};                                                                           // 786
    _.each(self._validators.fetch, function(fieldName) {                                               // 787
      findOptions.fields[fieldName] = 1;                                                               // 788
    });                                                                                                // 789
  }                                                                                                    // 790
                                                                                                       // 791
  var doc = self._collection.findOne(selector, findOptions);                                           // 792
  if (!doc)  // none satisfied!                                                                        // 793
    return 0;                                                                                          // 794
                                                                                                       // 795
  var factoriedDoc;                                                                                    // 796
                                                                                                       // 797
  // call user validators.                                                                             // 798
  // Any deny returns true means denied.                                                               // 799
  if (_.any(self._validators.update.deny, function(validator) {                                        // 800
    if (!factoriedDoc)                                                                                 // 801
      factoriedDoc = transformDoc(validator, doc);                                                     // 802
    return validator(userId,                                                                           // 803
                     factoriedDoc,                                                                     // 804
                     fields,                                                                           // 805
                     mutator);                                                                         // 806
  })) {                                                                                                // 807
    throw new Meteor.Error(403, "Access denied");                                                      // 808
  }                                                                                                    // 809
  // Any allow returns true means proceed. Throw error if they all fail.                               // 810
  if (_.all(self._validators.update.allow, function(validator) {                                       // 811
    if (!factoriedDoc)                                                                                 // 812
      factoriedDoc = transformDoc(validator, doc);                                                     // 813
    return !validator(userId,                                                                          // 814
                      factoriedDoc,                                                                    // 815
                      fields,                                                                          // 816
                      mutator);                                                                        // 817
  })) {                                                                                                // 818
    throw new Meteor.Error(403, "Access denied");                                                      // 819
  }                                                                                                    // 820
                                                                                                       // 821
  // Back when we supported arbitrary client-provided selectors, we actually                           // 822
  // rewrote the selector to include an _id clause before passing to Mongo to                          // 823
  // avoid races, but since selector is guaranteed to already just be an ID, we                        // 824
  // don't have to any more.                                                                           // 825
                                                                                                       // 826
  return self._collection.update.call(                                                                 // 827
    self._collection, selector, mutator, options);                                                     // 828
};                                                                                                     // 829
                                                                                                       // 830
// Only allow these operations in validated updates. Specifically                                      // 831
// whitelist operations, rather than blacklist, so new complex                                         // 832
// operations that are added aren't automatically allowed. A complex                                   // 833
// operation is one that does more than just modify its target                                         // 834
// field. For now this contains all update operations except '$rename'.                                // 835
// http://docs.mongodb.org/manual/reference/operators/#update                                          // 836
var ALLOWED_UPDATE_OPERATIONS = {                                                                      // 837
  $inc:1, $set:1, $unset:1, $addToSet:1, $pop:1, $pullAll:1, $pull:1,                                  // 838
  $pushAll:1, $push:1, $bit:1                                                                          // 839
};                                                                                                     // 840
                                                                                                       // 841
// Simulate a mongo `remove` operation while validating access control                                 // 842
// rules. See #ValidatedChange                                                                         // 843
Meteor.Collection.prototype._validatedRemove = function(userId, selector) {                            // 844
  var self = this;                                                                                     // 845
                                                                                                       // 846
  var findOptions = {transform: null};                                                                 // 847
  if (!self._validators.fetchAllFields) {                                                              // 848
    findOptions.fields = {};                                                                           // 849
    _.each(self._validators.fetch, function(fieldName) {                                               // 850
      findOptions.fields[fieldName] = 1;                                                               // 851
    });                                                                                                // 852
  }                                                                                                    // 853
                                                                                                       // 854
  var doc = self._collection.findOne(selector, findOptions);                                           // 855
  if (!doc)                                                                                            // 856
    return 0;                                                                                          // 857
                                                                                                       // 858
  // call user validators.                                                                             // 859
  // Any deny returns true means denied.                                                               // 860
  if (_.any(self._validators.remove.deny, function(validator) {                                        // 861
    return validator(userId, transformDoc(validator, doc));                                            // 862
  })) {                                                                                                // 863
    throw new Meteor.Error(403, "Access denied");                                                      // 864
  }                                                                                                    // 865
  // Any allow returns true means proceed. Throw error if they all fail.                               // 866
  if (_.all(self._validators.remove.allow, function(validator) {                                       // 867
    return !validator(userId, transformDoc(validator, doc));                                           // 868
  })) {                                                                                                // 869
    throw new Meteor.Error(403, "Access denied");                                                      // 870
  }                                                                                                    // 871
                                                                                                       // 872
  // Back when we supported arbitrary client-provided selectors, we actually                           // 873
  // rewrote the selector to {_id: {$in: [ids that we found]}} before passing to                       // 874
  // Mongo to avoid races, but since selector is guaranteed to already just be                         // 875
  // an ID, we don't have to any more.                                                                 // 876
                                                                                                       // 877
  return self._collection.remove.call(self._collection, selector);                                     // 878
};                                                                                                     // 879
                                                                                                       // 880
/////////////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['mongo-livedata'] = {
  MongoInternals: MongoInternals,
  MongoTest: MongoTest
};

})();
