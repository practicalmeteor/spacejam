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
    log.debug "@meteorPid", @meteorPid
    if process.platform is 'win32'
      resultList = [];

      bat = require('child_process').spawn('cmd.exe', [
        '/c'
        "#{__dirname}\\get_children.bat #{@meteorPid}"
      ])

      bat.stdout.setEncoding "utf8"
      bat.stderr.setEncoding "utf8"

      bat.stdout.on 'data', (data) ->

        childPid = data.toString().trim()
        resultList.push pid: parseInt(childPid)

      bat.stderr.on 'data', (data) ->
        log.warn 'spacejam: Warning: Error enumerating mongod children:\n', data

      bat.on 'exit', (code) =>
        if code != 0
          return log.warn('spacejam: Warning: Enumerating mongod children returned with error code: ', code)
        log.debug 'MongoDB children:\n', resultList
        @mongodChilds = resultList
        if resultList.length == 0
          log.warn 'spacejam: Warning: Couldn\'t find any mongod children:\n', err
        else if resultList.length > 1
          log.warn 'spacejam: Warning: Found more than one mongod child:\n', resultList
        else
          log.debug 'Found meteor mongod child with pid: ', resultList[0].pid
    else
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
