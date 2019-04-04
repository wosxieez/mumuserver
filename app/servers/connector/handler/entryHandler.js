module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
	this.sessionService = this.app.get('sessionService')
	this.channelService = this.app.get('channelService')
	this.rooms = {}
};

var handler = Handler.prototype;


/**
 * 加入群
 */
handler.joinGroup = function (msg, session, next) {
	// 设置session
	const username = msg.username   // 用户名
	const groupname = 'group' + msg.groupid // 群名
	const sid = this.app.get('serverId')

	// 判断是否重复登录
	if (!!this.sessionService.getByUid(username)) {
		console.log('用户重复登录')
	}

	session.bind(username)
	session.on('closed', onSessionClosed.bind(null, this.app))
	session.set('username', username)
	session.push('username', function (err) {
		if (err) {
			console.error('set username for session service failed! error is : %j', err.stack)
		}
	})
	session.set('groupname', groupname)
	session.push('groupname', function (err) {
		if (err) {
			console.error('set groupname for session service failed! error is : %j', err.stack)
		}
	})

	this.app.rpc.chat.groupRemote.joinGroup(session, sid, groupname, username, function (result) {
		next(null, result)
	})
}

/**
 * 查询群状态
 */
handler.queryGroupStatus = function (msg, session, next) {
	const groupname = session.get('groupname')
	const username = session.get('username')
	const sid = this.app.get('serverId')
	this.app.rpc.chat.groupRemote.queryGroupStatus(session, groupname, username, function (result) {
		next(null, result)
	})
}

/**
 * 离开群
 */
handler.leaveGroup = function (msg, session, next) {
	next(null, { code: 0, data: '离开成功' })
	setTimeout(() => {
		this.sessionService.kick(session.uid, '主动断开')
	}, 200)
}

/**
 *	创建房间
 */
handler.createRoom = function (rule, session, next) {
	console.log('fuck fuck')
	const sid = this.app.get('serverId')
	const groupname = session.get('groupname')
	const username = session.get('username')

	// 创建房间 房间号需要先生成
	this.app.rpc.chat.roomRemote.getRadom(session, groupname, 6, (roomname) => {
		session.set('roomname', roomname)
		session.push('roomname', function (err) {
			if (err) {
				console.error('set roomname for session service failed! error is : %j', err.stack)
			}
		});
		this.app.rpc.chat.roomRemote.createRoom(session, sid, groupname, roomname, username, rule, function (result) {
			next(null, result)
		})
	})
}

/**
 *	加入房间 
 */
handler.joinRoom = function (msg, session, next) {
	const sid = this.app.get('serverId')
	const groupname = session.get('groupname')
	const username = session.get('username')
	const roomname = msg.roomname

	session.set('roomname', roomname)
		session.push('roomname', function (err) {
			if (err) {
				console.error('set roomname for session service failed! error is : %j', err.stack)
			}
		});

	this.app.rpc.chat.roomRemote.joinRoom(session, sid, groupname, roomname, username, function (result) {
		next(null, result)
	})
}

/**
 *	离开房间
 */
handler.leaveRoom = function (msg, session, next) {
	const sid = this.app.get('serverId')
	const groupname = session.get('groupname')
	const roomname = session.get('roomname')
	const username = session.get('username')

	session.set('roomname', null)
	session.push('roomname', function (err) {
		if (err) {
			console.error('set roomname for session service failed! error is : %j', err.stack)
		}
	})

	this.app.rpc.chat.roomRemote.leaveRoom(session, sid, groupname, roomname, username, function (result) {
		next(null, result)
	})
}

/**
 * 查询群状态
 */
handler.queryRoomStatus = function (msg, session, next) {
	const groupname = session.get('groupname')
	const username = session.get('username')
	const roomname = session.get('roomname')
	const sid = this.app.get('serverId')
	this.app.rpc.chat.roomRemote.queryRoomStatus(session, groupname, roomname, username, function (result) {
		next(null, result)
	})
}

function onSessionClosed(app, session) {
	if (!session || !session.uid) {
		return;
	}

	const sid = app.get('serverId')
	const groupname = session.get('groupname')
	const roomname = session.get('roomname')
	const username = session.get('username')

	if (roomname) {
		app.rpc.chat.roomRemote.leaveRoom(session, sid, groupname, roomname, username, function (result) { })
	}
	if (groupname) {
		app.rpc.chat.groupRemote.leaveGroup(session, sid, groupname, username, function (result) { })
	}

	console.log(username, '已断开连接')
}