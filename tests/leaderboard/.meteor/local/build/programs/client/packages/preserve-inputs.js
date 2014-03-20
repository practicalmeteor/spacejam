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

(function () {

///////////////////////////////////////////////////////////////////////
//                                                                   //
// packages/preserve-inputs/preserve-inputs.js                       //
//                                                                   //
///////////////////////////////////////////////////////////////////////
                                                                     //
var inputTags = 'input textarea button select option'.split(' ');    // 1
                                                                     // 2
var selector = _.map(inputTags, function (t) {                       // 3
  return t.replace(/^.*$/, '$&[id], $&[name]');                      // 4
}).join(', ');                                                       // 5
                                                                     // 6
Spark._addGlobalPreserve(selector, Spark._labelFromIdOrName);        // 7
                                                                     // 8
///////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package['preserve-inputs'] = {};

})();

//# sourceMappingURL=7b3b8bf0669f1f110126607ecd8488f719344f09.map
