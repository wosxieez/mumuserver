module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
	this.sessionService = this.app.get('sessionService')
	this.channelService = this.app.get('channelService')
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
 * 离开群
 */
handler.leaveGroup = function (msg, session, next) {
	next(null, { code: 0, data: '离开成功' })
	setTimeout(() => {
		this.sessionService.kick(session.uid, '主动断开')
	}, 200)
}

/**
 *	加入房间
 */
handler.joinRoom = function (msg, session, next) {
	const sid = this.app.get('serverId')
	const groupname = session.get('groupname')
	const roomname = 'room' + msg.id
	const username = session.get('username')

	session.set('roomname', roomname)
	session.push('roomname', function (err) {
		if (err) {
			console.error('set roomname for session service failed! error is : %j', err.stack)
		}
	});

	this.app.rpc.chat.roomRemote.joinRoom(session, sid, groupname, roomname, username, msg, function (result) {
		next(null, result)
	})
}

/**
 *	恢复房间
 */
handler.resumeRoom = function (msg, session, next) {
	const sid = this.app.get('serverId')
	const groupname = session.get('groupname')
	const roomname = session.get('roomname')
	const username = session.get('username')
	this.app.rpc.chat.roomRemote.resumeRoom(session, sid, groupname, roomname, username, function (result) {
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
 *	创建群房间
 */
handler.createGroupRoom = function (msg, session, next) {
	// 设置session
	const username = msg.username   // 用户名
	const sid = this.app.get('serverId')
	const groupid = (Math.floor(Math.random() * 9000) + 1000)
	const groupname = 'group' + groupid

	session.bind(username)
	session.on('closed', onSessionClosed2.bind(null, this.app))
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

	this.app.rpc.chat.groupRoomRemote.createGroupRoom(session, sid, groupname, username, { count: 2, huxi: 15 }, function (result) {
		if (result.code === 0) {
			next(null, { code: 0, data: groupid })
		} else {
			next(null, result)
		}
	})
}


/**
 *	加入群房间
 */
handler.joinGroupRoom = function (msg, session, next) {
	// 设置session
	const username = msg.username   // 用户名
	const groupname = 'group' + msg.groupid // 群名
	const sid = this.app.get('serverId')

	session.bind(username)
	session.on('closed', onSessionClosed2.bind(null, this.app))
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

	this.app.rpc.chat.groupRoomRemote.joinGroupRoom(session, sid, groupname, username, { count: 1, huxi: 15 }, function (result) {
		next(null, result)
	})
}

/**
 *	恢复群房间
 */
handler.resumeGroupRoom = function (msg, session, next) {
	const sid = this.app.get('serverId')
	const groupname = session.get('groupname')
	const username = session.get('username')
	this.app.rpc.chat.groupRoomRemote.resumeGroupRoom(session, sid, groupname, username, function (result) {
		next(null, result)
	})
}

/**
 *	离开群房间
 */
handler.leaveGroupRoom = function (msg, session, next) {
	const sid = this.app.get('serverId')
	const groupname = session.get('groupname')
	const username = session.get('username')
	this.app.rpc.chat.groupRoomRemote.leaveGroupRoom(session, sid, groupname, username, function (result) {
		next(null, result)
	})
	next(null, { code: 0, data: '离开群房间成功' })
	setTimeout(() => {
		this.sessionService.kick(session.uid, '主动断开')
	}, 200)
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

function onSessionClosed2(app, session) {
	if (!session || !session.uid) {
		return;
	}

	const sid = app.get('serverId')
	const groupname = session.get('groupname')
	const username = session.get('username')

	if (groupname) {
		app.rpc.chat.groupRoomRemote.leaveGroupRoom(session, sid, groupname, username, function (result) { })
	}

	console.log(username, '已断开群房间连接')
}