expect = require('chai').expect
EventEmitter = require('events').EventEmitter
ps = require('psext')

class MeteorMongodb extends EventEmitter

  mongodChilds: []

  killed: false

  constructor: (@meteorPid)->
    log.debug "MeteorMongodb.constructor()", arguments
    process.on 'exit', (code)=>
      log.debug "MeteorMongodb.process.on 'exit': code=#{code}"
      @kill()
    @findAllChildren()


  hasMongodb: ->
    log.debug "MeteorMongodb.hasMongodb()"
    @mongodChilds.length > 0


  findAllChildren: ->
    log.debug "MeteorMongodb.findAllChildren()", arguments
    if process.platform is 'win32'
      @getChildProcessOnWindows(@meteorPid, (childsPid, _this) ->
          _this.meteorPid = childsPid[0].pid
          log.debug "@meteorPid", _this.meteorPid
          _this.getChildProcessOnWindows(childsPid[0].pid, (childsPid, _this) ->
            _this.mongodChilds = childsPid
          )
      )

    else
      log.debug "@meteorPid", @meteorPid
      ps.lookup
        command: 'mongod'
        psargs: '-l'
        ppid: @meteorPid
      , (err, resultList )=>
        @mongodChilds = resultList
        if (err)
          log.warn "spacjam: Warning: Couldn't find any mongod children:\n", err
        else if resultList.length > 1
          log.warn "spacjam: Warning: Found more than one mongod child:\n", resultList
        else
          log.debug "Found meteor mongod child with pid: ", resultList[0]?.pid

  getChildProcessOnWindows: (processPid, onSuccess) ->
    resultList = [];
    bat = require('child_process').spawn('cmd.exe', [
      '/c'
      "#{__dirname}\\get_children.bat #{processPid}"
    ])

    bat.stdout.setEncoding "utf8"
    bat.stderr.setEncoding "utf8"

    bat.stdout.on 'data', (data) ->

      childPid = data.toString().trim()
      resultList.push pid: parseInt(childPid)

    bat.stderr.on 'data', (data) ->
      log.warn 'spacejam: Warning: Error enumerating process children:\n', data

    bat.on 'exit', (code) =>
      if code != 0
        return log.warn('spacejam: Warning: Enumerating child process returned with error code: ', code)
      log.debug 'MongoDB children:\n', resultList
      if resultList.length == 0
        log.warn 'spacejam: Warning: Couldn\'t find any child process :\n', err
      else if resultList.length > 1
        log.warn 'spacejam: Warning: Found more than one child process :\n', resultList
        onSuccess(resultList, _this)
      else
        log.debug 'Found meteor child process with pid: ', resultList[0].pid
        onSuccess(resultList, _this)



  kill: ->
    log.debug "MeteorMongodb.kill() killed=", @killed

    return if @killed
    @killed = true

    attempts = 1

    interval = null

    onInterval = =>
      if attempts <= 40
        signal = 0
        if attempts is 1
          signal = "SIGTERM"
        else if attempts is 20 #or attempts is 30
          signal = "SIGKILL"
        try
          for mongod in @mongodChilds
            if not mongod.dead?
              try
                process.kill mongod.pid, signal
              catch e
                mongod.dead = true

          allDead = true
          for mongod in @mongodChilds
            if not mongod.dead?
              allDead = false
              return
          if allDead
            clearInterval(interval)
            @emit "kill-done", null, @mongodChilds
        attempts++
      else
        clearInterval(interval)
        log.error "spacejam: Error: Unable to kill all mongodb children, even after 40 attempts"
        @emit "kill-done", new Error("Unable to kill all mongodb children, even after 40 attempts"), @mongodChilds

    onInterval()
    interval = setInterval onInterval, 100


module.exports = MeteorMongodb
