module.exports = function Feadback(channel) {
    this.send = function (username, message) {
        this.username = username
        this.okFunction = null
        this.cancelFunction = null
        clearTimeout(this.timeout)

        if (channel.getMember(username)) {
            channel.pushMessage(message)
            this.timeout = setTimeout(this.doCancel.bind(this, username), 60000)
        } else {
            // 玩家掉线 pass处理
            this.timeout = setTimeout(this.doCancel.bind(this, username), 1000)
        }
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
    this.doOk = function (username, data) {
        if (username === this.username) {
            const doFunction = this.okFunction
            this.username = null
            this.okFunction = null
            this.cancelFunction = null
            clearTimeout(this.timeout)

            if (doFunction) {
                doFunction(data)
            }
        }
    }
    this.doCancel = function (username) {
        if (username === this.username) {
            const doFunction = this.cancelFunction
            this.username = null
            this.okFunction = null
            this.cancelFunction = null
            clearTimeout(this.timeout)

            if (doFunction) {
                doFunction()
            }
        }
    }
    this.release = function () {
        console.log('Feadback release')
        this.username = null
        this.okFunction = null
        this.cancelFunction = null
        clearTimeout(this.timeout)
    }
}