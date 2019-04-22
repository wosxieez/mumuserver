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
// 	[ 18, 8, 18, 9, 7, 17, 16, 18 ],
// 	[ { cards: [ 11, 13, 12 ], name: 'chi' },
//   { name: 'chi', cards: [ 2, 1, 3 ] },
//   { cards: [ 6, 16, 6 ], name: 'chi' },
//   { name: 'chi', cards: [ 14, 14, 4 ] } ], 18)
// console.log(canHuData)
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