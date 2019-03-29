module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
};

var handler = Handler.prototype;

/**
 * Send action to room
 */
handler.sendAction = function (action, session, next) {
	// console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	// console.log('onAction', action)
	this.app.rpc.chat.groupRoomRemote.onAction(session, this.app.get('serverId'), session.get('groupname'),
		session.get('username'), action, function (result) {
			next(null, result)
		})

	// console.log('---------------------------------------------------------------------------')
}

handler.pushMessage = function (message, session, next) {
	// console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	// console.log('pushMessage')
	const groupname = session.get('groupname')
	channel = this.app.get('channelService').getChannel(groupname, false)
	if (!!channel) {
		channel.pushMessage({ route: 'onGroupRoom', data: message })
		next(null, { code: 0, data: '发送成功' })
	} else {
		next(null, { code: 500, data: '发送失败, 该房间不存在' })
	}

	// console.log('---------------------------------------------------------------------------')
}