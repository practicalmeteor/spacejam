page = require('webpage').create()
system = require('system')

console.log("phantomjs: Running tests at #{system.env.ROOT_URL} using test-in-console and coverage")

page.onConsoleMessage = (message) ->
  console.log(message)

page.open(system.env.ROOT_URL)

page.onError = (msg, trace) ->

  mochaIsRunning = page.evaluate ->
    return window.mochaIsRunning

  # Mocha will handle and report the uncaught errors for us
  if mochaIsRunning
    return

  console.log("phantomjs: #{msg}")

  trace.forEach((item) ->
    console.log("    #{item.file}: #{item.line}")
  )
  phantom.exit(0)

page.onCallback = (data) ->
  ## Callback when sending and saving coverage
  if data && data.err
      console.log("coverage error: #{data.err}")
      phantom.exit(7)
  else
     phantom.exit(0)


checkingStatus = setInterval ->
    done = page.evaluate ->
        return TEST_STATUS.DONE if TEST_STATUS?
        return DONE if DONE?
        return false

    if done
        failures = page.evaluate ->
            return TEST_STATUS.FAILURES if TEST_STATUS?
            return FAILURES if FAILURES?
            return false
        if failures
            phantom.exit(2)
        else
            ## tests are ok, save coverage
            clearInterval checkingStatus
            page.evaluate ->
                if ! Package || ! Package['meteor'] || ! Package['meteor']['Meteor'] || ! Package['meteor']['Meteor'].sendCoverage || ! Package['meteor']['Meteor'].exportCoverage
                    window.callPhantom
                        err: "Coverage package missing or not correclty launched"
                else
                    Package['meteor']['Meteor'].sendCoverage (stats,err) ->
                        console.log("tests are ok and some js on the client side have been covered. Report: ", JSON.stringify(stats))
                        if err
                             window.callPhantom
                                err: "Failed to send client coverage"
                        else
                            Package['meteor']['Meteor'].exportCoverage 'lcovonly', (err) ->
                                if err
                                    window.callPhantom
                                        err: "Failed to save lcovonly coverage"
                                else
                                    window.callPhantom
                                        success: "true"
, 500
