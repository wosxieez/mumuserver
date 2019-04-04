module.exports = function Feadback(channel) {
    this.send = function (users) {
        // users format
        // [ { un: wosxieez1 nd: {dt: '', ac: -1}, hd: {dt: [], ac: -1}, pd: {dt: []}, ac: -1}, cd: {dt: [], ac: -1} },
        //   { un: wosxieez2 nd: {dt: '', ac: -1}, hd: {dt: [], ac: -1}, pd: {dt: []}, ac: -1}, cd: {dt: [], ac: -1} } ]
        this.users = users
        this.okFunction = null
        this.cancelFunction = null
        clearTimeout(this.timeout)
        this.timeout = setTimeout(this.timeoutCancel.bind(this), 60000) // 60s后所有玩家默认为取消
        console.log('反馈启动', this.users)
        return this
    }
    this.thenOk = function (cb) {
        this.okFunction = cb
        return this
    }
    this.thenCancel = function (cb) {
        this.cancelFunction = cb
        return this
    }
    this.doOk = function (un, newuser) {
        console.log('收到反馈', un, newuser)
        this.users = this.users.map(user => {
            if (user.un === un) {
                console.log('反馈的玩家在反馈的数据中')
                user = newuser
            }
            return user
        })
        console.log(this.users)
        const doFunction = this.okFunction
        if (doFunction) {
            doFunction(this.users)
        }
    }
    this.timeoutCancel = function () {
        // 超时了 执行取消
        console.log('超时反馈结束', this.users)
        const doFunction = this.cancelFunction
        this.okFunction = null
        this.cancelFunction = null
        clearTimeout(this.timeout)
        if (doFunction) {
            doFunction(this.users)
        }
        this.users = null
    }
    this.manualCancel = function () {
        // 手动取消了
        console.log('手动反馈结束', this.users)
        this.users = null
        this.okFunction = null
        this.cancelFunction = null
        clearTimeout(this.timeout)
    }
    this.release = function () {
        console.log('反馈释放')
        this.users = null
        this.okFunction = null
        this.cancelFunction = null
        clearTimeout(this.timeout)
    }
}