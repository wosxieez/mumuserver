const _ = require('underscore')


module.exports = function Feadback(channel) {
    this.channel = channel

    this.send = function () {
        // [ { un: wosxieez1 nd: {dt: '', ac: -1}, hd: {dt: [], ac: -1}, pd: {dt: []}, ac: -1}, cd: {dt: [], ac: -1} },
        //   { un: wosxieez2 nd: {dt: '', ac: -1}, hd: {dt: [], ac: -1}, pd: {dt: []}, ac: -1}, cd: {dt: [], ac: -1} } ]
        this.okFunction = null
        clearTimeout(this.timeout)
        console.log('反馈启动', this.channel.room.actionUsers)
        this.timeout = setTimeout(this.timeoutCancel.bind(this), 2000) // 60s后所有玩家默认为取消
        return this
    }

    this.thenOk = function (cb) {
        this.okFunction = cb
        return this
    }

    this.doOk = function (newUser) {
        if (!this.channel.room.actionUsers) return 
        this.channel.room.actionUsers.forEach(oldUser => {
            if (newUser.un === oldUser.un) {
                if (newUser.nd) { oldUser.nd = newUser.nd }
                if (newUser.hd) { oldUser.hd = newUser.hd }
                if (newUser.pd) { oldUser.pd = newUser.pd }
                if (newUser.cd) { oldUser.cd = newUser.cd }
            }
        })
        console.log('收到反馈后结果', this.channel.room.actionUsers)
        const doFunction = this.okFunction
        this.okFunction = null
        if (doFunction) {
            doFunction()
        }
    }

    this.timeoutCancel = function () {
        if (!this.channel.room.actionUsers) return 
        this.channel.room.actionUsers.forEach(oldUser => {
                if (oldUser.nd) { oldUser.nd.ac = 0 }
                if (oldUser.hd) { oldUser.hd.ac = 0 }
                if (oldUser.pd) { oldUser.pd.ac = 0 }
                if (oldUser.cd) { oldUser.cd.ac = 0 }
        })
        console.log('超时反馈结束', this.channel.room.actionUsers)
        const doFunction = this.okFunction
        this.okFunction = null
        clearTimeout(this.timeout)
        if (doFunction) {
            doFunction()
        }
    }

    this.manualCancel = function () {
        // 手动取消了
        console.log('手动反馈结束', this.channel.room.actionUsers)
        this.okFunction = null
        clearTimeout(this.timeout)
    }

    this.release = function () {
        console.log('反馈释放')
        this.okFunction = null
        clearTimeout(this.timeout)
    }

}