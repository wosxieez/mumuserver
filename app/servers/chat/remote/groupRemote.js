const Notifications = require('../../../util/Notifications')

module.exports = function (app) {
    return new GroupRemote(app)
}

var GroupRemote = function (app) {
    this.app = app
    this.channelService = app.get('channelService')
}

GroupRemote.prototype.joinGroup = function (sid, groupname, username, cb) {
    console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
    console.log('joinGroup')
    console.log(groupname)
    var channel = this.channelService.getChannel(groupname, true) // 创建群渠道
    
    const oldMember = channel.getMember(username)
		if (!!oldMember) {
			cb({ code: 0, data: channel.getMembers() })
			return
        }
        
    channel.pushMessage({ route: 'onGroup', name: Notifications.onJoinGroup, data: { username } })
    channel.add(username, sid)
    console.log(sid, username, '加入群', groupname)
    console.log(groupname, '群前用户', channel.getMembers())
    cb({ code: 0, data: channel.getMembers() })
    console.log('---------------------------------------------------------------------------')
}

GroupRemote.prototype.leaveGroup = function (sid, groupname, username, cb) {
    console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
    console.log('leaveGroup')
    console.log(groupname)
    var channel = this.channelService.getChannel(groupname, false) // 创建群渠道
    if (!!channel) {
        channel.leave(username, sid)
        channel.pushMessage({ route: 'onGroup', name: Notifications.onLeaveGroup, data: { username } })
        console.log(sid, username, '离开群', groupname)
        console.log(groupname, '群前用户', channel.getMembers())
        if (channel.getMembers().length === 0) {
            console.log('删除群' + groupname)
            channel.destroy()
        }
        cb({ code: 0, data: '离开群成功' })
    } else {
        cb({ code: 0, data: '该群不存在' })
    }
    console.log('---------------------------------------------------------------------------')
}