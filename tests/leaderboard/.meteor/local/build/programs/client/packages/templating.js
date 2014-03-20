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
var Handlebars = Package.handlebars.Handlebars;

/* Package-scope variables */
var Template;

(function () {

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// packages/templating/deftemplate.js                                                      //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
Template = {};                                                                             // 1
                                                                                           // 2
var registeredPartials = {};                                                               // 3
                                                                                           // 4
// If minimongo is available (it's a weak dependency) use its ID stringifier to            // 5
// label branches (so that, eg, ObjectId and strings don't overlap). Otherwise             // 6
// just use the identity function.                                                         // 7
var idStringify = Package.minimongo                                                        // 8
  ? Package.minimongo.LocalCollection._idStringify                                         // 9
  : function (id) { return id; };                                                          // 10
                                                                                           // 11
// XXX Handlebars hooking is janky and gross                                               // 12
var hookHandlebars = function () {                                                         // 13
  hookHandlebars = function(){}; // install the hook only once                             // 14
                                                                                           // 15
  var orig = Handlebars._default_helpers.each;                                             // 16
  Handlebars._default_helpers.each = function (arg, options) {                             // 17
    var isArgValid = function () {                                                         // 18
      return !arg // falsey                                                                // 19
        || (arg instanceof Array)                                                          // 20
        || (arg instanceof Object && 'observeChanges' in arg);                             // 21
    };                                                                                     // 22
    if (!isArgValid())                                                                     // 23
      throw new Error("{{#each}} only accepts arrays, cursors, or falsey "                 // 24
                      + "values. You passed: " + arg);                                     // 25
                                                                                           // 26
    // if arg isn't an observable (like LocalCollection.Cursor),                           // 27
    // don't use this reactive implementation of #each.                                    // 28
    if (!(arg && 'observeChanges' in arg))                                                 // 29
      return orig.call(this, arg, options);                                                // 30
                                                                                           // 31
    return Spark.list(                                                                     // 32
      arg,                                                                                 // 33
      function (item) {                                                                    // 34
        return Spark.labelBranch(                                                          // 35
          (item && item._id && idStringify(item._id)) || Spark.UNIQUE_LABEL, function () { // 36
            var html = Spark.isolate(_.bind(options.fn, null, item));                      // 37
            return Spark.setDataContext(item, html);                                       // 38
          });                                                                              // 39
      },                                                                                   // 40
      function () {                                                                        // 41
        return options.inverse ?                                                           // 42
          Spark.isolate(options.inverse) : '';                                             // 43
      }                                                                                    // 44
    );                                                                                     // 45
  };                                                                                       // 46
                                                                                           // 47
  _.extend(Handlebars._default_helpers, {                                                  // 48
    isolate: function (options) {                                                          // 49
      var data = this;                                                                     // 50
      return Spark.isolate(function () {                                                   // 51
        return options.fn(data);                                                           // 52
      });                                                                                  // 53
    },                                                                                     // 54
    constant: function (options) {                                                         // 55
      var data = this;                                                                     // 56
      return Spark.createLandmark({ constant: true }, function () {                        // 57
        return options.fn(data);                                                           // 58
      });                                                                                  // 59
    }                                                                                      // 60
  });                                                                                      // 61
};                                                                                         // 62
                                                                                           // 63
// map from landmark id, to the 'this' object for                                          // 64
// created/rendered/destroyed callbacks on templates                                       // 65
var templateInstanceData = {};                                                             // 66
                                                                                           // 67
var templateObjFromLandmark = function (landmark) {                                        // 68
  var template = templateInstanceData[landmark.id] || (                                    // 69
    templateInstanceData[landmark.id] = {                                                  // 70
      // set these once                                                                    // 71
      find: function (selector) {                                                          // 72
        if (! landmark.hasDom())                                                           // 73
          throw new Error("Template not in DOM");                                          // 74
        return landmark.find(selector);                                                    // 75
      },                                                                                   // 76
      findAll: function (selector) {                                                       // 77
        if (! landmark.hasDom())                                                           // 78
          throw new Error("Template not in DOM");                                          // 79
        return landmark.findAll(selector);                                                 // 80
      }                                                                                    // 81
    });                                                                                    // 82
  // set these each time                                                                   // 83
  template.firstNode = landmark.hasDom() ? landmark.firstNode() : null;                    // 84
  template.lastNode = landmark.hasDom() ? landmark.lastNode() : null;                      // 85
  return template;                                                                         // 86
};                                                                                         // 87
                                                                                           // 88
// XXX forms hooks into this to add "bind"?                                                // 89
var templateBase = {                                                                       // 90
  // methods store data here (event map, etc.).  initialized per template.                 // 91
  _tmpl_data: null,                                                                        // 92
  // these functions must be generic (i.e. use `this`)                                     // 93
  events: function (eventMap) {                                                            // 94
    var events =                                                                           // 95
          (this._tmpl_data.events = (this._tmpl_data.events || {}));                       // 96
    _.each(eventMap, function(callback, spec) {                                            // 97
      events[spec] = (events[spec] || []);                                                 // 98
      events[spec].push(callback);                                                         // 99
    });                                                                                    // 100
  },                                                                                       // 101
  preserve: function (preserveMap) {                                                       // 102
    var preserve =                                                                         // 103
          (this._tmpl_data.preserve = (this._tmpl_data.preserve || {}));                   // 104
                                                                                           // 105
    if (_.isArray(preserveMap))                                                            // 106
      _.each(preserveMap, function (selector) {                                            // 107
        preserve[selector] = true;                                                         // 108
      });                                                                                  // 109
    else                                                                                   // 110
      _.extend(preserve, preserveMap);                                                     // 111
  },                                                                                       // 112
  helpers: function (helperMap) {                                                          // 113
    var helpers =                                                                          // 114
          (this._tmpl_data.helpers = (this._tmpl_data.helpers || {}));                     // 115
    for(var h in helperMap)                                                                // 116
      helpers[h] = helperMap[h];                                                           // 117
  }                                                                                        // 118
};                                                                                         // 119
                                                                                           // 120
Template.__define__ = function (name, raw_func) {                                          // 121
  hookHandlebars();                                                                        // 122
                                                                                           // 123
  if (name === '__define__')                                                               // 124
    throw new Error("Sorry, '__define__' is a special name and " +                         // 125
                    "cannot be used as the name of a template");                           // 126
                                                                                           // 127
  // Define the function assigned to Template.<name>.                                      // 128
                                                                                           // 129
  var partial = function (data) {                                                          // 130
    var tmpl = name && Template[name] || {};                                               // 131
    var tmplData = tmpl._tmpl_data || {};                                                  // 132
                                                                                           // 133
    var html = Spark.labelBranch("Template."+name, function () {                           // 134
      var html = Spark.createLandmark({                                                    // 135
        preserve: tmplData.preserve || {},                                                 // 136
        created: function () {                                                             // 137
          var template = templateObjFromLandmark(this);                                    // 138
          template.data = data;                                                            // 139
          tmpl.created && tmpl.created.call(template);                                     // 140
        },                                                                                 // 141
        rendered: function () {                                                            // 142
          var template = templateObjFromLandmark(this);                                    // 143
          template.data = data;                                                            // 144
          tmpl.rendered && tmpl.rendered.call(template);                                   // 145
        },                                                                                 // 146
        destroyed: function () {                                                           // 147
          // template.data is already set from previous callbacks                          // 148
          tmpl.destroyed &&                                                                // 149
            tmpl.destroyed.call(templateObjFromLandmark(this));                            // 150
          delete templateInstanceData[this.id];                                            // 151
        }                                                                                  // 152
      }, function (landmark) {                                                             // 153
        var html = Spark.isolate(function () {                                             // 154
          // XXX Forms needs to run a hook before and after raw_func                       // 155
          // (and receive 'landmark')                                                      // 156
          return raw_func(data, {                                                          // 157
            helpers: _.extend({}, partial, tmplData.helpers || {}),                        // 158
            partials: registeredPartials,                                                  // 159
            name: name                                                                     // 160
          });                                                                              // 161
        });                                                                                // 162
                                                                                           // 163
        // take an event map with `function (event, template)` handlers                    // 164
        // and produce one with `function (event, landmark)` handlers                      // 165
        // for Spark, by inserting logic to create the template object.                    // 166
        var wrapEventMap = function (oldEventMap) {                                        // 167
          var newEventMap = {};                                                            // 168
          _.each(oldEventMap, function (handlers, key) {                                   // 169
            if ('function' === typeof handlers) {                                          // 170
              //Template.foo.events = ... way will give a fn, not an array                 // 171
              handlers = [ handlers ];                                                     // 172
            }                                                                              // 173
            newEventMap[key] = _.map(handlers, function (handler) {                        // 174
              return function (event, landmark) {                                          // 175
                return handler.call(this, event,                                           // 176
                                    templateObjFromLandmark(landmark));                    // 177
              };                                                                           // 178
            });                                                                            // 179
          });                                                                              // 180
          return newEventMap;                                                              // 181
        };                                                                                 // 182
                                                                                           // 183
        // support old Template.foo.events = {...} format                                  // 184
        var events =                                                                       // 185
              (tmpl.events !== templateBase.events ?                                       // 186
               tmpl.events : tmplData.events);                                             // 187
        // events need to be inside the landmark, not outside, so                          // 188
        // that when an event fires, you can retrieve the enclosing                        // 189
        // landmark to get the template data                                               // 190
        if (tmpl.events)                                                                   // 191
          html = Spark.attachEvents(wrapEventMap(events), html);                           // 192
        return html;                                                                       // 193
      });                                                                                  // 194
      html = Spark.setDataContext(data, html);                                             // 195
      return html;                                                                         // 196
    });                                                                                    // 197
                                                                                           // 198
    return html;                                                                           // 199
  };                                                                                       // 200
                                                                                           // 201
  // XXX hack.. copy all of Handlebars' built in helpers over to                           // 202
  // the partial. it would be better to hook helperMissing (or                             // 203
  // something like that?) so that Template.foo is searched only                           // 204
  // if it's not a built-in helper.                                                        // 205
  _.extend(partial, Handlebars.helpers);                                                   // 206
                                                                                           // 207
                                                                                           // 208
  if (name) {                                                                              // 209
    if (Template[name])                                                                    // 210
      throw new Error("There are multiple templates named '" + name +                      // 211
                      "'. Each template needs a unique name.");                            // 212
                                                                                           // 213
    Template[name] = partial;                                                              // 214
    _.extend(partial, templateBase);                                                       // 215
    partial._tmpl_data = {};                                                               // 216
                                                                                           // 217
    registeredPartials[name] = partial;                                                    // 218
  }                                                                                        // 219
                                                                                           // 220
  // useful for unnamed templates, like body                                               // 221
  return partial;                                                                          // 222
};                                                                                         // 223
                                                                                           // 224
/////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.templating = {
  Template: Template
};

})();

//# sourceMappingURL=5944cd5e16b26fbf83959a0fe92d7754029a624d.map
