expect = require('chai').expect
EventEmitter = require('events').EventEmitter
ps = require('ps-node')

class MeteorMongodb extends EventEmitter

  mongodChilds: []

  constructor: (@meteorPid)->
    log.debug "MeteorMongodb.constructor()", arguments
    @findAllChildren()


  hasMongodb: ->
    log.debug "MeteorMongodb.hasMongodb()"
    @mongodChilds.length > 0


  findAllChildren: ->
    log.debug "MeteorMongodb.findAllChildren()", arguments
    log.debug "@meteorPid", @meteorPid
    ps.lookup
      command: 'mongod',
      psargs: '--ppid ' + @meteorPid
    , (err, resultList )=>
      @mongodChilds = resultList
      if (err)
        log.warn "Couldn't find any mongod child:\n", err
      else if resultList.length > 1
        log.warn "Found more than one mongod child:\n", resultList
      else
        log.info "Found meteor mongod child with pid: ", resultList[0].pid


  kill: ->
    log.debug "MeteorMongodb.kill()"
    attempts = 1

    interval = null
    interval = setInterval(=>
      if attempts <= 40
        signal = 0
        if attempts is 1
          signal = "SIGINT"
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
        log.error "Error: Unable to kill all mongodb childs, even after 40 attempts"
        @emit "kill-done", new Error("Unable to kill all mongodb childs, even after 40 attempts"), @mongodChilds

    ,100)

module.exports = MeteorMongodb
