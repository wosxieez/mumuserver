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
    var channel = this.channelService.getChannel(groupname, false)
    if (!channel) {
        channel = this.channelService.getChannel(groupname, true)
    }

    const oldMember = channel.getMember(username)
    if (!!oldMember) {
        cb({ code: 0, data: channel.getMembers() })
        return
    }
    channel.add(username, sid)
    console.log(sid, username, '加入群', groupname)
    console.log(groupname, '群前用户', channel.getMembers())
    this.notificationStatus(groupname)
    cb({ code: 0, data: this.getStatus(groupname) })
    console.log('---------------------------------------------------------------------------')
}

GroupRemote.prototype.leaveGroup = function (sid, groupname, username, cb) {
    console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
    console.log('leaveGroup')
    console.log(groupname)
    var channel = this.channelService.getChannel(groupname, false) // 创建群渠道
    if (!!channel) {
        channel.leave(username, sid)
        console.log(sid, username, '离开群', groupname)
        console.log(groupname, '群前用户', channel.getMembers())
        if (channel.getMembers().length === 0) {
            console.log('删除群' + groupname)
            channel.destroy()
        } else {
            this.notificationStatus(groupname) // 通知状态
        }
        cb({ code: 0, data: '离开群成功' })
    } else {
        cb({ code: 0, data: '该群不存在' })
    }
    console.log('---------------------------------------------------------------------------')
}

GroupRemote.prototype.queryStatus = function (groupname, username, cb) {
    console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
    console.log('queryStatus')
    console.log(groupname)
    cb({ code: 0, data: this.getStatus(groupname) })
    console.log('---------------------------------------------------------------------------')
}

//---------------------------------------------------------------------------------------------------------------
// 通知状态
//---------------------------------------------------------------------------------------------------------------

GroupRemote.prototype.notificationStatus = function (groupname) {
    const groupChannel = this.channelService.getChannel(groupname, false)
    if (groupChannel) {
        groupChannel.pushMessage({ route: 'onGroup', name: Notifications.onRoomStatus, data: this.getStatus(groupname) })
    }
    console.log('通知状态...')
}

GroupRemote.prototype.getStatus = function (groupname) {
    var status = []
    var channel
    var room
    for (key in this.channelService.channels) {
        channel = this.channelService.channels[key]
        if (channel && channel.groupname === groupname) {
            room = { name: channel.name, rid: channel.room.rule.id, users: [] }
            channel.room.users.forEach(user => {
                room.users.push(user.username)
            })
            status.push(room)
        }
    }
    console.log('获取状态', status)
    return status
}