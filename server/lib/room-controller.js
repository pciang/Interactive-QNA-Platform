var assert = require('assert'),
	ObjectID = require('mongodb').ObjectID;

module.exports = function (db) {
	var usernamePattern = /[a-zA-Z]\w+/,
		roomIdPattern = /[a-zA-Z]\w+/,
		roomColName = 'rooms',
		questionColName = 'questions';

	var rooms = {}, // a hash table
		defaultSettings = {
			hasDownvote: true,
			adminFilter: false
		};

	this.isValid = function (username, roomId) {
		return usernamePattern.test(username)
			&& roomIdPattern.test(roomId);
	}

	this.hasRoom = function (roomId, callback) {
		db.open(function (err, db) {
			db.collection(roomColName, function (err, col) {
				col.findOne({id: roomId}, function (err, document) {
					db.close(); // document is retrieved, safe to close
					callback(document != null);
				});
			});
		});
	}

	this.retrieveAll = function (roomId, callback) {
		db.open(function (err, db) {
			db.collection(questionColName, function (err, col) {
				col.find({roomId: roomId, filtered: true}, function (err, cursor) {
					var result = [];
					cursor.each(function (err, document) {
						if(document == null) {
							db.close();
							callback(result);
							return;
						}
						result.push(document);
					});
				});
			});
		});
	}

	this.addObserver = function (roomId, ws, callback) {
		if(!(roomId in rooms)) {
			rooms[roomId] = {
				settings: defaultSettings,
				observers: []
			};
			db.open(function (err, db) {
				db.collection(roomColName, function (err, col) {
					col.findOne({id: roomId}, function (err, document) {
						db.close();
						rooms[roomId].settings = document.settings;
						callback(true);
					});
				});
			});
		}
		rooms[roomId].observers.push(ws);
	}

	this.removeObserver = function (roomId, ws) {
		var observers = rooms[roomId].observers,
			idx = observers.indexOf(ws);
		observers.splice(idx, 1);
	}

	this.getSettings = function (roomId) {
		return rooms[roomId].settings;
	}

	this.broadcast = function (roomId, callback) {
		rooms[roomId].observers.forEach(callback.bind(undefined));
	}

	this.addQuestion = function (qnObj, callback) {
		db.open(function (err, db) {
			db.collection(questionColName, function (err, col) {
				col.insertOne(qnObj, function (err, result) {
					callback(result.result.ok == 1);
				});
			});
		});
	}

	this.upvoteQuestion = function (username, roomId, questionId, callback) {
		db.open(function (err, db) {
			db.collection(questionColName, function (err, collection) {
				collection.findOne({roomId: roomId, _id: new ObjectID(questionId)}, function (err, document) {
					var idx,
						dirty = false;

					idx = document.downvoters.indexOf(username);
					if(idx > -1) {
						dirty = true;
						document.downvoters.splice(idx, 1);
					}

					idx = document.upvoters.indexOf(username);
					if(idx == -1) {
						dirty = true;
						document.upvoters.push(username);
					}

					if(dirty) {
						collection.update({roomId: roomId, _id: new ObjectID(questionId)}
							, {$set: {upvoters: document.upvoters, downvoters: document.downvoters}}
							, function (err, result) {
								db.close();
								callback(result.result.ok == 1);
							});
					}
					else {
						db.close();
						callback(false);
					}
				});
			});
		})
	}

	this.downvoteQuestion = function (username, roomId, questionId, callback) {
		db.open(function (err, db) {
			db.collection(questionColName, function (err, collection) {
				collection.findOne({roomId: roomId, _id: new ObjectID(questionId)}, function (err, document) {
					var idx,
						dirty = false;

					idx = document.upvoters.indexOf(username);
					if(idx > -1) {
						dirty = true;
						document.upvoters.splice(idx, 1);
					}

					idx = document.downvoters.indexOf(username);
					if(idx == -1) {
						dirty = true;
						document.downvoters.push(username);
					}

					if(dirty) {
						collection.update({roomId: roomId, _id: new ObjectID(questionId)}
							, {$set: {upvoters: document.upvoters, downvoters: document.downvoters}}
							, function (err, result) {
								db.close();
								callback(result.result.ok == 1);
							});
					}
					else {
						db.close();
						callback(false);
					}
				});
			});
		})
	}
}