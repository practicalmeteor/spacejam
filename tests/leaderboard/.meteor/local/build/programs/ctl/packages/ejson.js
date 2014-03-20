(function () {

/* Imports */
var Meteor = Package.meteor.Meteor;
var _ = Package.underscore._;

/* Package-scope variables */
var EJSON, EJSONTest, base64Encode, base64Decode;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/ejson/ejson.js                                                                      //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
EJSON = {};                                                                                     // 1
EJSONTest = {};                                                                                 // 2
                                                                                                // 3
var customTypes = {};                                                                           // 4
// Add a custom type, using a method of your choice to get to and                               // 5
// from a basic JSON-able representation.  The factory argument                                 // 6
// is a function of JSON-able --> your object                                                   // 7
// The type you add must have:                                                                  // 8
// - A toJSONValue() method, so that Meteor can serialize it                                    // 9
// - a typeName() method, to show how to look it up in our type table.                          // 10
// It is okay if these methods are monkey-patched on.                                           // 11
// EJSON.clone will use toJSONValue and the given factory to produce                            // 12
// a clone, but you may specify a method clone() that will be                                   // 13
// used instead.                                                                                // 14
// Similarly, EJSON.equals will use toJSONValue to make comparisons,                            // 15
// but you may provide a method equals() instead.                                               // 16
//                                                                                              // 17
EJSON.addType = function (name, factory) {                                                      // 18
  if (_.has(customTypes, name))                                                                 // 19
    throw new Error("Type " + name + " already present");                                       // 20
  customTypes[name] = factory;                                                                  // 21
};                                                                                              // 22
                                                                                                // 23
var isInfOrNan = function (obj) {                                                               // 24
  return _.isNaN(obj) || obj === Infinity || obj === -Infinity;                                 // 25
};                                                                                              // 26
                                                                                                // 27
var builtinConverters = [                                                                       // 28
  { // Date                                                                                     // 29
    matchJSONValue: function (obj) {                                                            // 30
      return _.has(obj, '$date') && _.size(obj) === 1;                                          // 31
    },                                                                                          // 32
    matchObject: function (obj) {                                                               // 33
      return obj instanceof Date;                                                               // 34
    },                                                                                          // 35
    toJSONValue: function (obj) {                                                               // 36
      return {$date: obj.getTime()};                                                            // 37
    },                                                                                          // 38
    fromJSONValue: function (obj) {                                                             // 39
      return new Date(obj.$date);                                                               // 40
    }                                                                                           // 41
  },                                                                                            // 42
  { // NaN, Inf, -Inf. (These are the only objects with typeof !== 'object'                     // 43
    // which we match.)                                                                         // 44
    matchJSONValue: function (obj) {                                                            // 45
      return _.has(obj, '$InfNaN') && _.size(obj) === 1;                                        // 46
    },                                                                                          // 47
    matchObject: isInfOrNan,                                                                    // 48
    toJSONValue: function (obj) {                                                               // 49
      var sign;                                                                                 // 50
      if (_.isNaN(obj))                                                                         // 51
        sign = 0;                                                                               // 52
      else if (obj === Infinity)                                                                // 53
        sign = 1;                                                                               // 54
      else                                                                                      // 55
        sign = -1;                                                                              // 56
      return {$InfNaN: sign};                                                                   // 57
    },                                                                                          // 58
    fromJSONValue: function (obj) {                                                             // 59
      return obj.$InfNaN/0;                                                                     // 60
    }                                                                                           // 61
  },                                                                                            // 62
  { // Binary                                                                                   // 63
    matchJSONValue: function (obj) {                                                            // 64
      return _.has(obj, '$binary') && _.size(obj) === 1;                                        // 65
    },                                                                                          // 66
    matchObject: function (obj) {                                                               // 67
      return typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array                     // 68
        || (obj && _.has(obj, '$Uint8ArrayPolyfill'));                                          // 69
    },                                                                                          // 70
    toJSONValue: function (obj) {                                                               // 71
      return {$binary: base64Encode(obj)};                                                      // 72
    },                                                                                          // 73
    fromJSONValue: function (obj) {                                                             // 74
      return base64Decode(obj.$binary);                                                         // 75
    }                                                                                           // 76
  },                                                                                            // 77
  { // Escaping one level                                                                       // 78
    matchJSONValue: function (obj) {                                                            // 79
      return _.has(obj, '$escape') && _.size(obj) === 1;                                        // 80
    },                                                                                          // 81
    matchObject: function (obj) {                                                               // 82
      if (_.isEmpty(obj) || _.size(obj) > 2) {                                                  // 83
        return false;                                                                           // 84
      }                                                                                         // 85
      return _.any(builtinConverters, function (converter) {                                    // 86
        return converter.matchJSONValue(obj);                                                   // 87
      });                                                                                       // 88
    },                                                                                          // 89
    toJSONValue: function (obj) {                                                               // 90
      var newObj = {};                                                                          // 91
      _.each(obj, function (value, key) {                                                       // 92
        newObj[key] = EJSON.toJSONValue(value);                                                 // 93
      });                                                                                       // 94
      return {$escape: newObj};                                                                 // 95
    },                                                                                          // 96
    fromJSONValue: function (obj) {                                                             // 97
      var newObj = {};                                                                          // 98
      _.each(obj.$escape, function (value, key) {                                               // 99
        newObj[key] = EJSON.fromJSONValue(value);                                               // 100
      });                                                                                       // 101
      return newObj;                                                                            // 102
    }                                                                                           // 103
  },                                                                                            // 104
  { // Custom                                                                                   // 105
    matchJSONValue: function (obj) {                                                            // 106
      return _.has(obj, '$type') && _.has(obj, '$value') && _.size(obj) === 2;                  // 107
    },                                                                                          // 108
    matchObject: function (obj) {                                                               // 109
      return EJSON._isCustomType(obj);                                                          // 110
    },                                                                                          // 111
    toJSONValue: function (obj) {                                                               // 112
      return {$type: obj.typeName(), $value: obj.toJSONValue()};                                // 113
    },                                                                                          // 114
    fromJSONValue: function (obj) {                                                             // 115
      var typeName = obj.$type;                                                                 // 116
      var converter = customTypes[typeName];                                                    // 117
      return converter(obj.$value);                                                             // 118
    }                                                                                           // 119
  }                                                                                             // 120
];                                                                                              // 121
                                                                                                // 122
EJSON._isCustomType = function (obj) {                                                          // 123
  return obj &&                                                                                 // 124
    typeof obj.toJSONValue === 'function' &&                                                    // 125
    typeof obj.typeName === 'function' &&                                                       // 126
    _.has(customTypes, obj.typeName());                                                         // 127
};                                                                                              // 128
                                                                                                // 129
                                                                                                // 130
// for both arrays and objects, in-place modification.                                          // 131
var adjustTypesToJSONValue =                                                                    // 132
EJSON._adjustTypesToJSONValue = function (obj) {                                                // 133
  // Is it an atom that we need to adjust?                                                      // 134
  if (obj === null)                                                                             // 135
    return null;                                                                                // 136
  var maybeChanged = toJSONValueHelper(obj);                                                    // 137
  if (maybeChanged !== undefined)                                                               // 138
    return maybeChanged;                                                                        // 139
                                                                                                // 140
  // Other atoms are unchanged.                                                                 // 141
  if (typeof obj !== 'object')                                                                  // 142
    return obj;                                                                                 // 143
                                                                                                // 144
  // Iterate over array or object structure.                                                    // 145
  _.each(obj, function (value, key) {                                                           // 146
    if (typeof value !== 'object' && value !== undefined &&                                     // 147
        !isInfOrNan(value))                                                                     // 148
      return; // continue                                                                       // 149
                                                                                                // 150
    var changed = toJSONValueHelper(value);                                                     // 151
    if (changed) {                                                                              // 152
      obj[key] = changed;                                                                       // 153
      return; // on to the next key                                                             // 154
    }                                                                                           // 155
    // if we get here, value is an object but not adjustable                                    // 156
    // at this level.  recurse.                                                                 // 157
    adjustTypesToJSONValue(value);                                                              // 158
  });                                                                                           // 159
  return obj;                                                                                   // 160
};                                                                                              // 161
                                                                                                // 162
// Either return the JSON-compatible version of the argument, or undefined (if                  // 163
// the item isn't itself replaceable, but maybe some fields in it are)                          // 164
var toJSONValueHelper = function (item) {                                                       // 165
  for (var i = 0; i < builtinConverters.length; i++) {                                          // 166
    var converter = builtinConverters[i];                                                       // 167
    if (converter.matchObject(item)) {                                                          // 168
      return converter.toJSONValue(item);                                                       // 169
    }                                                                                           // 170
  }                                                                                             // 171
  return undefined;                                                                             // 172
};                                                                                              // 173
                                                                                                // 174
EJSON.toJSONValue = function (item) {                                                           // 175
  var changed = toJSONValueHelper(item);                                                        // 176
  if (changed !== undefined)                                                                    // 177
    return changed;                                                                             // 178
  if (typeof item === 'object') {                                                               // 179
    item = EJSON.clone(item);                                                                   // 180
    adjustTypesToJSONValue(item);                                                               // 181
  }                                                                                             // 182
  return item;                                                                                  // 183
};                                                                                              // 184
                                                                                                // 185
// for both arrays and objects. Tries its best to just                                          // 186
// use the object you hand it, but may return something                                         // 187
// different if the object you hand it itself needs changing.                                   // 188
//                                                                                              // 189
var adjustTypesFromJSONValue =                                                                  // 190
EJSON._adjustTypesFromJSONValue = function (obj) {                                              // 191
  if (obj === null)                                                                             // 192
    return null;                                                                                // 193
  var maybeChanged = fromJSONValueHelper(obj);                                                  // 194
  if (maybeChanged !== obj)                                                                     // 195
    return maybeChanged;                                                                        // 196
                                                                                                // 197
  // Other atoms are unchanged.                                                                 // 198
  if (typeof obj !== 'object')                                                                  // 199
    return obj;                                                                                 // 200
                                                                                                // 201
  _.each(obj, function (value, key) {                                                           // 202
    if (typeof value === 'object') {                                                            // 203
      var changed = fromJSONValueHelper(value);                                                 // 204
      if (value !== changed) {                                                                  // 205
        obj[key] = changed;                                                                     // 206
        return;                                                                                 // 207
      }                                                                                         // 208
      // if we get here, value is an object but not adjustable                                  // 209
      // at this level.  recurse.                                                               // 210
      adjustTypesFromJSONValue(value);                                                          // 211
    }                                                                                           // 212
  });                                                                                           // 213
  return obj;                                                                                   // 214
};                                                                                              // 215
                                                                                                // 216
// Either return the argument changed to have the non-json                                      // 217
// rep of itself (the Object version) or the argument itself.                                   // 218
                                                                                                // 219
// DOES NOT RECURSE.  For actually getting the fully-changed value, use                         // 220
// EJSON.fromJSONValue                                                                          // 221
var fromJSONValueHelper = function (value) {                                                    // 222
  if (typeof value === 'object' && value !== null) {                                            // 223
    if (_.size(value) <= 2                                                                      // 224
        && _.all(value, function (v, k) {                                                       // 225
          return typeof k === 'string' && k.substr(0, 1) === '$';                               // 226
        })) {                                                                                   // 227
      for (var i = 0; i < builtinConverters.length; i++) {                                      // 228
        var converter = builtinConverters[i];                                                   // 229
        if (converter.matchJSONValue(value)) {                                                  // 230
          return converter.fromJSONValue(value);                                                // 231
        }                                                                                       // 232
      }                                                                                         // 233
    }                                                                                           // 234
  }                                                                                             // 235
  return value;                                                                                 // 236
};                                                                                              // 237
                                                                                                // 238
EJSON.fromJSONValue = function (item) {                                                         // 239
  var changed = fromJSONValueHelper(item);                                                      // 240
  if (changed === item && typeof item === 'object') {                                           // 241
    item = EJSON.clone(item);                                                                   // 242
    adjustTypesFromJSONValue(item);                                                             // 243
    return item;                                                                                // 244
  } else {                                                                                      // 245
    return changed;                                                                             // 246
  }                                                                                             // 247
};                                                                                              // 248
                                                                                                // 249
EJSON.stringify = function (item, options) {                                                    // 250
  var json = EJSON.toJSONValue(item);                                                           // 251
  if (options && (options.canonical || options.indent)) {                                       // 252
    return EJSON._canonicalStringify(json, options);                                            // 253
  } else {                                                                                      // 254
    return JSON.stringify(json);                                                                // 255
  }                                                                                             // 256
};                                                                                              // 257
                                                                                                // 258
EJSON.parse = function (item) {                                                                 // 259
  if (typeof item !== 'string')                                                                 // 260
    throw new Error("EJSON.parse argument should be a string");                                 // 261
  return EJSON.fromJSONValue(JSON.parse(item));                                                 // 262
};                                                                                              // 263
                                                                                                // 264
EJSON.isBinary = function (obj) {                                                               // 265
  return !!((typeof Uint8Array !== 'undefined' && obj instanceof Uint8Array) ||                 // 266
    (obj && obj.$Uint8ArrayPolyfill));                                                          // 267
};                                                                                              // 268
                                                                                                // 269
EJSON.equals = function (a, b, options) {                                                       // 270
  var i;                                                                                        // 271
  var keyOrderSensitive = !!(options && options.keyOrderSensitive);                             // 272
  if (a === b)                                                                                  // 273
    return true;                                                                                // 274
  if (_.isNaN(a) && _.isNaN(b))                                                                 // 275
    return true; // This differs from the IEEE spec for NaN equality, b/c we don't want         // 276
                 // anything ever with a NaN to be poisoned from becoming equal to anything.    // 277
  if (!a || !b) // if either one is falsy, they'd have to be === to be equal                    // 278
    return false;                                                                               // 279
  if (!(typeof a === 'object' && typeof b === 'object'))                                        // 280
    return false;                                                                               // 281
  if (a instanceof Date && b instanceof Date)                                                   // 282
    return a.valueOf() === b.valueOf();                                                         // 283
  if (EJSON.isBinary(a) && EJSON.isBinary(b)) {                                                 // 284
    if (a.length !== b.length)                                                                  // 285
      return false;                                                                             // 286
    for (i = 0; i < a.length; i++) {                                                            // 287
      if (a[i] !== b[i])                                                                        // 288
        return false;                                                                           // 289
    }                                                                                           // 290
    return true;                                                                                // 291
  }                                                                                             // 292
  if (typeof (a.equals) === 'function')                                                         // 293
    return a.equals(b, options);                                                                // 294
  if (typeof (b.equals) === 'function')                                                         // 295
    return b.equals(a, options);                                                                // 296
  if (a instanceof Array) {                                                                     // 297
    if (!(b instanceof Array))                                                                  // 298
      return false;                                                                             // 299
    if (a.length !== b.length)                                                                  // 300
      return false;                                                                             // 301
    for (i = 0; i < a.length; i++) {                                                            // 302
      if (!EJSON.equals(a[i], b[i], options))                                                   // 303
        return false;                                                                           // 304
    }                                                                                           // 305
    return true;                                                                                // 306
  }                                                                                             // 307
  // fallback for custom types that don't implement their own equals                            // 308
  switch (EJSON._isCustomType(a) + EJSON._isCustomType(b)) {                                    // 309
    case 1: return false;                                                                       // 310
    case 2: return EJSON.equals(EJSON.toJSONValue(a), EJSON.toJSONValue(b));                    // 311
  }                                                                                             // 312
  // fall back to structural equality of objects                                                // 313
  var ret;                                                                                      // 314
  if (keyOrderSensitive) {                                                                      // 315
    var bKeys = [];                                                                             // 316
    _.each(b, function (val, x) {                                                               // 317
        bKeys.push(x);                                                                          // 318
    });                                                                                         // 319
    i = 0;                                                                                      // 320
    ret = _.all(a, function (val, x) {                                                          // 321
      if (i >= bKeys.length) {                                                                  // 322
        return false;                                                                           // 323
      }                                                                                         // 324
      if (x !== bKeys[i]) {                                                                     // 325
        return false;                                                                           // 326
      }                                                                                         // 327
      if (!EJSON.equals(val, b[bKeys[i]], options)) {                                           // 328
        return false;                                                                           // 329
      }                                                                                         // 330
      i++;                                                                                      // 331
      return true;                                                                              // 332
    });                                                                                         // 333
    return ret && i === bKeys.length;                                                           // 334
  } else {                                                                                      // 335
    i = 0;                                                                                      // 336
    ret = _.all(a, function (val, key) {                                                        // 337
      if (!_.has(b, key)) {                                                                     // 338
        return false;                                                                           // 339
      }                                                                                         // 340
      if (!EJSON.equals(val, b[key], options)) {                                                // 341
        return false;                                                                           // 342
      }                                                                                         // 343
      i++;                                                                                      // 344
      return true;                                                                              // 345
    });                                                                                         // 346
    return ret && _.size(b) === i;                                                              // 347
  }                                                                                             // 348
};                                                                                              // 349
                                                                                                // 350
EJSON.clone = function (v) {                                                                    // 351
  var ret;                                                                                      // 352
  if (typeof v !== "object")                                                                    // 353
    return v;                                                                                   // 354
  if (v === null)                                                                               // 355
    return null; // null has typeof "object"                                                    // 356
  if (v instanceof Date)                                                                        // 357
    return new Date(v.getTime());                                                               // 358
  // RegExps are not really EJSON elements (eg we don't define a serialization                  // 359
  // for them), but they're immutable anyway, so we can support them in clone.                  // 360
  if (v instanceof RegExp)                                                                      // 361
    return v;                                                                                   // 362
  if (EJSON.isBinary(v)) {                                                                      // 363
    ret = EJSON.newBinary(v.length);                                                            // 364
    for (var i = 0; i < v.length; i++) {                                                        // 365
      ret[i] = v[i];                                                                            // 366
    }                                                                                           // 367
    return ret;                                                                                 // 368
  }                                                                                             // 369
  // XXX: Use something better than underscore's isArray                                        // 370
  if (_.isArray(v) || _.isArguments(v)) {                                                       // 371
    // For some reason, _.map doesn't work in this context on Opera (weird test                 // 372
    // failures).                                                                               // 373
    ret = [];                                                                                   // 374
    for (i = 0; i < v.length; i++)                                                              // 375
      ret[i] = EJSON.clone(v[i]);                                                               // 376
    return ret;                                                                                 // 377
  }                                                                                             // 378
  // handle general user-defined typed Objects if they have a clone method                      // 379
  if (typeof v.clone === 'function') {                                                          // 380
    return v.clone();                                                                           // 381
  }                                                                                             // 382
  // handle other custom types                                                                  // 383
  if (EJSON._isCustomType(v)) {                                                                 // 384
    return EJSON.fromJSONValue(EJSON.clone(EJSON.toJSONValue(v)), true);                        // 385
  }                                                                                             // 386
  // handle other objects                                                                       // 387
  ret = {};                                                                                     // 388
  _.each(v, function (value, key) {                                                             // 389
    ret[key] = EJSON.clone(value);                                                              // 390
  });                                                                                           // 391
  return ret;                                                                                   // 392
};                                                                                              // 393
                                                                                                // 394
//////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/ejson/stringify.js                                                                  //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
// Based on json2.js from https://github.com/douglascrockford/JSON-js                           // 1
//                                                                                              // 2
//    json2.js                                                                                  // 3
//    2012-10-08                                                                                // 4
//                                                                                              // 5
//    Public Domain.                                                                            // 6
//                                                                                              // 7
//    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.                                   // 8
                                                                                                // 9
function quote(string) {                                                                        // 10
  return JSON.stringify(string);                                                                // 11
}                                                                                               // 12
                                                                                                // 13
var str = function (key, holder, singleIndent, outerIndent, canonical) {                        // 14
                                                                                                // 15
  // Produce a string from holder[key].                                                         // 16
                                                                                                // 17
  var i;          // The loop counter.                                                          // 18
  var k;          // The member key.                                                            // 19
  var v;          // The member value.                                                          // 20
  var length;                                                                                   // 21
  var innerIndent = outerIndent;                                                                // 22
  var partial;                                                                                  // 23
  var value = holder[key];                                                                      // 24
                                                                                                // 25
  // What happens next depends on the value's type.                                             // 26
                                                                                                // 27
  switch (typeof value) {                                                                       // 28
  case 'string':                                                                                // 29
    return quote(value);                                                                        // 30
  case 'number':                                                                                // 31
    // JSON numbers must be finite. Encode non-finite numbers as null.                          // 32
    return isFinite(value) ? String(value) : 'null';                                            // 33
  case 'boolean':                                                                               // 34
    return String(value);                                                                       // 35
  // If the type is 'object', we might be dealing with an object or an array or                 // 36
  // null.                                                                                      // 37
  case 'object':                                                                                // 38
    // Due to a specification blunder in ECMAScript, typeof null is 'object',                   // 39
    // so watch out for that case.                                                              // 40
    if (!value) {                                                                               // 41
      return 'null';                                                                            // 42
    }                                                                                           // 43
    // Make an array to hold the partial results of stringifying this object value.             // 44
    innerIndent = outerIndent + singleIndent;                                                   // 45
    partial = [];                                                                               // 46
                                                                                                // 47
    // Is the value an array?                                                                   // 48
    if (_.isArray(value) || _.isArguments(value)) {                                             // 49
                                                                                                // 50
      // The value is an array. Stringify every element. Use null as a placeholder              // 51
      // for non-JSON values.                                                                   // 52
                                                                                                // 53
      length = value.length;                                                                    // 54
      for (i = 0; i < length; i += 1) {                                                         // 55
        partial[i] = str(i, value, singleIndent, innerIndent, canonical) || 'null';             // 56
      }                                                                                         // 57
                                                                                                // 58
      // Join all of the elements together, separated with commas, and wrap them in             // 59
      // brackets.                                                                              // 60
                                                                                                // 61
      if (partial.length === 0) {                                                               // 62
        v = '[]';                                                                               // 63
      } else if (innerIndent) {                                                                 // 64
        v = '[\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + ']'; // 65
      } else {                                                                                  // 66
        v = '[' + partial.join(',') + ']';                                                      // 67
      }                                                                                         // 68
      return v;                                                                                 // 69
    }                                                                                           // 70
                                                                                                // 71
                                                                                                // 72
    // Iterate through all of the keys in the object.                                           // 73
    var keys = _.keys(value);                                                                   // 74
    if (canonical)                                                                              // 75
      keys = keys.sort();                                                                       // 76
    _.each(keys, function (k) {                                                                 // 77
      v = str(k, value, singleIndent, innerIndent, canonical);                                  // 78
      if (v) {                                                                                  // 79
        partial.push(quote(k) + (innerIndent ? ': ' : ':') + v);                                // 80
      }                                                                                         // 81
    });                                                                                         // 82
                                                                                                // 83
                                                                                                // 84
    // Join all of the member texts together, separated with commas,                            // 85
    // and wrap them in braces.                                                                 // 86
                                                                                                // 87
    if (partial.length === 0) {                                                                 // 88
      v = '{}';                                                                                 // 89
    } else if (innerIndent) {                                                                   // 90
      v = '{\n' + innerIndent + partial.join(',\n' + innerIndent) + '\n' + outerIndent + '}';   // 91
    } else {                                                                                    // 92
      v = '{' + partial.join(',') + '}';                                                        // 93
    }                                                                                           // 94
    return v;                                                                                   // 95
  }                                                                                             // 96
}                                                                                               // 97
                                                                                                // 98
// If the JSON object does not yet have a stringify method, give it one.                        // 99
                                                                                                // 100
EJSON._canonicalStringify = function (value, options) {                                         // 101
  // Make a fake root object containing our value under the key of ''.                          // 102
  // Return the result of stringifying the value.                                               // 103
  options = _.extend({                                                                          // 104
    indent: "",                                                                                 // 105
    canonical: false                                                                            // 106
  }, options);                                                                                  // 107
  if (options.indent === true) {                                                                // 108
    options.indent = "  ";                                                                      // 109
  } else if (typeof options.indent === 'number') {                                              // 110
    var newIndent = "";                                                                         // 111
    for (var i = 0; i < options.indent; i++) {                                                  // 112
      newIndent += ' ';                                                                         // 113
    }                                                                                           // 114
    options.indent = newIndent;                                                                 // 115
  }                                                                                             // 116
  return str('', {'': value}, options.indent, "", options.canonical);                           // 117
};                                                                                              // 118
                                                                                                // 119
//////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);






(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/ejson/base64.js                                                                     //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
// Base 64 encoding                                                                             // 1
                                                                                                // 2
var BASE_64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";         // 3
                                                                                                // 4
var BASE_64_VALS = {};                                                                          // 5
                                                                                                // 6
for (var i = 0; i < BASE_64_CHARS.length; i++) {                                                // 7
  BASE_64_VALS[BASE_64_CHARS.charAt(i)] = i;                                                    // 8
};                                                                                              // 9
                                                                                                // 10
base64Encode = function (array) {                                                               // 11
  var answer = [];                                                                              // 12
  var a = null;                                                                                 // 13
  var b = null;                                                                                 // 14
  var c = null;                                                                                 // 15
  var d = null;                                                                                 // 16
  for (var i = 0; i < array.length; i++) {                                                      // 17
    switch (i % 3) {                                                                            // 18
    case 0:                                                                                     // 19
      a = (array[i] >> 2) & 0x3F;                                                               // 20
      b = (array[i] & 0x03) << 4;                                                               // 21
      break;                                                                                    // 22
    case 1:                                                                                     // 23
      b = b | (array[i] >> 4) & 0xF;                                                            // 24
      c = (array[i] & 0xF) << 2;                                                                // 25
      break;                                                                                    // 26
    case 2:                                                                                     // 27
      c = c | (array[i] >> 6) & 0x03;                                                           // 28
      d = array[i] & 0x3F;                                                                      // 29
      answer.push(getChar(a));                                                                  // 30
      answer.push(getChar(b));                                                                  // 31
      answer.push(getChar(c));                                                                  // 32
      answer.push(getChar(d));                                                                  // 33
      a = null;                                                                                 // 34
      b = null;                                                                                 // 35
      c = null;                                                                                 // 36
      d = null;                                                                                 // 37
      break;                                                                                    // 38
    }                                                                                           // 39
  }                                                                                             // 40
  if (a != null) {                                                                              // 41
    answer.push(getChar(a));                                                                    // 42
    answer.push(getChar(b));                                                                    // 43
    if (c == null)                                                                              // 44
      answer.push('=');                                                                         // 45
    else                                                                                        // 46
      answer.push(getChar(c));                                                                  // 47
    if (d == null)                                                                              // 48
      answer.push('=');                                                                         // 49
  }                                                                                             // 50
  return answer.join("");                                                                       // 51
};                                                                                              // 52
                                                                                                // 53
var getChar = function (val) {                                                                  // 54
  return BASE_64_CHARS.charAt(val);                                                             // 55
};                                                                                              // 56
                                                                                                // 57
var getVal = function (ch) {                                                                    // 58
  if (ch === '=') {                                                                             // 59
    return -1;                                                                                  // 60
  }                                                                                             // 61
  return BASE_64_VALS[ch];                                                                      // 62
};                                                                                              // 63
                                                                                                // 64
EJSON.newBinary = function (len) {                                                              // 65
  if (typeof Uint8Array === 'undefined' || typeof ArrayBuffer === 'undefined') {                // 66
    var ret = [];                                                                               // 67
    for (var i = 0; i < len; i++) {                                                             // 68
      ret.push(0);                                                                              // 69
    }                                                                                           // 70
    ret.$Uint8ArrayPolyfill = true;                                                             // 71
    return ret;                                                                                 // 72
  }                                                                                             // 73
  return new Uint8Array(new ArrayBuffer(len));                                                  // 74
};                                                                                              // 75
                                                                                                // 76
base64Decode = function (str) {                                                                 // 77
  var len = Math.floor((str.length*3)/4);                                                       // 78
  if (str.charAt(str.length - 1) == '=') {                                                      // 79
    len--;                                                                                      // 80
    if (str.charAt(str.length - 2) == '=')                                                      // 81
      len--;                                                                                    // 82
  }                                                                                             // 83
  var arr = EJSON.newBinary(len);                                                               // 84
                                                                                                // 85
  var one = null;                                                                               // 86
  var two = null;                                                                               // 87
  var three = null;                                                                             // 88
                                                                                                // 89
  var j = 0;                                                                                    // 90
                                                                                                // 91
  for (var i = 0; i < str.length; i++) {                                                        // 92
    var c = str.charAt(i);                                                                      // 93
    var v = getVal(c);                                                                          // 94
    switch (i % 4) {                                                                            // 95
    case 0:                                                                                     // 96
      if (v < 0)                                                                                // 97
        throw new Error('invalid base64 string');                                               // 98
      one = v << 2;                                                                             // 99
      break;                                                                                    // 100
    case 1:                                                                                     // 101
      if (v < 0)                                                                                // 102
        throw new Error('invalid base64 string');                                               // 103
      one = one | (v >> 4);                                                                     // 104
      arr[j++] = one;                                                                           // 105
      two = (v & 0x0F) << 4;                                                                    // 106
      break;                                                                                    // 107
    case 2:                                                                                     // 108
      if (v >= 0) {                                                                             // 109
        two = two | (v >> 2);                                                                   // 110
        arr[j++] = two;                                                                         // 111
        three = (v & 0x03) << 6;                                                                // 112
      }                                                                                         // 113
      break;                                                                                    // 114
    case 3:                                                                                     // 115
      if (v >= 0) {                                                                             // 116
        arr[j++] = three | v;                                                                   // 117
      }                                                                                         // 118
      break;                                                                                    // 119
    }                                                                                           // 120
  }                                                                                             // 121
  return arr;                                                                                   // 122
};                                                                                              // 123
                                                                                                // 124
EJSONTest.base64Encode = base64Encode;                                                          // 125
                                                                                                // 126
EJSONTest.base64Decode = base64Decode;                                                          // 127
                                                                                                // 128
//////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.ejson = {
  EJSON: EJSON,
  EJSONTest: EJSONTest
};

})();
