global.Package =
  description: null

  describe: (options) ->
    Package.description = options

  onUse: (f) ->
    return

  on_use: (f) ->
    return

  onTest: (f) ->
    return

  on_test: (f) ->
    return

  registerBuildPlugin: (options) ->
    return

  _transitional_registerBuildPlugin: (options) ->
    return

  includeTool: ->
    return


global.Npm =
  depends: (_npmDependencies) ->
    return

  strip: (discards) ->
    return

  require: (name) ->
    return


global.Cordova =
  depends: (_cordovaDependencies) ->
    return
