EventEmitter = require('events').EventEmitter
ps = require('ps-node')

class MeteorMongodb extends EventEmitter

  mongodChilds:[]

  meteorPid = null

  constructor: (@meteorPid)->
    @findAllChildren()



  hasMongodb: ->
    log.debug "MeteorMongodb.hasMongodb()"
    @mongodChilds.length > 0


  findAllChildren: ->
    log.debug "MeteorMongodb.findAllChildren()"
    log.debug "@meteorPid",@meteorPid
    ps.lookup
      command: 'mongod',
      psargs: '--ppid '+@meteorPid
    , (err, resultList )=>
      if (err)
        throw new Error( err );

      if resultList.length>1
        log.warn "Found more than one mongod child:\n",resultList
      else
        @mongodChilds = resultList




  kill: ->
    log.debug "MeteorMongodb.kill()"
    attempts = 1

    interval = setInterval(=>
      if attempts <= 40
        signal = 0
        if attempts is 1
          signal = "SIGINT"
        else signal = "SIGKILL"  if attempts is 20 or attempts is 30
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
