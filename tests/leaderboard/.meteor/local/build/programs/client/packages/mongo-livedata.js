//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
//                                                                      //
// If you are using Chrome, open the Developer Tools and click the gear //
// icon in its lower right corner. In the General Settings panel, turn  //
// on 'Enable source maps'.                                             //
//                                                                      //
// If you are using Firefox 23, go to `about:config` and set the        //
// `devtools.debugger.source-maps-enabled` preference to true.          //
// (The preference should be on by default in Firefox 24; versions      //
// older than 23 do not support source maps.)                           //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var JSON = Package.json.JSON;
var _ = Package.underscore._;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var Log = Package.logging.Log;
var DDP = Package.livedata.DDP;
var Deps = Package.deps.Deps;
var check = Package.check.check;
var Match = Package.check.Match;

/* Package-scope variables */
var LocalCollectionDriver;

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
Package['mongo-livedata'] = {};

})();

//# sourceMappingURL=cf17a2975aa7445f0db2377c2af07e5efc240958.map
