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
var _ = Package.underscore._;
var Spark = Package.spark.Spark;

/* Package-scope variables */
var Handlebars;

(function () {

///////////////////////////////////////////////////////////////////////////////////////
//                                                                                   //
// packages/handlebars/evaluate-handlebars.js                                        //
//                                                                                   //
///////////////////////////////////////////////////////////////////////////////////////
                                                                                     //
Handlebars = {};                                                                     // 1
                                                                                     // 2
// XXX we probably forgot to implement the #foo case where foo is not                // 3
// a helper (and similarly the ^foo case)                                            // 4
                                                                                     // 5
// XXX there is a ton of stuff that needs testing! like,                             // 6
// everything. including the '..' stuff.                                             // 7
                                                                                     // 8
Handlebars.json_ast_to_func = function (ast) {                                       // 9
  return function (data, options) {                                                  // 10
    return Handlebars.evaluate(ast, data, options);                                  // 11
  };                                                                                 // 12
};                                                                                   // 13
                                                                                     // 14
// If minimongo is available (it's a weak dependency) use its ID stringifier to      // 15
// label branches (so that, eg, ObjectId and strings don't overlap). Otherwise       // 16
// just use the identity function.                                                   // 17
var idStringify = Package.minimongo                                                  // 18
  ? Package.minimongo.LocalCollection._idStringify                                   // 19
  : function (id) { return id; };                                                    // 20
                                                                                     // 21
// block helpers take:                                                               // 22
// (N args), options (hash args, plus 'fn' and 'inverse')                            // 23
// and return text                                                                   // 24
//                                                                                   // 25
// normal helpers take:                                                              // 26
// (N args), options (hash args)                                                     // 27
//                                                                                   // 28
// partials take one argument, data                                                  // 29
                                                                                     // 30
// XXX handlebars' format for arguments is not the clearest, likely                  // 31
// for backwards compatibility to mustache. eg, options ===                          // 32
// options.fn. take the opportunity to clean this up. treat block                    // 33
// arguments (fn, inverse) as just another kind of argument, same as                 // 34
// what is passed in via named arguments.                                            // 35
Handlebars._default_helpers = {                                                      // 36
  'with': function (data, options) {                                                 // 37
    if (!data || (data instanceof Array && !data.length))                            // 38
      return options.inverse(this);                                                  // 39
    else                                                                             // 40
      return options.fn(data);                                                       // 41
  },                                                                                 // 42
  'each': function (data, options) {                                                 // 43
    var parentData = this;                                                           // 44
    if (data && data.length > 0)                                                     // 45
      return _.map(data, function(x, i) {                                            // 46
        // infer a branch key from the data                                          // 47
        var branch = ((x && x._id && idStringify(x._id)) ||                          // 48
                      (typeof x === 'string' ? x : null) ||                          // 49
                      Spark.UNIQUE_LABEL);                                           // 50
        return Spark.labelBranch(branch, function() {                                // 51
          return options.fn(x);                                                      // 52
        });                                                                          // 53
      }).join('');                                                                   // 54
    else                                                                             // 55
      return Spark.labelBranch(                                                      // 56
        'else',                                                                      // 57
        function () {                                                                // 58
          return options.inverse(parentData);                                        // 59
        });                                                                          // 60
  },                                                                                 // 61
  'if': function (data, options) {                                                   // 62
    if (!data || (data instanceof Array && !data.length))                            // 63
      return options.inverse(this);                                                  // 64
    else                                                                             // 65
      return options.fn(this);                                                       // 66
  },                                                                                 // 67
  'unless': function (data, options) {                                               // 68
    if (!data || (data instanceof Array && !data.length))                            // 69
      return options.fn(this);                                                       // 70
    else                                                                             // 71
      return options.inverse(this);                                                  // 72
  }                                                                                  // 73
};                                                                                   // 74
                                                                                     // 75
Handlebars.registerHelper = function (name, func) {                                  // 76
  if (name in Handlebars._default_helpers)                                           // 77
    throw new Error("There is already a helper '" + name + "'");                     // 78
  Handlebars._default_helpers[name] = func;                                          // 79
};                                                                                   // 80
                                                                                     // 81
// Utility to HTML-escape a string.                                                  // 82
Handlebars._escape = (function() {                                                   // 83
  var escape_map = {                                                                 // 84
    "<": "&lt;",                                                                     // 85
    ">": "&gt;",                                                                     // 86
    '"': "&quot;",                                                                   // 87
    "'": "&#x27;",                                                                   // 88
    "`": "&#x60;", /* IE allows backtick-delimited attributes?? */                   // 89
    "&": "&amp;"                                                                     // 90
  };                                                                                 // 91
  var escape_one = function(c) {                                                     // 92
    return escape_map[c];                                                            // 93
  };                                                                                 // 94
                                                                                     // 95
  return function (x) {                                                              // 96
    return x.replace(/[&<>"'`]/g, escape_one);                                       // 97
  };                                                                                 // 98
})();                                                                                // 99
                                                                                     // 100
// be able to recognize default "this", which is different in different environments // 101
Handlebars._defaultThis = (function() { return this; })();                           // 102
                                                                                     // 103
Handlebars.evaluate = function (ast, data, options) {                                // 104
  options = options || {};                                                           // 105
  var helpers = _.extend({}, Handlebars._default_helpers);                           // 106
  _.extend(helpers, options.helpers || {});                                          // 107
  var partials = options.partials || {};                                             // 108
                                                                                     // 109
  // re 'stack' arguments: top of stack is the current data to use for               // 110
  // the template. higher levels are the data referenced by                          // 111
  // identifiers with one or more '..' segments. we have to keep the                 // 112
  // stack pure-functional style, with a tree rather than an array,                  // 113
  // because we want to continue to allow block helpers provided by                  // 114
  // the user to capture their subtemplate rendering functions and                   // 115
  // call them later, after we've finished running (for eg findLive.)                // 116
  // maybe revisit later.                                                            // 117
                                                                                     // 118
  var eval_value = function (stack, id) {                                            // 119
    if (typeof(id) !== "object")                                                     // 120
      return id;                                                                     // 121
                                                                                     // 122
    // follow '..' in {{../../foo.bar}}                                              // 123
    for (var i = 0; i < id[0]; i++) {                                                // 124
      if (!stack.parent)                                                             // 125
        throw new Error("Too many '..' segments");                                   // 126
      else                                                                           // 127
        stack = stack.parent;                                                        // 128
    }                                                                                // 129
                                                                                     // 130
    if (id.length === 1)                                                             // 131
      // no name: {{this}}, {{..}}, {{../..}}                                        // 132
      return stack.data;                                                             // 133
                                                                                     // 134
    var scopedToContext = false;                                                     // 135
    if (id[1] === '') {                                                              // 136
      // an empty path segment is our AST's way of encoding                          // 137
      // the presence of 'this.' at the beginning of the path.                       // 138
      id = id.slice();                                                               // 139
      id.splice(1, 1); // remove the ''                                              // 140
      scopedToContext = true;                                                        // 141
    }                                                                                // 142
                                                                                     // 143
    // when calling functions (helpers/methods/getters), dataThis                    // 144
    // tracks what to use for `this`.  For helpers, it's the                         // 145
    // current data context.  For getters and methods on the data                    // 146
    // context object, and on the return value of a helper, it's                     // 147
    // the object where we got the getter or method.                                 // 148
    var dataThis = stack.data;                                                       // 149
                                                                                     // 150
    var data;                                                                        // 151
    if (id[0] === 0 && helpers.hasOwnProperty(id[1]) && ! scopedToContext) {         // 152
      // first path segment is a helper                                              // 153
      data = helpers[id[1]];                                                         // 154
    } else {                                                                         // 155
      if ((! data instanceof Object) &&                                              // 156
          (typeof (function() {})[id[1]] !== 'undefined') &&                         // 157
          ! scopedToContext) {                                                       // 158
        // Give a helpful error message if the user tried to name                    // 159
        // a helper 'name', 'length', or some other built-in property                // 160
        // of function objects.  Unfortunately, this case is very                    // 161
        // hard to detect, as Template.foo.name = ... will fail silently,            // 162
        // and {{name}} will be silently empty if the property doesn't               // 163
        // exist (per Handlebars rules).                                             // 164
        // However, if there is no data context at all, we jump in.                  // 165
        throw new Error("Can't call a helper '"+id[1]+"' because "+                  // 166
                        "it is a built-in function property in JavaScript");         // 167
      }                                                                              // 168
      // first path segment is property of data context                              // 169
      data = (stack.data && stack.data[id[1]]);                                      // 170
    }                                                                                // 171
                                                                                     // 172
    // handle dots, as in {{foo.bar}}                                                // 173
    for (var i = 2; i < id.length; i++) {                                            // 174
      // Call functions when taking the dot, to support                              // 175
      // for example currentUser.name.                                               // 176
      //                                                                             // 177
      // In the case of {{foo.bar}}, we end up returning one of:                     // 178
      // - helpers.foo.bar                                                           // 179
      // - helpers.foo().bar                                                         // 180
      // - stack.data.foo.bar                                                        // 181
      // - stack.data.foo().bar.                                                     // 182
      //                                                                             // 183
      // The caller does the final application with any                              // 184
      // arguments, as in {{foo.bar arg1 arg2}}, and passes                          // 185
      // the current data context in `this`.  Therefore,                             // 186
      // we use the current data context (`helperThis`)                              // 187
      // for all function calls.                                                     // 188
      if (typeof data === 'function') {                                              // 189
        data = data.call(dataThis);                                                  // 190
        dataThis = data;                                                             // 191
      }                                                                              // 192
      if (data === undefined || data === null) {                                     // 193
        // Handlebars fails silently and returns "" if                               // 194
        // we start to access properties that don't exist.                           // 195
        data = '';                                                                   // 196
        break;                                                                       // 197
      }                                                                              // 198
                                                                                     // 199
      data = data[id[i]];                                                            // 200
    }                                                                                // 201
                                                                                     // 202
    // ensure `this` is bound appropriately when the caller                          // 203
    // invokes `data` with any arguments.  For example,                              // 204
    // in {{foo.bar baz}}, the caller must supply `baz`,                             // 205
    // but we alone have `foo` (in `dataThis`).                                      // 206
    if (typeof data === 'function')                                                  // 207
      return _.bind(data, dataThis);                                                 // 208
                                                                                     // 209
    return data;                                                                     // 210
  };                                                                                 // 211
                                                                                     // 212
  // 'extra' will be clobbered, but not 'params'.                                    // 213
  // if (isNested), evaluate params.slice(1) as a nested                             // 214
  // helper invocation if there is at least one positional                           // 215
  // argument.  This is used for block helpers.                                      // 216
  var invoke = function (stack, params, extra, isNested) {                           // 217
    extra = extra || {};                                                             // 218
    params = params.slice(0);                                                        // 219
                                                                                     // 220
    // remove hash (dictionary of keyword arguments) from                            // 221
    // the end of params, if present.                                                // 222
    var last = params[params.length - 1];                                            // 223
    var hash = {};                                                                   // 224
    if (typeof(last) === "object" && !(last instanceof Array)) {                     // 225
      // evaluate hash values, which are found as invocations                        // 226
      // like [0, "foo"]                                                             // 227
      _.each(params.pop(), function(v,k) {                                           // 228
        var result = eval_value(stack, v);                                           // 229
        hash[k] = (typeof result === "function" ? result() : result);                // 230
      });                                                                            // 231
    }                                                                                // 232
                                                                                     // 233
    var apply = function (values, extra) {                                           // 234
      var args = values.slice(1);                                                    // 235
      for(var i=0; i<args.length; i++)                                               // 236
        if (typeof args[i] === "function")                                           // 237
          args[i] = args[i](); // `this` already bound by eval_value                 // 238
      if (extra)                                                                     // 239
        args.push(extra);                                                            // 240
      return values[0].apply(stack.data, args);                                      // 241
    };                                                                               // 242
                                                                                     // 243
    var values = new Array(params.length);                                           // 244
    for(var i=0; i<params.length; i++)                                               // 245
      values[i] = eval_value(stack, params[i]);                                      // 246
                                                                                     // 247
    if (typeof(values[0]) !== "function")                                            // 248
      return values[0];                                                              // 249
                                                                                     // 250
    if (isNested && values.length > 1) {                                             // 251
      // at least one positional argument; not no args                               // 252
      // or only hash args.                                                          // 253
      var oneArg = values[1];                                                        // 254
      if (typeof oneArg === "function")                                              // 255
        // invoke the positional arguments                                           // 256
        // (and hash arguments) as a nested helper invocation.                       // 257
        oneArg = apply(values.slice(1), {hash:hash});                                // 258
      values = [values[0], oneArg];                                                  // 259
      // keyword args don't go to the block helper, then.                            // 260
      extra.hash = {};                                                               // 261
    } else {                                                                         // 262
      extra.hash = hash;                                                             // 263
    }                                                                                // 264
                                                                                     // 265
    return apply(values, extra);                                                     // 266
  };                                                                                 // 267
                                                                                     // 268
  var template = function (stack, elts, basePCKey) {                                 // 269
    var buf = [];                                                                    // 270
                                                                                     // 271
    var toString = function (x) {                                                    // 272
      if (typeof x === "string") return x;                                           // 273
      // May want to revisit the following one day                                   // 274
      if (x === null) return "null";                                                 // 275
      if (x === undefined) return "";                                                // 276
      return x.toString();                                                           // 277
    };                                                                               // 278
                                                                                     // 279
    // wrap `fn` and `inverse` blocks in chunks having `data`, if the data           // 280
    // is different from the enclosing data, so that the data is available           // 281
    // at runtime for events.                                                        // 282
    var decorateBlockFn = function(fn, old_data) {                                   // 283
      return function(data) {                                                        // 284
        // don't create spurious annotations when data is same                       // 285
        // as before (or when transitioning between e.g. `window` and                // 286
        // `undefined`)                                                              // 287
        if ((data || Handlebars._defaultThis) ===                                    // 288
            (old_data || Handlebars._defaultThis))                                   // 289
          return fn(data);                                                           // 290
        else                                                                         // 291
          return Spark.setDataContext(data, fn(data));                               // 292
      };                                                                             // 293
    };                                                                               // 294
                                                                                     // 295
    // Handle the return value of a {{helper}}.                                      // 296
    // Takes a:                                                                      // 297
    //   string - escapes it                                                         // 298
    //   SafeString - returns the underlying string unescaped                        // 299
    //   other value - coerces to a string and escapes it                            // 300
    var maybeEscape = function(x) {                                                  // 301
      if (x instanceof Handlebars.SafeString)                                        // 302
        return x.toString();                                                         // 303
      return Handlebars._escape(toString(x));                                        // 304
    };                                                                               // 305
                                                                                     // 306
    var curIndex;                                                                    // 307
    // Construct a unique key for the current position                               // 308
    // in the AST.  Since template(...) is invoked recursively,                      // 309
    // the "PC" (program counter) key is hierarchical, consisting                    // 310
    // of one or more numbers, for example '0' or '1.3.0.1'.                         // 311
    var getPCKey = function() {                                                      // 312
      return (basePCKey ? basePCKey+'.' : '') + curIndex;                            // 313
    };                                                                               // 314
    var branch = function(name, func) {                                              // 315
      // Construct a unique branch identifier based on what partial                  // 316
      // we're in, what partial or helper we're calling, and our index               // 317
      // into the template AST (essentially the program counter).                    // 318
      // If "foo" calls "bar" at index 3, it looks like: bar@foo#3.                  // 319
      return Spark.labelBranch(name + "@" + getPCKey(), func);                       // 320
    };                                                                               // 321
                                                                                     // 322
    _.each(elts, function (elt, index) {                                             // 323
      curIndex = index;                                                              // 324
      if (typeof(elt) === "string")                                                  // 325
        buf.push(elt);                                                               // 326
      else if (elt[0] === '{')                                                       // 327
        // {{double stache}}                                                         // 328
        buf.push(branch(elt[1], function () {                                        // 329
          return maybeEscape(invoke(stack, elt[1]));                                 // 330
        }));                                                                         // 331
      else if (elt[0] === '!')                                                       // 332
        // {{{triple stache}}}                                                       // 333
        buf.push(branch(elt[1], function () {                                        // 334
          return toString(invoke(stack, elt[1] || ''));                              // 335
        }));                                                                         // 336
      else if (elt[0] === '#') {                                                     // 337
        // {{#block helper}}                                                         // 338
        var pcKey = getPCKey();                                                      // 339
        var block = decorateBlockFn(                                                 // 340
          function (data) {                                                          // 341
            return template({parent: stack, data: data}, elt[2], pcKey);             // 342
          }, stack.data);                                                            // 343
        block.fn = block;                                                            // 344
        block.inverse = decorateBlockFn(                                             // 345
          function (data) {                                                          // 346
            return template({parent: stack, data: data}, elt[3] || [], pcKey);       // 347
          }, stack.data);                                                            // 348
        var html = branch(elt[1], function () {                                      // 349
          return toString(invoke(stack, elt[1], block, true));                       // 350
        });                                                                          // 351
        buf.push(html);                                                              // 352
      } else if (elt[0] === '>') {                                                   // 353
        // {{> partial}}                                                             // 354
        var partialName = elt[1];                                                    // 355
        if (!(partialName in partials))                                              // 356
          // XXX why do we call these templates in docs and partials in code?        // 357
          throw new Error("No such template '" + partialName + "'");                 // 358
        // call the partial                                                          // 359
        var html = branch(partialName, function () {                                 // 360
          return toString(partials[partialName](stack.data));                        // 361
        });                                                                          // 362
        buf.push(html);                                                              // 363
      } else                                                                         // 364
        throw new Error("bad element in template");                                  // 365
    });                                                                              // 366
                                                                                     // 367
    return buf.join('');                                                             // 368
  };                                                                                 // 369
                                                                                     // 370
  // Set the prefix for PC keys, which identify call sites in the AST                // 371
  // for the purpose of chunk matching.                                              // 372
  // `options.name` will be null in the body, but otherwise have a value,            // 373
  // assuming `options` was assembled in templating/deftemplate.js.                  // 374
  var rootPCKey = (options.name||"")+"#";                                            // 375
                                                                                     // 376
  return template({data: data, parent: null}, ast, rootPCKey);                       // 377
};                                                                                   // 378
                                                                                     // 379
Handlebars.SafeString = function(string) {                                           // 380
  this.string = string;                                                              // 381
};                                                                                   // 382
Handlebars.SafeString.prototype.toString = function() {                              // 383
  return this.string.toString();                                                     // 384
};                                                                                   // 385
                                                                                     // 386
///////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.handlebars = {
  Handlebars: Handlebars
};

})();

//# sourceMappingURL=c2b75d49875b4cfcc7544447aad117fd81fccf3b.map
