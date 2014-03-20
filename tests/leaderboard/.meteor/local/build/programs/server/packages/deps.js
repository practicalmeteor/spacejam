(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;

/* Package-scope variables */
var Deps;

(function () {

//////////////////////////////////////////////////////////////////////////////////
//                                                                              //
// packages/deps/deps.js                                                        //
//                                                                              //
//////////////////////////////////////////////////////////////////////////////////
                                                                                //
//////////////////////////////////////////////////                              // 1
// Package docs at http://docs.meteor.com/#deps //                              // 2
//////////////////////////////////////////////////                              // 3
                                                                                // 4
Deps = {};                                                                      // 5
                                                                                // 6
// http://docs.meteor.com/#deps_active                                          // 7
Deps.active = false;                                                            // 8
                                                                                // 9
// http://docs.meteor.com/#deps_currentcomputation                              // 10
Deps.currentComputation = null;                                                 // 11
                                                                                // 12
var setCurrentComputation = function (c) {                                      // 13
  Deps.currentComputation = c;                                                  // 14
  Deps.active = !! c;                                                           // 15
};                                                                              // 16
                                                                                // 17
var _debugFunc = function () {                                                  // 18
  // lazy evaluation because `Meteor` does not exist right away                 // 19
  return (typeof Meteor !== "undefined" ? Meteor._debug :                       // 20
          ((typeof console !== "undefined") && console.log ? console.log :      // 21
           function () {}));                                                    // 22
};                                                                              // 23
                                                                                // 24
var _throwOrLog = function (from, e) {                                          // 25
  if (throwFirstError) {                                                        // 26
    throw e;                                                                    // 27
  } else {                                                                      // 28
    _debugFunc()("Exception from Deps " + from + " function:",                  // 29
                 e.stack || e.message);                                         // 30
  }                                                                             // 31
};                                                                              // 32
                                                                                // 33
var nextId = 1;                                                                 // 34
// computations whose callbacks we should call at flush time                    // 35
var pendingComputations = [];                                                   // 36
// `true` if a Deps.flush is scheduled, or if we are in Deps.flush now          // 37
var willFlush = false;                                                          // 38
// `true` if we are in Deps.flush now                                           // 39
var inFlush = false;                                                            // 40
// `true` if we are computing a computation now, either first time              // 41
// or recompute.  This matches Deps.active unless we are inside                 // 42
// Deps.nonreactive, which nullfies currentComputation even though              // 43
// an enclosing computation may still be running.                               // 44
var inCompute = false;                                                          // 45
// `true` if the `_throwFirstError` option was passed in to the call            // 46
// to Deps.flush that we are in. When set, throw rather than log the            // 47
// first error encountered while flushing. Before throwing the error,           // 48
// finish flushing (from a catch block), logging any subsequent                 // 49
// errors.                                                                      // 50
var throwFirstError = false;                                                    // 51
                                                                                // 52
var afterFlushCallbacks = [];                                                   // 53
                                                                                // 54
var requireFlush = function () {                                                // 55
  if (! willFlush) {                                                            // 56
    setTimeout(Deps.flush, 0);                                                  // 57
    willFlush = true;                                                           // 58
  }                                                                             // 59
};                                                                              // 60
                                                                                // 61
// Deps.Computation constructor is visible but private                          // 62
// (throws an error if you try to call it)                                      // 63
var constructingComputation = false;                                            // 64
                                                                                // 65
//                                                                              // 66
// http://docs.meteor.com/#deps_computation                                     // 67
//                                                                              // 68
Deps.Computation = function (f, parent) {                                       // 69
  if (! constructingComputation)                                                // 70
    throw new Error(                                                            // 71
      "Deps.Computation constructor is private; use Deps.autorun");             // 72
  constructingComputation = false;                                              // 73
                                                                                // 74
  var self = this;                                                              // 75
                                                                                // 76
  // http://docs.meteor.com/#computation_stopped                                // 77
  self.stopped = false;                                                         // 78
                                                                                // 79
  // http://docs.meteor.com/#computation_invalidated                            // 80
  self.invalidated = false;                                                     // 81
                                                                                // 82
  // http://docs.meteor.com/#computation_firstrun                               // 83
  self.firstRun = true;                                                         // 84
                                                                                // 85
  self._id = nextId++;                                                          // 86
  self._onInvalidateCallbacks = [];                                             // 87
  // the plan is at some point to use the parent relation                       // 88
  // to constrain the order that computations are processed                     // 89
  self._parent = parent;                                                        // 90
  self._func = f;                                                               // 91
  self._recomputing = false;                                                    // 92
                                                                                // 93
  var errored = true;                                                           // 94
  try {                                                                         // 95
    self._compute();                                                            // 96
    errored = false;                                                            // 97
  } finally {                                                                   // 98
    self.firstRun = false;                                                      // 99
    if (errored)                                                                // 100
      self.stop();                                                              // 101
  }                                                                             // 102
};                                                                              // 103
                                                                                // 104
_.extend(Deps.Computation.prototype, {                                          // 105
                                                                                // 106
  // http://docs.meteor.com/#computation_oninvalidate                           // 107
  onInvalidate: function (f) {                                                  // 108
    var self = this;                                                            // 109
                                                                                // 110
    if (typeof f !== 'function')                                                // 111
      throw new Error("onInvalidate requires a function");                      // 112
                                                                                // 113
    var g = function () {                                                       // 114
      Deps.nonreactive(function () {                                            // 115
        return Meteor._noYieldsAllowed(function () {                            // 116
          f(self);                                                              // 117
        });                                                                     // 118
      });                                                                       // 119
    };                                                                          // 120
                                                                                // 121
    if (self.invalidated)                                                       // 122
      g();                                                                      // 123
    else                                                                        // 124
      self._onInvalidateCallbacks.push(g);                                      // 125
  },                                                                            // 126
                                                                                // 127
  // http://docs.meteor.com/#computation_invalidate                             // 128
  invalidate: function () {                                                     // 129
    var self = this;                                                            // 130
    if (! self.invalidated) {                                                   // 131
      // if we're currently in _recompute(), don't enqueue                      // 132
      // ourselves, since we'll rerun immediately anyway.                       // 133
      if (! self._recomputing && ! self.stopped) {                              // 134
        requireFlush();                                                         // 135
        pendingComputations.push(this);                                         // 136
      }                                                                         // 137
                                                                                // 138
      self.invalidated = true;                                                  // 139
                                                                                // 140
      // callbacks can't add callbacks, because                                 // 141
      // self.invalidated === true.                                             // 142
      for(var i = 0, f; f = self._onInvalidateCallbacks[i]; i++)                // 143
        f(); // already bound with self as argument                             // 144
      self._onInvalidateCallbacks = [];                                         // 145
    }                                                                           // 146
  },                                                                            // 147
                                                                                // 148
  // http://docs.meteor.com/#computation_stop                                   // 149
  stop: function () {                                                           // 150
    if (! this.stopped) {                                                       // 151
      this.stopped = true;                                                      // 152
      this.invalidate();                                                        // 153
    }                                                                           // 154
  },                                                                            // 155
                                                                                // 156
  _compute: function () {                                                       // 157
    var self = this;                                                            // 158
    self.invalidated = false;                                                   // 159
                                                                                // 160
    var previous = Deps.currentComputation;                                     // 161
    setCurrentComputation(self);                                                // 162
    var previousInCompute = inCompute;                                          // 163
    inCompute = true;                                                           // 164
    try {                                                                       // 165
      self._func(self);                                                         // 166
    } finally {                                                                 // 167
      setCurrentComputation(previous);                                          // 168
      inCompute = false;                                                        // 169
    }                                                                           // 170
  },                                                                            // 171
                                                                                // 172
  _recompute: function () {                                                     // 173
    var self = this;                                                            // 174
                                                                                // 175
    self._recomputing = true;                                                   // 176
    try {                                                                       // 177
      while (self.invalidated && ! self.stopped) {                              // 178
        try {                                                                   // 179
          self._compute();                                                      // 180
        } catch (e) {                                                           // 181
          _throwOrLog("recompute", e);                                          // 182
        }                                                                       // 183
        // If _compute() invalidated us, we run again immediately.              // 184
        // A computation that invalidates itself indefinitely is an             // 185
        // infinite loop, of course.                                            // 186
        //                                                                      // 187
        // We could put an iteration counter here and catch run-away            // 188
        // loops.                                                               // 189
      }                                                                         // 190
    } finally {                                                                 // 191
      self._recomputing = false;                                                // 192
    }                                                                           // 193
  }                                                                             // 194
});                                                                             // 195
                                                                                // 196
//                                                                              // 197
// http://docs.meteor.com/#deps_dependency                                      // 198
//                                                                              // 199
Deps.Dependency = function () {                                                 // 200
  this._dependentsById = {};                                                    // 201
};                                                                              // 202
                                                                                // 203
_.extend(Deps.Dependency.prototype, {                                           // 204
  // http://docs.meteor.com/#dependency_depend                                  // 205
  //                                                                            // 206
  // Adds `computation` to this set if it is not already                        // 207
  // present.  Returns true if `computation` is a new member of the set.        // 208
  // If no argument, defaults to currentComputation, or does nothing            // 209
  // if there is no currentComputation.                                         // 210
  depend: function (computation) {                                              // 211
    if (! computation) {                                                        // 212
      if (! Deps.active)                                                        // 213
        return false;                                                           // 214
                                                                                // 215
      computation = Deps.currentComputation;                                    // 216
    }                                                                           // 217
    var self = this;                                                            // 218
    var id = computation._id;                                                   // 219
    if (! (id in self._dependentsById)) {                                       // 220
      self._dependentsById[id] = computation;                                   // 221
      computation.onInvalidate(function () {                                    // 222
        delete self._dependentsById[id];                                        // 223
      });                                                                       // 224
      return true;                                                              // 225
    }                                                                           // 226
    return false;                                                               // 227
  },                                                                            // 228
                                                                                // 229
  // http://docs.meteor.com/#dependency_changed                                 // 230
  changed: function () {                                                        // 231
    var self = this;                                                            // 232
    for (var id in self._dependentsById)                                        // 233
      self._dependentsById[id].invalidate();                                    // 234
  },                                                                            // 235
                                                                                // 236
  // http://docs.meteor.com/#dependency_hasdependents                           // 237
  hasDependents: function () {                                                  // 238
    var self = this;                                                            // 239
    for(var id in self._dependentsById)                                         // 240
      return true;                                                              // 241
    return false;                                                               // 242
  }                                                                             // 243
});                                                                             // 244
                                                                                // 245
_.extend(Deps, {                                                                // 246
  // http://docs.meteor.com/#deps_flush                                         // 247
  flush: function (_opts) {                                                     // 248
    // Nested flush could plausibly happen if, say, a flush causes              // 249
    // DOM mutation, which causes a "blur" event, which runs an                 // 250
    // app event handler that calls Deps.flush.  At the moment                  // 251
    // Spark blocks event handlers during DOM mutation anyway,                  // 252
    // because the LiveRange tree isn't valid.  And we don't have               // 253
    // any useful notion of a nested flush.                                     // 254
    //                                                                          // 255
    // https://app.asana.com/0/159908330244/385138233856                        // 256
    if (inFlush)                                                                // 257
      throw new Error("Can't call Deps.flush while flushing");                  // 258
                                                                                // 259
    if (inCompute)                                                              // 260
      throw new Error("Can't flush inside Deps.autorun");                       // 261
                                                                                // 262
    inFlush = true;                                                             // 263
    willFlush = true;                                                           // 264
    throwFirstError = !! (_opts && _opts._throwFirstError);                     // 265
                                                                                // 266
    try {                                                                       // 267
      while (pendingComputations.length ||                                      // 268
             afterFlushCallbacks.length) {                                      // 269
                                                                                // 270
        // recompute all pending computations                                   // 271
        while (pendingComputations.length) {                                    // 272
          var comp = pendingComputations.shift();                               // 273
          comp._recompute();                                                    // 274
        }                                                                       // 275
                                                                                // 276
        if (afterFlushCallbacks.length) {                                       // 277
          // call one afterFlush callback, which may                            // 278
          // invalidate more computations                                       // 279
          var func = afterFlushCallbacks.shift();                               // 280
          try {                                                                 // 281
            func();                                                             // 282
          } catch (e) {                                                         // 283
            _throwOrLog("afterFlush function", e);                              // 284
          }                                                                     // 285
        }                                                                       // 286
      }                                                                         // 287
    } catch (e) {                                                               // 288
      inFlush = false; // needed before calling `Deps.flush()` again            // 289
      Deps.flush({_throwFirstError: false}); // finish flushing                 // 290
      throw e;                                                                  // 291
    } finally {                                                                 // 292
      willFlush = false;                                                        // 293
      inFlush = false;                                                          // 294
    }                                                                           // 295
  },                                                                            // 296
                                                                                // 297
  // http://docs.meteor.com/#deps_autorun                                       // 298
  //                                                                            // 299
  // Run f(). Record its dependencies. Rerun it whenever the                    // 300
  // dependencies change.                                                       // 301
  //                                                                            // 302
  // Returns a new Computation, which is also passed to f.                      // 303
  //                                                                            // 304
  // Links the computation to the current computation                           // 305
  // so that it is stopped if the current computation is invalidated.           // 306
  autorun: function (f) {                                                       // 307
    if (typeof f !== 'function')                                                // 308
      throw new Error('Deps.autorun requires a function argument');             // 309
                                                                                // 310
    constructingComputation = true;                                             // 311
    var c = new Deps.Computation(function (c) {                                 // 312
      Meteor._noYieldsAllowed(function () { f(c); });                           // 313
    }, Deps.currentComputation);                                                // 314
                                                                                // 315
    if (Deps.active)                                                            // 316
      Deps.onInvalidate(function () {                                           // 317
        c.stop();                                                               // 318
      });                                                                       // 319
                                                                                // 320
    return c;                                                                   // 321
  },                                                                            // 322
                                                                                // 323
  // http://docs.meteor.com/#deps_nonreactive                                   // 324
  //                                                                            // 325
  // Run `f` with no current computation, returning the return value            // 326
  // of `f`.  Used to turn off reactivity for the duration of `f`,              // 327
  // so that reactive data sources accessed by `f` will not result in any       // 328
  // computations being invalidated.                                            // 329
  nonreactive: function (f) {                                                   // 330
    var previous = Deps.currentComputation;                                     // 331
    setCurrentComputation(null);                                                // 332
    try {                                                                       // 333
      return f();                                                               // 334
    } finally {                                                                 // 335
      setCurrentComputation(previous);                                          // 336
    }                                                                           // 337
  },                                                                            // 338
                                                                                // 339
  // http://docs.meteor.com/#deps_oninvalidate                                  // 340
  onInvalidate: function (f) {                                                  // 341
    if (! Deps.active)                                                          // 342
      throw new Error("Deps.onInvalidate requires a currentComputation");       // 343
                                                                                // 344
    Deps.currentComputation.onInvalidate(f);                                    // 345
  },                                                                            // 346
                                                                                // 347
  // http://docs.meteor.com/#deps_afterflush                                    // 348
  afterFlush: function (f) {                                                    // 349
    afterFlushCallbacks.push(f);                                                // 350
    requireFlush();                                                             // 351
  }                                                                             // 352
});                                                                             // 353
                                                                                // 354
//////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////
//                                                                              //
// packages/deps/deprecated.js                                                  //
//                                                                              //
//////////////////////////////////////////////////////////////////////////////////
                                                                                //
// Deprecated (Deps-recated?) functions.                                        // 1
                                                                                // 2
// These functions used to be on the Meteor object (and worked slightly         // 3
// differently).                                                                // 4
// XXX COMPAT WITH 0.5.7                                                        // 5
Meteor.flush = Deps.flush;                                                      // 6
Meteor.autorun = Deps.autorun;                                                  // 7
                                                                                // 8
// We used to require a special "autosubscribe" call to reactively subscribe to // 9
// things. Now, it works with autorun.                                          // 10
// XXX COMPAT WITH 0.5.4                                                        // 11
Meteor.autosubscribe = Deps.autorun;                                            // 12
                                                                                // 13
// This Deps API briefly existed in 0.5.8 and 0.5.9                             // 14
// XXX COMPAT WITH 0.5.9                                                        // 15
Deps.depend = function (d) {                                                    // 16
  return d.depend();                                                            // 17
};                                                                              // 18
                                                                                // 19
//////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.deps = {
  Deps: Deps
};

})();
