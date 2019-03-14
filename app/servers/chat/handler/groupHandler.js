module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
};

var handler = Handler.prototype;

/**
 * push message to group users
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */

handler.pushMessage = function (message, session, next) {
	// console.log('---------------------------服务器', this.app.get('serverId'), '---------------------------')
	// console.log('pushMessage')
	const groupname = session.get('groupname')
	channel = this.app.get('channelService').getChannel(groupname, false)
	if (!!channel) {
		channel.pushMessage({ route: 'onMessage', data: message })
		next(null, { code: 0, data: '发送成功' })
	} else {
		next(null, { code: 500, data: '发送失败, 该群不存在' })
	}

	// console.log('---------------------------------------------------------------------------')
}