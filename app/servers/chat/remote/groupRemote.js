const Notifications = require('../../../util/Notifications')

module.exports = function (app) {
    return new GroupRemote(app)
}

var GroupRemote = function (app) {
    this.app = app
    this.channelService = app.get('channelService')
}

GroupRemote.prototype.joinGroup = function (sid, groupname, username, cb) {
    console.log(this.app.get('serverId'), username, '正在加入群', groupname)
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
    console.log(this.app.get('serverId'), username, '加入群成功')
    this.notificationStatus(groupname)
    cb({ code: 0, data: this.getGroupStatus(groupname) })
}

GroupRemote.prototype.leaveGroup = function (sid, groupname, username, cb) {
    console.log(this.app.get('serverId'), username, '正在离开群', groupname)
    var channel = this.channelService.getChannel(groupname, false) // 创建群渠道
    if (!!channel) {
        channel.leave(username, sid)
        if (channel.getMembers().length === 0) {
            console.log('删除群' + groupname)
            channel.destroy()
        } else {
            this.notificationStatus(groupname) // 通知状态
        }
        console.log(this.app.get('serverId'), username, '离开群成功')
        cb({ code: 0, data: '离开群成功' })
    } else {
        console.log(this.app.get('serverId'), username, '离开群失败, 该群不存在')
        cb({ code: 0, data: '该群不存在' })
    }
}

GroupRemote.prototype.queryGroupStatus = function (groupname, username, cb) {
    cb({ code: 0, data: this.getGroupStatus(groupname) })
}

//---------------------------------------------------------------------------------------------------------------
// 通知状态
//---------------------------------------------------------------------------------------------------------------

GroupRemote.prototype.notificationStatus = function (groupname) {
    const groupChannel = this.channelService.getChannel(groupname, false)
    if (groupChannel) {
        groupChannel.pushMessage({ route: 'onGroup', name: Notifications.onGroupStatus, data: this.getGroupStatus(groupname) })
    }
}

GroupRemote.prototype.getGroupStatus = function (groupname) {
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

    console.log(this.app.get('serverId'), groupname, '群当前状态', status)

    return status
}