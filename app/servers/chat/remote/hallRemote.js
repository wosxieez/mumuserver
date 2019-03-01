module.exports = function (app) {
    return new HallRemote(app)
}

var HallRemote = function (app) {
    this.app = app
    this.channelService = app.get('channelService')
}

HallRemote.prototype.joinHall = function (sid, username, cb) {
    var channel = this.channelService.getChannel('hall', true) // 创建大厅渠道
    channel.add(username, sid) // 加入大厅渠道
    console.log(username + '加入大厅渠道')
    cb()
}

HallRemote.prototype.leaveHall = function (sid, username, cb) {
    var channel = this.channelService.getChannel('hall', true)
    channel.leave(username, sid) // 离开大厅渠道
    console.log(username + '离开大厅渠道')
    cb()
}