var WebSocketServer = require('ws').Server,
	url = require("url"),
	assert = require('assert'),
	wsPort = 8080,
	wss = new WebSocketServer({port: wsPort});

var Db = require('mongodb').Db,
	Server = require('mongodb').Server,
	mongoDbPort = 27017,
	db = new Db('qna', new Server('localhost', mongoDbPort));

var RoomController = require('./lib/room-controller.js'),
	roomController = new RoomController(db),
	AdminController = require('./lib/admin-controller.js'),
	adminController = new AdminController(db);

var wsCloseCode = 1000;

// This must match that of client!
var msgType = {
	UPVOTE: 0,
	DOWNVOTE: 1,
	SEND_QN: 2,
	QN_LIST: 3,

	UNFILTERED_QN_LIST: 10,
	SEND_UNFILTERED_QN: 11,
	APPROVE_QN: 12,
	DELETE_QN: 13
};

function send(ws, type, content) {
	ws.send(JSON.stringify({
		type: type,
		content: content
	}));
}

function serveAdmin(ws) {
	var location = url.parse(ws.upgradeReq.url, true),
		secretKey = location.query['key'];

	if(!adminController.verifyKey(secretKey)) {
		ws.close(wsCloseCode, "Wrong secret key!");
		return;
	}

	adminController.retrieveAll(function (questionList) {
		adminController.addAdmin(ws);
		send(ws, msgType.UNFILTERED_QN_LIST, questionList);
	});
}

wss.on('connection' , function (ws) {
	if(adminController.isAdmin(ws)) {
		serveAdmin(ws);
		return;
	}

	var location = url.parse(ws.upgradeReq.url, true),
		roomId = location.pathname.slice(1),
		username = location.query['username'];

	if(!roomController.isValid(username, roomId)) {
		ws.close(wsCloseCode, 'Invalid username or room ID!');
		return;
	}

	roomController.hasRoom(roomId, function (roomExist) {
		if(roomExist) {
			roomController.retrieveAll(roomId, function (questionList) {

				// add client to observers
				roomController.addObserver(roomId, ws, function (success) {
					if(!success) {
						return;
					}

					// give the client a list of questions asked previously
					send(ws, msgType.QN_LIST, {
						roomSettings: roomController.getSettings(roomId),
						questionList: questionList
					});

					ws.on('message', function (msgStr) {
						var msgObj = JSON.parse(msgStr),
							content = msgObj.content;

						switch(msgObj.type) {
							case msgType.SEND_QN:
								roomController.addQuestion(content, function(success) {
									if(!success) {
										return;
									}

									if(content.filtered) {
										roomController.broadcast(roomId, function (ws) {
											send(ws, msgType.SEND_QN, content);
										});
									} else {
										// TODO: Notify admin
									}
								});
								break;
							case msgType.UPVOTE:
								roomController.upvoteQuestion(content.username, content.roomId, content.questionId, function (success) {
									if(!success) {
										return;
									}

									roomController.broadcast(roomId, function (ws) {
										send(ws, msgType.UPVOTE, content);
									});
								});
								break;
							case msgType.DOWNVOTE:
								roomController.downvoteQuestion(content.username, content.roomId, content.questionId, function (success) {
									if(!success) {
										return;
									}

									roomController.broadcast(roomId, function (ws) {
										send(ws, msgType.DOWNVOTE, content);
									});
								})
								break;
							default: // ignore message
								break;
						}
					});

					ws.on('close', function (code, reason) {
						roomController.removeObserver(roomId, ws);
					});
				});

			});
		} else {
			ws.close(wsCloseCode, 'Room ID does not exist!');
		}
	});
});
