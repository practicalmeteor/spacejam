page = require('webpage').create()
system = require('system')
platform = system.args[1] || "local"

console.log("PhantomJS: Running tests at #{system.env.ROOT_URL} using test-in-console")

page.onConsoleMessage = (message) ->
  console.log(message)

page.open(system.env.ROOT_URL + platform)

setInterval ->
  done = page.evaluate ->
    return TEST_STATUS.DONE if TEST_STATUS?
    return DONE if DONE?
    return false

  if done
    failures = page.evaluate ->
      return TEST_STATUS.FAILURES if TEST_STATUS?
      return FAILURES if FAILURES?
      return false
    phantom.exit(if failures then 2 else 0)
, 500
