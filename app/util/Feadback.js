module.exports = function Feadback(channel) {
    this.send = function (username, message) {
        this.username = username
        channel.pushMessage(message)
        this.timeout = setTimeout(() => {
            this.cancel()
        }, 15000)
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
    this.ok = function (username, data) {
        if (username === this.username) {
            if (this.okFunction) {
                this.okFunction(data)
            }
            this.username = null
            this.okFunction = null
            this.cancelFunction = null
            clearTimeout(this.timeout)
        }
    }
    this.cancel = function () {
        if (this.cancelFunction) {
            this.cancelFunction()
        }
        this.username = null
        this.okFunction = null
        this.cancelFunction = null
        clearTimeout(this.timeout)
    }
}