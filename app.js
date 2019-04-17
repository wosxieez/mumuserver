var pomelo = require('pomelo');
var routeUtil = require('./app/util/routeUtil');
const CardUtil = require('./app/util/CardUtil')
const HuXiUtil = require('./app/util/HuXiUtil')

/**p
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'chatofpomelo');

// var shuns = CardUtil.shouShun([11, 11, 14, 14, 14, 1, 9, 9])
// console.log(JSON.stringify(shuns))
// return
// var canHuData = CardUtil.canHu2(
// 	[20, 4, 5, 6, 12, 17, 20],
// 	[{ name: 'chi', cards: [11, 11, 1] },
// 	{ name: 'chi', cards: [13, 14, 15] },
// 	{ name: 'pao', cards: [19, 19, 19, 19] },
// 	{ name: 'chi', cards: [8, 9, 10] }], 20)
// var huX= HuXiUtil.getHuXi(canHuData[0], 3, true)
// console.log(huX)
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