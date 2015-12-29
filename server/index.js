var config = require('./lib/config.js');

var WebSocketServer = require('ws').Server,
	url = require("url"),
	assert = require('assert'),
	wss = new WebSocketServer({
		host: process.env.OPENSHIFT_NODEJS_IP || config.WEBSOCKET_HOST,
		port: parseInt(process.env.OPENSHIFT_NODEJS_PORT) || config.WEBSOCKET_PORT
	});

// var Db = require('mongodb').Db,
// 	Server = require('mongodb').Server,
// 	db = new Db('backendqna'
// 		, new Server(process.env.OPENSHIFT_MONGODB_DB_HOST || config.MONGODB_HOST
// 			, parseInt(process.env.OPENSHIFT_MONGODB_DB_PORT) || config.MONGODB_PORT
// 	));

var MongoClient = require('mongodb').MongoClient,
	mongoDbCompleteUrl = (process.env.OPENSHIFT_MONGODB_DB_URL || config.MONGODB_URL) + 'backendqna';
	db = null;

var RoomController = require('./lib/room-controller.js'),
	AdminController = require('./lib/admin-controller.js'),
	QuestionController = require('./lib/question-controller.js'),
	roomController = null;
	adminController = null;
	questionController = null;

console.log(mongoDbCompleteUrl);
MongoClient.connect(mongoDbCompleteUrl, function (err, dbObj) {
	// workaround?
	assert.equal(err, null);
	assert.notEqual(dbObj, null);
	db = dbObj;

	roomController = new RoomController(db);
	adminController = new AdminController(db);
	questionController = new QuestionController(db);

	console.log("Init completed! All is set!");
});


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
	DELETE_QN: 13,
	CREATE_ROOM: 14,
	DELETE_ROOM: 15
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

		console.log("An admin has logged in! Number of admins online: %d", adminController.getNumAdmins());
		ws.on('message', function (msgStr) {
			var msgObj = JSON.parse(msgStr),
				content = msgObj.content;

			switch(msgObj.type) {
				case msgType.APPROVE_QN:
					questionController.approveQuestion(content, function (qnObj) {
						adminController.notifyAll(function (ws) {
							send(ws, msgType.APPROVE_QN, content);
						});

						roomController.broadcast(qnObj.roomId, function (ws) {
							send(ws, msgType.SEND_QN, qnObj);
						});
					});
					break;
				case msgType.DELETE_QN:
					questionController.deleteQuestion(content, function (success) {
						if(!success) {
							return;
						}

						adminController.notifyAll(function (ws) {
							send(ws, msgType.DELETE_QN, content);
						});
					});
					break;
				case msgType.CREATE_ROOM:
					roomController.createRoom(content, function (success) {
						var txtMsg = "Room \"" + content.id + "\" is successfully created!";
						if(!success) {
							txtMsg = "Room \"" + content.id + "\" is not successfully created!";
						}
						send(ws, msgType.CREATE_ROOM, txtMsg);
					});
					break;
				case msgType.DELETE_ROOM:
					roomController.deleteRoom(content, function (success) {
						var txtMsg = "Room \"" + content + "\" is successfully deleted!";
						if(!success) {
							txtMsg = "Room \"" + content + "\" is not successfully deleted!";
						}
						send(ws, msgType.CREATE_ROOM, txtMsg);
					}, function (ws) {
						ws.close(wsCloseCode, "This room has been deleted!");
					});
					break;
				default:
					// ignore message
					break;
			}
		});

		ws.on('close', function (code, reason) {
			adminController.removeAdmin(ws);
			console.log("An admin has left. Number of admins online: %d", adminController.getNumAdmins());
		});
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
					// will never happen, unless catch exception and return false in room-controller
					if(!success) {
						ws.close(wsCloseCode, "Unable to add user to room \"" + roomId + "\"!");
						return;
					}

					// give the client a list of questions asked previously
					send(ws, msgType.QN_LIST, {
						roomSettings: roomController.getSettings(roomId),
						questionList: questionList
					});

					console.log("A new user \"%s\" has connected. Total client now: %d", username, wss.clients.length);
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
										// notify all online admin
										adminController.notifyAll(function (ws) {
											send(ws, msgType.SEND_UNFILTERED_QN, content);
										});
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
						console.log("A client has left. Number of clients now: %d", wss.clients.length);
					});
				});

			});
		} else {
			ws.close(wsCloseCode, "Room ID does not exist!");
		}
	});
});
