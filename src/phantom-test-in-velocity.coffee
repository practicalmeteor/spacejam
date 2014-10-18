page = require('webpage').create()
system = require('system')

console.log("PhantomJS: Running tests at #{system.env.ROOT_URL} using test-in-velocity")

page.onConsoleMessage = (message) ->
  console.log(message)

page.open(system.env.ROOT_URL)
