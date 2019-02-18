var roomRemote = require('../remote/roomRemote');

module.exports = function (app) {
	return new Handler(app);
};

var Handler = function (app) {
	this.app = app;
};

var handler = Handler.prototype;

/**
 * Send messages to users
 *
 * @param {Object} msg message from client
 * @param {Object} session
 * @param  {Function} next next stemp callback
 *
 */
handler.send = function (msg, session, next) {
	var roomname = session.get('roomname')
	var username = session.get('username')
	var channelService = this.app.get('channelService');
	channel = channelService.getChannel(roomname, false);
	channel.pushMessage({ from: username, route: 'onChat', content: msg.content });

	next(null, { code: 0 });
}

handler.sendCMD = function (cmd, session, next) {
	cmd.username = session.get('username')
	this.app.rpc.chat.roomRemote.onCMD(session, cmd, function () {
		next(null, { code: 0 })
	})
}
