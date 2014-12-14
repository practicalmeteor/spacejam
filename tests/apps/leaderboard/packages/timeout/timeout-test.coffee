Tinytest.addAsync "timeout",(test, onComplete)->
  test.equal true, true
  # Never call onComplete so test will timeout
