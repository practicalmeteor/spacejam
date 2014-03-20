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
var $ = Package.jquery.$;
var jQuery = Package.jquery.jQuery;
var _ = Package.underscore._;

/* Package-scope variables */
var DomUtils;

(function () {

//////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                              //
// packages/domutils/domutils.js                                                                //
//                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                //
DomUtils = {};                                                                                  // 1
                                                                                                // 2
var qsaFindAllBySelector = function (selector, contextNode) {                                   // 3
  // If IE7 users report the following error message, you                                       // 4
  // can fix it with "meteor add jquery".                                                       // 5
  if (! document.querySelectorAll)                                                              // 6
    throw new Error("This browser doesn't support querySelectorAll.");                          // 7
                                                                                                // 8
  // the search is constrained to descendants of `ancestor`,                                    // 9
  // but it doesn't affect the scope of the query.                                              // 10
  var ancestor = contextNode;                                                                   // 11
                                                                                                // 12
  return withElementId(                                                                         // 13
    contextNode, "DomUtils_findAllBySelector_scope",                                            // 14
    function (idSelector) {                                                                     // 15
      // scope the entire selector to contextNode by prepending                                 // 16
      // id of contextNode to the selector.                                                     // 17
      var doctoredSelector = _.map(selector.split(','), function (selec) {                      // 18
        return idSelector + " " + selec;                                                        // 19
      }).join(',');                                                                             // 20
      return ancestor.querySelectorAll(doctoredSelector);                                       // 21
    });                                                                                         // 22
};                                                                                              // 23
                                                                                                // 24
// We have our own, querySelectorAll-based implementation of scoped                             // 25
// selector matching; it's all you need in IE 8+ and modern browsers.                           // 26
//                                                                                              // 27
// However, we use Sizzle or jQuery if it's present on the client because of:                   // 28
// - apps that want jQuery's selector extensions (:visible, :input, etc.)                       // 29
// - apps that include jQuery anyway                                                            // 30
// - apps that want IE 7 support                                                                // 31
//                                                                                              // 32
// XXX others? zepto?                                                                           // 33
var findAllBySelector = (window.Sizzle                                                          // 34
                         || (window.jQuery && window.jQuery.find)                               // 35
                         || qsaFindAllBySelector);                                              // 36
                                                                                                // 37
///// Common look-up tables used by htmlToFragment et al.                                       // 38
                                                                                                // 39
var testDiv = document.createElement("div");                                                    // 40
testDiv.innerHTML = "   <link/><table></table><select><!----></select>";                        // 41
// Need to wrap in a div rather than directly creating SELECT to avoid                          // 42
// *another* IE bug.                                                                            // 43
var testSelectDiv = document.createElement("div");                                              // 44
testSelectDiv.innerHTML = "<select><option selected>Foo</option></select>";                     // 45
testSelectDiv.firstChild.setAttribute("name", "myname");                                        // 46
                                                                                                // 47
// Tests that, if true, indicate browser quirks present.                                        // 48
var quirks = {                                                                                  // 49
  // IE loses initial whitespace when setting innerHTML.                                        // 50
  leadingWhitespaceKilled: (testDiv.firstChild.nodeType !== 3),                                 // 51
                                                                                                // 52
  // IE may insert an empty tbody tag in a table.                                               // 53
  tbodyInsertion: testDiv.getElementsByTagName("tbody").length > 0,                             // 54
                                                                                                // 55
  // IE loses some tags in some environments (requiring extra wrapper).                         // 56
  tagsLost: testDiv.getElementsByTagName("link").length === 0,                                  // 57
                                                                                                // 58
  // IE <= 9 loses HTML comments in <select> and <option> tags.                                 // 59
  commentsLost: (! testDiv.getElementsByTagName("select")[0].firstChild),                       // 60
                                                                                                // 61
  selectValueMustBeFromAttribute: (testSelectDiv.firstChild.value !== "Foo"),                   // 62
                                                                                                // 63
  // In IE7, setAttribute('name', foo) doesn't show up in rendered HTML.                        // 64
  // (In FF3, outerHTML is undefined, but it doesn't have this quirk.)                          // 65
  mustSetNameInCreateElement: (                                                                 // 66
    testSelectDiv.firstChild.outerHTML &&                                                       // 67
      testSelectDiv.firstChild.outerHTML.indexOf("myname") === -1)                              // 68
};                                                                                              // 69
                                                                                                // 70
// Set up map of wrappers for different nodes.                                                  // 71
var wrapMap = {                                                                                 // 72
  option: [ 1, "<select multiple='multiple'>", "</select>" ],                                   // 73
  legend: [ 1, "<fieldset>", "</fieldset>" ],                                                   // 74
  thead: [ 1, "<table>", "</table>" ],                                                          // 75
  tr: [ 2, "<table><tbody>", "</tbody></table>" ],                                              // 76
  td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],                                     // 77
  col: [ 2, "<table><tbody></tbody><colgroup>", "</colgroup></table>" ],                        // 78
  area: [ 1, "<map>", "</map>" ],                                                               // 79
  _default: [ 0, "", "" ]                                                                       // 80
};                                                                                              // 81
_.extend(wrapMap, {                                                                             // 82
  optgroup: wrapMap.option,                                                                     // 83
  tbody: wrapMap.thead,                                                                         // 84
  tfoot: wrapMap.thead,                                                                         // 85
  colgroup: wrapMap.thead,                                                                      // 86
  caption: wrapMap.thead,                                                                       // 87
  th: wrapMap.td                                                                                // 88
});                                                                                             // 89
if (quirks.tagsLost) {                                                                          // 90
  // trick from jquery.  initial text is ignored when we take lastChild.                        // 91
  wrapMap._default = [ 1, "div<div>", "</div>" ];                                               // 92
}                                                                                               // 93
                                                                                                // 94
var rleadingWhitespace = /^\s+/,                                                                // 95
    rxhtmlTag = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/ig,      // 96
    rtagName = /<([\w:]+)/,                                                                     // 97
    rtbody = /<tbody/i,                                                                         // 98
    rhtml = /<|&#?\w+;/,                                                                        // 99
    rnoInnerhtml = /<(?:script|style)/i;                                                        // 100
                                                                                                // 101
                                                                                                // 102
// Parse an HTML string, which may contain multiple top-level tags,                             // 103
// and return a DocumentFragment.                                                               // 104
DomUtils.htmlToFragment = function (html) {                                                     // 105
  var doc = document; // node factory                                                           // 106
  var frag = doc.createDocumentFragment();                                                      // 107
                                                                                                // 108
  if (! html.length) {                                                                          // 109
    // empty, do nothing                                                                        // 110
  } else if (! rhtml.test(html)) {                                                              // 111
    // Just text.                                                                               // 112
    frag.appendChild(doc.createTextNode(html));                                                 // 113
  } else {                                                                                      // 114
    // General case.                                                                            // 115
    // Replace self-closing tags                                                                // 116
    html = html.replace(rxhtmlTag, "<$1></$2>");                                                // 117
    // Use first tag to determine wrapping needed.                                              // 118
    var firstTagMatch = rtagName.exec(html);                                                    // 119
    var firstTag = (firstTagMatch ? firstTagMatch[1].toLowerCase() : "");                       // 120
    var wrapData = wrapMap[firstTag] || wrapMap._default;                                       // 121
    var fullHtml = wrapData[1] + html + wrapData[2];                                            // 122
    if (quirks.commentsLost) {                                                                  // 123
      // rewrite <select> and <option> tags into fake tags                                      // 124
      fullHtml = fullHtml.replace(/<\s*(select|option)\b/ig,                                    // 125
                                  '<ins domutilsrealtagname="$1"');                             // 126
      fullHtml = fullHtml.replace(/<\/\s*(select|option)\b/ig,                                  // 127
                                  '</ins');                                                     // 128
    }                                                                                           // 129
                                                                                                // 130
    var container = doc.createElement("div");                                                   // 131
    // insert wrapped HTML into a DIV                                                           // 132
    container.innerHTML = fullHtml;                                                             // 133
    // set "container" to inner node of wrapper                                                 // 134
    var unwraps = wrapData[0];                                                                  // 135
    while (unwraps--) {                                                                         // 136
      container = container.lastChild;                                                          // 137
    }                                                                                           // 138
                                                                                                // 139
    if (quirks.tbodyInsertion && ! rtbody.test(html)) {                                         // 140
      // Any tbody we find was created by the browser.                                          // 141
      var tbodies = container.getElementsByTagName("tbody");                                    // 142
      _.each(tbodies, function (n) {                                                            // 143
        if (! n.firstChild) {                                                                   // 144
          // spurious empty tbody                                                               // 145
          n.parentNode.removeChild(n);                                                          // 146
        }                                                                                       // 147
      });                                                                                       // 148
    }                                                                                           // 149
                                                                                                // 150
    if (quirks.leadingWhitespaceKilled) {                                                       // 151
      var wsMatch = rleadingWhitespace.exec(html);                                              // 152
      if (wsMatch) {                                                                            // 153
        container.insertBefore(doc.createTextNode(wsMatch[0]),                                  // 154
                               container.firstChild);                                           // 155
      }                                                                                         // 156
    }                                                                                           // 157
                                                                                                // 158
    if (quirks.commentsLost) {                                                                  // 159
      // replace fake select tags with real <select> tags                                       // 160
      var fakeTags = [];                                                                        // 161
      // getElementsByTagName returns a "live" collection, so avoid                             // 162
      // factorings of this code that iterate over it while mutating                            // 163
      // the DOM.                                                                               // 164
      // Here we build an array of fake tags and iterate over that.                             // 165
      _.each(container.getElementsByTagName("ins"), function (ins) {                            // 166
        if (ins.getAttribute("domutilsrealtagname")) {                                          // 167
          fakeTags.push(ins);                                                                   // 168
        }                                                                                       // 169
      });                                                                                       // 170
                                                                                                // 171
      _.each(fakeTags, function (fakeTag) {                                                     // 172
        var tagName = fakeTag.getAttribute('domutilsrealtagname');                              // 173
        if (quirks.mustSetNameInCreateElement &&                                                // 174
            fakeTag.getAttribute('name')) {                                                     // 175
          // IE7 can't set 'name' with setAttribute, but it has this                            // 176
          // crazy syntax for setting it at create time.                                        // 177
          // http://webbugtrack.blogspot.com/2007/10/bug-235-createelement-is-broken-in-ie.html // 178
          // http://msdn.microsoft.com/en-us/library/ms536389.aspx                              // 179
          tagName = "<" + tagName + " name='" +                                                 // 180
            _.escape(fakeTag.getAttribute('name')) + "'/>";                                     // 181
        }                                                                                       // 182
        var realTag = document.createElement(tagName);                                          // 183
        fakeTag.removeAttribute('domutilsrealtagname');                                         // 184
        // copy all attributes. for some reason mergeAttributes doesn't work                    // 185
        // here: eg, it doesn't copy SELECTED or VALUE. (Probably because                       // 186
        // these attributes would be expando on INS?)                                           // 187
        var fakeAttrs = fakeTag.attributes;                                                     // 188
        for (var i = 0; i < fakeAttrs.length; ++i) {                                            // 189
          var fakeAttr = fakeAttrs.item(i);                                                     // 190
          if (fakeAttr.specified) {                                                             // 191
            var name = fakeAttr.name.toLowerCase();                                             // 192
            var value = String(fakeAttr.value);                                                 // 193
            // IE7 gets confused if you try to setAttribute('selected', ''),                    // 194
            // so be a little more explicit.                                                    // 195
            if (name === 'selected' && value === '')                                            // 196
              value = 'selected';                                                               // 197
            realTag.setAttribute(name, value);                                                  // 198
          }                                                                                     // 199
        }                                                                                       // 200
                                                                                                // 201
        // move all children                                                                    // 202
        while (fakeTag.firstChild)                                                              // 203
          realTag.appendChild(fakeTag.firstChild);                                              // 204
        // replace                                                                              // 205
        fakeTag.parentNode.replaceChild(realTag, fakeTag);                                      // 206
      });                                                                                       // 207
    }                                                                                           // 208
                                                                                                // 209
    // Reparent children of container to frag.                                                  // 210
    while (container.firstChild)                                                                // 211
      frag.appendChild(container.firstChild);                                                   // 212
  }                                                                                             // 213
                                                                                                // 214
  return frag;                                                                                  // 215
};                                                                                              // 216
                                                                                                // 217
// Return an HTML string representing the contents of frag,                                     // 218
// a DocumentFragment.  (This is what innerHTML would do if                                     // 219
// it were defined on DocumentFragments.)                                                       // 220
DomUtils.fragmentToHtml = function (frag) {                                                     // 221
  frag = frag.cloneNode(true); // deep copy, don't touch original!                              // 222
                                                                                                // 223
  return DomUtils.fragmentToContainer(frag).innerHTML;                                          // 224
};                                                                                              // 225
                                                                                                // 226
// Given a DocumentFragment, return a node whose children are the                               // 227
// reparented contents of the DocumentFragment.  In most cases this                             // 228
// is as simple as creating a DIV, but in the case of a fragment                                // 229
// containing TRs, for example, it's necessary to create a TABLE and                            // 230
// a TBODY and return the TBODY.                                                                // 231
DomUtils.fragmentToContainer = function (frag) {                                                // 232
  var doc = document; // node factory                                                           // 233
                                                                                                // 234
  var firstElement = frag.firstChild;                                                           // 235
  while (firstElement && firstElement.nodeType !== 1) {                                         // 236
    firstElement = firstElement.nextSibling;                                                    // 237
  }                                                                                             // 238
                                                                                                // 239
  var container = doc.createElement("div");                                                     // 240
                                                                                                // 241
  if (! firstElement) {                                                                         // 242
    // no tags!                                                                                 // 243
    container.appendChild(frag);                                                                // 244
  } else {                                                                                      // 245
    var firstTag = firstElement.nodeName;                                                       // 246
    var wrapData = wrapMap[firstTag] || wrapMap._default;                                       // 247
                                                                                                // 248
    container.innerHTML = wrapData[1] + wrapData[2];                                            // 249
    var unwraps = wrapData[0];                                                                  // 250
    while (unwraps--) {                                                                         // 251
      container = container.lastChild;                                                          // 252
    }                                                                                           // 253
                                                                                                // 254
    container.appendChild(frag);                                                                // 255
  }                                                                                             // 256
                                                                                                // 257
  return container;                                                                             // 258
};                                                                                              // 259
                                                                                                // 260
// Returns true if element a contains node b and is not node b.                                 // 261
DomUtils.elementContains = function (a, b) {                                                    // 262
  if (a.nodeType !== 1) /* ELEMENT */                                                           // 263
    return false;                                                                               // 264
  if (a === b)                                                                                  // 265
    return false;                                                                               // 266
                                                                                                // 267
  if (a.compareDocumentPosition) {                                                              // 268
    return a.compareDocumentPosition(b) & 0x10;                                                 // 269
  } else {                                                                                      // 270
    // Should be only old IE and maybe other old browsers here.                                 // 271
    // Modern Safari has both functions but seems to get contains() wrong.                      // 272
    // IE can't handle b being a text node.  We work around this                                // 273
    // by doing a direct parent test now.                                                       // 274
    b = b.parentNode;                                                                           // 275
    if (! (b && b.nodeType === 1)) /* ELEMENT */                                                // 276
      return false;                                                                             // 277
    if (a === b)                                                                                // 278
      return true;                                                                              // 279
                                                                                                // 280
    return a.contains(b);                                                                       // 281
  }                                                                                             // 282
};                                                                                              // 283
                                                                                                // 284
// Returns an array containing the children of contextNode that                                 // 285
// match `selector`. Unlike querySelectorAll, `selector` is                                     // 286
// interpreted as if the document were rooted at `contextNode` --                               // 287
// the only nodes that can be used to match components of the                                   // 288
// selector are the descendents of `contextNode`. `contextNode`                                 // 289
// itself is not included (it can't be used to match a component of                             // 290
// the selector, and it can never be included in the returned                                   // 291
// array.)                                                                                      // 292
//                                                                                              // 293
// `contextNode` may be either a node, a document, or a DocumentFragment.                       // 294
DomUtils.findAll = function (contextNode, selector) {                                           // 295
  if (contextNode.nodeType === 11 /* DocumentFragment */) {                                     // 296
    // contextNode is a DocumentFragment.                                                       // 297
    //                                                                                          // 298
    // We don't expect to be able to run selectors on a DocumentFragment                        // 299
    // (Sizzle won't work) but we can on a normal elements that aren't                          // 300
    // in the document.  Fortunately we can manipulate offscreen nodes                          // 301
    // as much as we want as long as we put them back the way they were                         // 302
    // when we're done.                                                                         // 303
    var frag = contextNode;                                                                     // 304
    var container = DomUtils.fragmentToContainer(frag);                                         // 305
    var results = findAllBySelector(selector, container);                                       // 306
    // put nodes back into frag                                                                 // 307
    while (container.firstChild)                                                                // 308
      frag.appendChild(container.firstChild);                                                   // 309
    return results;                                                                             // 310
  }                                                                                             // 311
                                                                                                // 312
  return findAllBySelector(selector, contextNode);                                              // 313
};                                                                                              // 314
                                                                                                // 315
// Like `findAll` but finds one element (or returns null).                                      // 316
DomUtils.find = function (contextNode, selector) {                                              // 317
  var results = DomUtils.findAll(contextNode, selector);                                        // 318
  return (results.length ? results[0] : null);                                                  // 319
};                                                                                              // 320
                                                                                                // 321
var isElementInClipRange = function (elem, clipStart, clipEnd) {                                // 322
  // elem is not in clip range if it contains the clip range                                    // 323
  if (DomUtils.elementContains(elem, clipStart))                                                // 324
    return false;                                                                               // 325
  // elem is in clip range if clipStart <= elem <= clipEnd                                      // 326
  return (DomUtils.compareElementIndex(clipStart, elem) <= 0) &&                                // 327
    (DomUtils.compareElementIndex(elem, clipEnd) <= 0);                                         // 328
};                                                                                              // 329
                                                                                                // 330
// Like `findAll` but searches the nodes from `start` to `end`                                  // 331
// inclusive. `start` and `end` must be siblings, and they participate                          // 332
// in the search (they can be used to match selector components, and                            // 333
// they can appear in the returned results). It's as if the parent of                           // 334
// `start` and `end` serves as contextNode, but matches from children                           // 335
// that aren't between `start` and `end` (inclusive) are ignored.                               // 336
//                                                                                              // 337
// If `selector` involves sibling selectors, child index selectors, or                          // 338
// the like, the results are undefined.                                                         // 339
//                                                                                              // 340
// precond: clipStart/clipEnd are descendents of contextNode                                    // 341
// XXX document                                                                                 // 342
DomUtils.findAllClipped = function (contextNode, selector, clipStart, clipEnd) {                // 343
                                                                                                // 344
  // Ensure the clip range starts and ends on element nodes.  This is possible                  // 345
  // to do without changing the result set because non-element nodes can't                      // 346
  // be or contain matches.                                                                     // 347
  while (clipStart !== clipEnd && clipStart.nodeType !== 1)                                     // 348
    clipStart = clipStart.nextSibling;                                                          // 349
  while (clipStart !== clipEnd && clipEnd.nodeType !== 1)                                       // 350
    clipEnd = clipEnd.previousSibling;                                                          // 351
  if (clipStart.nodeType !== 1)                                                                 // 352
    return []; // no top-level elements!  start === end and it's not an element                 // 353
                                                                                                // 354
  // resultsPlus includes matches all matches descended from contextNode,                       // 355
  // including those that aren't in the clip range.                                             // 356
  var resultsPlus = DomUtils.findAll(contextNode, selector);                                    // 357
                                                                                                // 358
  // Filter the list of nodes to remove nodes that occur before start                           // 359
  // or after end.                                                                              // 360
  return _.reject(resultsPlus, function (n) {                                                   // 361
    return ! isElementInClipRange(n, clipStart, clipEnd);                                       // 362
  });                                                                                           // 363
};                                                                                              // 364
                                                                                                // 365
// Like `findAllClipped` but finds one element (or returns null).                               // 366
DomUtils.findClipped = function (contextNode, selector, clipStart, clipEnd) {                   // 367
  var results = DomUtils.findAllClipped(                                                        // 368
    contextNode, selector, clipStart, clipEnd);                                                 // 369
  return (results.length ? results[0] : null);                                                  // 370
};                                                                                              // 371
                                                                                                // 372
// Executes `func` while ensuring that `element` has an ID.  If `element`                       // 373
// doesn't have an ID, it is assigned `magicId` temporarily.                                    // 374
// Calls func with a selector of the form "[id='...']" as an argument.                          // 375
var withElementId = function (element, magicId, func) {                                         // 376
  var didSetId = false;                                                                         // 377
  if (! element.getAttribute('id')) {                                                           // 378
    element.setAttribute('id', magicId);                                                        // 379
    didSetId = true;                                                                            // 380
  }                                                                                             // 381
  try {                                                                                         // 382
    var escapedNodeId = element.getAttribute('id').replace(/'/g, "\\$&");                       // 383
    return func("[id='" + escapedNodeId + "']");                                                // 384
  } finally {                                                                                   // 385
    if (didSetId)                                                                               // 386
      element.removeAttribute('id');                                                            // 387
  }                                                                                             // 388
};                                                                                              // 389
                                                                                                // 390
var matchesSelectorMaybeClipped = function (element, contextNode, selector,                     // 391
                                           clipStart, clipEnd) {                                // 392
  var selecs = selector.split(',');                                                             // 393
  for(var i = 0, N = selecs.length; i < N; i++) {                                               // 394
    var matches = withElementId(                                                                // 395
      element, "DomUtils_matchesSelector_target",                                               // 396
      function (idSelector) {                                                                   // 397
        var trimmedSelector = selector.match(/\S.*?(?=\s*$)/)[0];                               // 398
        // appending [id='foo'] to a selector with no whitespace ought to                       // 399
        // simply restrict the set of possible outputs regardless of the                        // 400
        // form of the selector.                                                                // 401
        var doctoredSelector = trimmedSelector + idSelector;                                    // 402
        var result;                                                                             // 403
        if (clipStart)                                                                          // 404
          result = DomUtils.findClipped(contextNode, doctoredSelector,                          // 405
                                        clipStart, clipEnd);                                    // 406
        else                                                                                    // 407
          result = DomUtils.find(contextNode, doctoredSelector);                                // 408
        return (result === element);                                                            // 409
      });                                                                                       // 410
                                                                                                // 411
    if (matches)                                                                                // 412
      return true;                                                                              // 413
  }                                                                                             // 414
                                                                                                // 415
  return false;                                                                                 // 416
};                                                                                              // 417
                                                                                                // 418
// Check if `element` matches `selector`, scoped to `contextNode`.                              // 419
DomUtils.matchesSelector = function (element, contextNode, selector) {                          // 420
  return matchesSelectorMaybeClipped(element, contextNode, selector);                           // 421
};                                                                                              // 422
                                                                                                // 423
// Check if `element` matches `selector`, scoped to `contextNode`,                              // 424
// clipped to ordered siblings `clipStart`..`clipEnd`.                                          // 425
DomUtils.matchesSelectorClipped = function (element, contextNode, selector,                     // 426
                                            clipStart, clipEnd) {                               // 427
  return matchesSelectorMaybeClipped(element, contextNode, selector,                            // 428
                                     clipStart, clipEnd);                                       // 429
};                                                                                              // 430
                                                                                                // 431
// Returns 0 if the nodes are the same or either one contains the other;                        // 432
// otherwise, -1 if a comes before b, or else 1 if b comes before a in                          // 433
// document order.                                                                              // 434
// Requires: `a` and `b` are element nodes in the same document tree.                           // 435
DomUtils.compareElementIndex = function (a, b) {                                                // 436
  // See http://ejohn.org/blog/comparing-document-position/                                     // 437
  if (a === b)                                                                                  // 438
    return 0;                                                                                   // 439
  if (a.compareDocumentPosition) {                                                              // 440
    var n = a.compareDocumentPosition(b);                                                       // 441
    return ((n & 0x18) ? 0 : ((n & 0x4) ? -1 : 1));                                             // 442
  } else {                                                                                      // 443
    // Only old IE is known to not have compareDocumentPosition (though Safari                  // 444
    // originally lacked it).  Thankfully, IE gives us a way of comparing elements              // 445
    // via the "sourceIndex" property.                                                          // 446
    if (a.contains(b) || b.contains(a))                                                         // 447
      return 0;                                                                                 // 448
    return (a.sourceIndex < b.sourceIndex ? -1 : 1);                                            // 449
  }                                                                                             // 450
};                                                                                              // 451
                                                                                                // 452
// Wrap `frag` as necessary to prepare it for insertion in                                      // 453
// `container`. For example, if `frag` has TR nodes at top level,                               // 454
// and `container` is a TABLE, then it's necessary to wrap `frag` in                            // 455
// a TBODY to avoid IE quirks.                                                                  // 456
//                                                                                              // 457
// `frag` is a DocumentFragment and will be modified in                                         // 458
// place. `container` is a DOM element.                                                         // 459
DomUtils.wrapFragmentForContainer = function (frag, container) {                                // 460
  if (container && container.nodeName === "TABLE" &&                                            // 461
      _.any(frag.childNodes,                                                                    // 462
            function (n) { return n.nodeName === "TR"; })) {                                    // 463
    // Avoid putting a TR directly in a TABLE without an                                        // 464
    // intervening TBODY, because it doesn't work in IE.  We do                                 // 465
    // the same thing on all browsers for ease of testing                                       // 466
    // and debugging.                                                                           // 467
    var tbody = document.createElement("TBODY");                                                // 468
    tbody.appendChild(frag);                                                                    // 469
    frag.appendChild(tbody);                                                                    // 470
  }                                                                                             // 471
};                                                                                              // 472
                                                                                                // 473
// Return true if `node` is part of the global DOM document. Like                               // 474
// elementContains(document, node), except (1) it works for any node                            // 475
// (eg, text nodes), not just elements; (2) it works around browser                             // 476
// quirks that would otherwise come up when passing 'document' as                               // 477
// the first argument to elementContains.                                                       // 478
//                                                                                              // 479
// Returns true if node === document.                                                           // 480
DomUtils.isInDocument = function (node) {                                                       // 481
  // Deal with all cases where node is not an element                                           // 482
  // node descending from the body first...                                                     // 483
  if (node === document)                                                                        // 484
    return true;                                                                                // 485
                                                                                                // 486
  if (node.nodeType !== 1 /* Element */)                                                        // 487
    node = node.parentNode;                                                                     // 488
  if (! (node && node.nodeType === 1))                                                          // 489
    return false;                                                                               // 490
  if (node === document.body)                                                                   // 491
    return true;                                                                                // 492
                                                                                                // 493
  return DomUtils.elementContains(document.body, node);                                         // 494
};                                                                                              // 495
                                                                                                // 496
// Return an HTML string representation of the nodes from                                       // 497
// firstNode to lastNode, which must be siblings.                                               // 498
// The tags representing firstNode and lastNode are included,                                   // 499
// but not their parent or outer siblings.                                                      // 500
DomUtils.rangeToHtml = function (firstNode, lastNode) {                                         // 501
  var frag = document.createDocumentFragment();                                                 // 502
  for(var n = firstNode, after = lastNode.nextSibling;                                          // 503
      n && n !== after;                                                                         // 504
      n = n.nextSibling)                                                                        // 505
    frag.appendChild(n.cloneNode(true)); // deep copy                                           // 506
  return DomUtils.fragmentToHtml(frag);                                                         // 507
};                                                                                              // 508
                                                                                                // 509
// Return an HTML string representation of node, including its                                  // 510
// own open and close tag.                                                                      // 511
DomUtils.outerHtml = function (node) {                                                          // 512
  return DomUtils.rangeToHtml(node, node);                                                      // 513
};                                                                                              // 514
                                                                                                // 515
// Sets the value of an element, portably across browsers. There's a special                    // 516
// case for SELECT elements in IE.                                                              // 517
DomUtils.setElementValue = function (node, value) {                                             // 518
  // Try to assign the value.                                                                   // 519
  node.value = value;                                                                           // 520
  if (node.value === value || node.nodeName !== 'SELECT')                                       // 521
    return;                                                                                     // 522
                                                                                                // 523
  // IE (all versions) appears to only let you assign SELECT values which                       // 524
  // match valid OPTION values... and moreover, the OPTION value must be                        // 525
  // explicitly given as an attribute, not just as the text. So we hunt for                     // 526
  // the OPTION and select it.                                                                  // 527
  var options = DomUtils.findAll(node, 'option');                                               // 528
  for (var i = 0; i < options.length; ++i) {                                                    // 529
    if (DomUtils.getElementValue(options[i]) === value) {                                       // 530
      options[i].selected = true;                                                               // 531
      return;                                                                                   // 532
    }                                                                                           // 533
  }                                                                                             // 534
};                                                                                              // 535
                                                                                                // 536
// Gets the value of an element, portably across browsers. There's a special                    // 537
// case for SELECT elements in IE.                                                              // 538
DomUtils.getElementValue = function (node) {                                                    // 539
  if (!quirks.selectValueMustBeFromAttribute)                                                   // 540
    return node.value;                                                                          // 541
                                                                                                // 542
  if (node.nodeName === 'OPTION') {                                                             // 543
    // Inspired by jQuery.valHooks.option.get.                                                  // 544
    var val = node.attributes.value;                                                            // 545
    return !val || val.specified ? node.value : node.text;                                      // 546
  } else if (node.nodeName === 'SELECT') {                                                      // 547
    if (node.selectedIndex < 0)                                                                 // 548
      return null;                                                                              // 549
    return DomUtils.getElementValue(node.options[node.selectedIndex]);                          // 550
  } else {                                                                                      // 551
    return node.value;                                                                          // 552
  }                                                                                             // 553
};                                                                                              // 554
                                                                                                // 555
//////////////////////////////////////////////////////////////////////////////////////////////////

}).call(this);


/* Exports */
if (typeof Package === 'undefined') Package = {};
Package.domutils = {
  DomUtils: DomUtils
};

})();

//# sourceMappingURL=c5d4d4c5629038d1bb6deea7acd7a0512d406fe3.map
