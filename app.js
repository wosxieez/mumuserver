var pomelo = require('pomelo');
var routeUtil = require('./app/util/routeUtil');
const CardUtil = require('./app/util/CardUtil')
const HuXiUtil = require('./app/util/HuXiUtil')

/**p
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'chatofpomelo');

// var canHuData = CardUtil.canHu([4, 4, 4, 2, 2, 7, 7, 10, 10, 6, 16], [
// 	{ name: 'chi', cards: [11, 12, 13] },
// 	{ name: 'chi', cards: [18, 19, 20] },
// 	{ name: 'chi', cards: [12, 17, 20] }], 6)
// var huXi = HuXiUtil.getHuXi(canHuData, 5)
// return

// app configure
app.configure('production|development', function () {

	// route configures
	app.route('chat', routeUtil.chat);

	app.set('connectorConfig', {
		connector: pomelo.connectors.hybridconnector,
		transports: ['websocket', 'polling'],
		heartbeats: false,
		closeTimeout: 60 * 1000,
		heartbeatTimeout: 60 * 1000,
		heartbeatInterval: 25 * 1000
	});
	// filter configures
	app.filter(pomelo.timeout());
});

// start app
app.start();

process.on('uncaughtException', function (err) {
	console.error(' Caught exception: ' + err.stack);
});