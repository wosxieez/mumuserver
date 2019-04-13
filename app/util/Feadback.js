const _ = require('underscore')
const logger = require('pomelo-logger').getLogger('pomelo', __filename);


module.exports = function Feadback(channel) {
    this.channel = channel
    this.timeouts = []

    this.send = function () {
        // [ { un: wosxieez1 nd: {dt: '', ac: -1}, hd: {dt: [], ac: -1}, pd: {dt: []}, ac: -1}, cd: {dt: [], ac: -1} },
        //   { un: wosxieez2 nd: {dt: '', ac: -1}, hd: {dt: [], ac: -1}, pd: {dt: []}, ac: -1}, cd: {dt: [], ac: -1} } ]
        if (!this.channel.room.actionUsers) return 
        this.okFunction = null

        this.timeouts.forEach(timeout => {
            clearTimeout(timeout)
        })  
        this.timeouts = []
        
        this.channel.room.actionUsers.forEach(oldUser => {
            if (!this.channel.getMember(oldUser.un)) {
                // 如果发送反馈的时候 玩家不在线 默认玩家所有操作都取消
                if (oldUser.nd && oldUser.nd.ac === -1 ) { oldUser.nd.ac = 0 }
                if (oldUser.hd && oldUser.hd.ac === -1 ) { oldUser.hd.ac = 0 }
                if (oldUser.pd && oldUser.pd.ac === -1 ) { oldUser.pd.ac = 0 }
                if (oldUser.cd && oldUser.cd.ac === -1 ) { oldUser.cd.ac = 0 }
                var timeout = setTimeout(() => {
                    this.doOk(oldUser)
                }, 1000);
                this.timeouts.push(timeout)
            }
        })
        logger.info('反馈启动', this.channel.room.actionUsers)
        this.isOk = true
        var timeout = setTimeout(this.timeoutCancel.bind(this), 5000) // 60s后所有玩家默认为取消
        this.timeouts.push(timeout)
        return this
    }

    this.thenOk = function (cb) {
        this.okFunction = cb
        return this
    }

    this.doOk = function (newUser) {
        if (!this.isOk) return
        if (!this.channel.room.actionUsers) return 
        this.channel.room.actionUsers.forEach(oldUser => {
            if (newUser.un === oldUser.un) {
                if (newUser.nd) { oldUser.nd = newUser.nd }
                if (newUser.hd) { oldUser.hd = newUser.hd }
                if (newUser.pd) { oldUser.pd = newUser.pd }
                if (newUser.cd) { oldUser.cd = newUser.cd }
            }
        })
        logger.info('收到反馈后结果', this.channel.room.actionUsers)
        if (this.okFunction) {
            this.okFunction()
        }
    }

    this.timeoutCancel = function () {
        if (!this.isOk) return
        if (!this.channel.room.actionUsers) return 
        this.channel.room.actionUsers.forEach(oldUser => {
                if (oldUser.nd && oldUser.nd.ac === -1 ) { oldUser.nd.ac = 0 }
                if (oldUser.hd && oldUser.hd.ac === -1 ) { oldUser.hd.ac = 0 }
                if (oldUser.pd && oldUser.pd.ac === -1 ) { oldUser.pd.ac = 0 }
                if (oldUser.cd && oldUser.cd.ac === -1 ) { oldUser.cd.ac = 0 }
        })
        logger.info('超时反馈结束', this.channel.room.actionUsers)
        if (this.okFunction) {
            this.okFunction()
        }
    }

    this.manualCancel = function () {
        // 手动取消了;
        this.isOk = false
        this.okFunction = null
        logger.info('手动反馈结束', this.channel.room.actionUsers)
        this.timeouts.forEach(timeout => {
            clearTimeout(timeout)
        })  
        this.timeouts = []
    }

    this.release = function () {
        this.isOk = false
        this.okFunction = null
        logger.info('反馈释放')
        this.timeouts.forEach(timeout => {
            clearTimeout(timeout)
        })  
        this.timeouts = []
    }

}