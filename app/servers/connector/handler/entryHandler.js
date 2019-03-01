module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
	this.sessionService = this.app.get('sessionService')
	this.channelService = app.get('channelService')
};

var handler = Handler.prototype;


/**
 * 登录接口
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 */
handler.login = function (msg, session, next) {
	// 设置session
	let username = msg.username
	let password = msg.password

	// 判断是否重复登录
	if (!!this.sessionService.getByUid(username)) {
		next(null, { code: 500, error: '重复登录' })
		return
	}

	session.bind(username)
	session.on('closed', onSessionClosed.bind(null, this.app))
	session.set('username', username)
	session.push('username', function (err) {
		if (err) {
			console.error('set username for session service failed! error is : %j', err.stack)
		}
	})

	// 数据库查询
	const sql = "select * from users where username='" + username + "' and password='" + password + "'"
	let dbclient = this.app.get('dbclient')
	dbclient.query(sql, [], (err, res) => {
		console.log('查询到结果', sql, err, res)
		if (err) {
			next(null, { code: 501, error: '登录失败' })
		} else {
			if (res && res.length > 0) {
				//put user into channel
				this.app.rpc.chat.hallRemote.joinHall(session, this.app.get('serverId'), username, null)
				next(null, { code: 0, data: res[0] })
			} else {
				next(null, { code: 502, error: '登录失败' })
			}
		}
	})
}


/**
 * 创建群
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 */
handler.createGroup = function (msg, session, next) {
	let name = msg.name
	var sql = "select * from groups where name='" + name + "'"
	let dbclient = this.app.get('dbclient')
	dbclient.query(sql, [], (err, res) => {
		if (err) {
			next(null, { code: 501, error: '创建群失败' })
		} else {
			if (res && res.length > 0) {
				next(null, { code: 500, error: '创建群失败，改群已存在' })
			} else {
				dbclient.query('INSERT INTO groups SET ?', { name: name, admin: session.get('username') },
					function (err, res) {
						if (err) {
							next(null, { code: 500, error: '创建群失败' })
						} else {
							next(null, { code: 0 })
						}
					})
			}
		}
	})
}

/**
 * 获取群信息
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 */
handler.getGroups = function (msg, session, next) {
	let username = session.get('username')
	var sql = "select * from groups where admin='" + username + "'"
	let dbclient = this.app.get('dbclient')
	dbclient.query(sql, [], (err, res) => {
		if (err) {
			next(null, { code: 500, error: '获取群信息失败' })
		} else {
			if (res && res.length > 0) {
				next(null, { code: 0, data: res })
			} else {
				next(null, { code: 51, error: '获取群信息失败' })
			}
		}
	})
}

/**
 * 创建房间
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 */
handler.createRoom = function (msg, session, next) {
	let groupid = msg.groupid
	let name = msg.name
	let count = msg.count

	var sql = "select * from rooms where groupid='" + groupid + "' and name='" + name + "'"
	let dbclient = this.app.get('dbclient')
	dbclient.query(sql, [], (err, res) => {
		if (err) {
			console.log(err)
			next(null, { code: 501, error: '创建房间失败' })
		} else {
			if (res && res.length > 0) {
				next(null, { code: 500, error: '创建房间失败，改房间已存在' })
			} else {
				dbclient.query('INSERT INTO rooms SET ?', { name: name, groupid: groupid, count: count },
					function (err, res) {
						if (err) {
							next(null, { code: 500, error: '创建房间失败' })
						} else {
							next(null, { code: 0 })
						}
					})
			}
		}
	})
}

/**
 * 获取房间信息
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 */
handler.getRooms = function (msg, session, next) {
	let groupid = msg.groupid
	var sql = "select * from rooms where groupid=" + groupid
	let dbclient = this.app.get('dbclient')
	dbclient.query(sql, [], (err, res) => {
		if (err) {
			next(null, { code: 500, error: '获取房间息失败' })
		} else {
			if (res && res.length > 0) {
				next(null, { code: 0, data: res })
			} else {
				next(null, { code: 51, error: '获取房间息失败' })
			}
		}
	})
}

var onSessionClosed = function (app, session) {
	if (!session || !session.uid) {
		return;
	}
	app.rpc.chat.hallRemote.leaveHall(session, app.get('serverId'), session.get('username'), null)
	app.rpc.chat.roomRemote.leaveRoom(session, app.get('serverId'), session.get('roomname'), session.get('username'), null);
};

/**
 *	加入房间
 *
 * @param {*} msg
 * @param {*} session
 * @param {*} next
 * @returns
 */
handler.joinRoom = function (msg, session, next) {
	var self = this;
	var roomname = msg.roomname
	var username = msg.username
	var sessionService = self.app.get('sessionService');

	//duplicate log in
	if (!!sessionService.getByUid(username)) {
		next(null, {
			code: 500,
			error: '重复登录'
		});
		return;
	}

	session.bind(username)
	session.set('roomname', roomname)
	session.push('roomname', function (err) {
		if (err) {
			console.error('set roomname for session service failed! error is : %j', err.stack)
		}
	});
	session.set('username', username)
	session.push('username', function (err) {
		if (err) {
			console.error('set username for session service failed! error is : %j', err.stack)
		}
	})
	session.on('closed', onUserLeave.bind(null, self.app));

	//put user into channel
	self.app.rpc.chat.roomRemote.joinRoom(session, self.app.get('serverId'), roomname, username, function (result) {
		next(null, result)
	})
}