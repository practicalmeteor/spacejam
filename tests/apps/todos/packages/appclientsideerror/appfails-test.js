var TestHelper = function() {};
TestHelper.prototype.blah = function() {
  describe('test', function() {
    it('test', function() {
      var test = false;
      const thisshouldntwork = " ".split();
    });
  });
};

describe('testing', function() {
  var t = new TestHelper();
  t.blah();
});
