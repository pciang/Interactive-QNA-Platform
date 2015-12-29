var qna = function () {
	'use strict';

	var connection = null,
		usernamePattern = /[a-zA-Z]\w+/,
		roomIdPattern = /[a-zA-Z]\w+/,
		currentUsername = null,
		currentRoomId = null,
		roomSettings = {
			hasDownvote: true,
			adminFilter: true
		},
		loadingOverlay = document.getElementById("loading-overlay");

	/*
		Change these variables if you want to run on localhost
	*/
	var protocol = config.WS_PROTOCOL,
		hostname = config.WS_HOSTNAME,
		port = config.WS_PORT,
		url = protocol + '://' + hostname + ':' + port + '/';

	// This must match that of server!
	var msgType = {
		UPVOTE: 0,
		DOWNVOTE: 1,
		SEND_QN: 2,
		QN_LIST: 3
	};

	// initialize angular
	var angularApp = angular.module('qna', []);
	angularApp.controller('main', function ($scope, $interval) {
		$scope.questionList = [];
		$scope.enableAddQuestion = false;
		$scope.isConnected = isConnected;
		$scope.disconnect = disconnect;
		$scope.countUpvotes = function (question) {
			if(roomSettings.hasDownvote) {
				return question.upvoters.length - question.downvoters.length;
			}
			return question.upvoters.length;
		};
		$scope.hasDownvote = function () {
			return roomSettings.hasDownvote;
		};

		// This is a hack (probably dirty)
		// If anyone is reading this, please help me clean it
		// Thanks
		addQuestion = addQuestion.bind(undefined, $scope);
		enableAddQuestion = enableAddQuestion.bind(undefined, $scope);
		cleanUp = cleanUp.bind(undefined, $scope);

		$scope.upvote = upvote.bind(undefined, $scope);
		$scope.downvote = downvote.bind(undefined, $scope);
		upvoteQuestion = upvoteQuestion.bind(undefined, $scope);
		downvoteQuestion = downvoteQuestion.bind(undefined, $scope);

		$scope.refreshInterval = 12000; // 12s
		$scope.transitionTime = 2000; // 2s
		
		startPeriodicRefresh = startPeriodicRefresh.bind(undefined, $scope, $interval);
		stopPeriodicRefresh = stopPeriodicRefresh.bind(undefined, $scope, $interval);
	});

	// hacks for Angular
	var startPeriodicRefresh = function (ngScope, ngInterval) {
		ngScope.promise = ngInterval(function () {
			toggleLoadingSpinner();
			// ngScope.$apply();
			setTimeout(function () {
				toggleLoadingSpinner();
			}, ngScope.transitionTime)
		}, ngScope.refreshInterval);
	}

	var stopPeriodicRefresh = function (ngScope, ngInterval) {
		ngInterval.cancel(ngScope.promise);
	}

	var addQuestion = function (ngScope, question) {
		ngScope.questionList.push(question);

		ngScope.$apply();
		// ngScope.toggleDirty();
	};

	var enableAddQuestion = function (ngScope) {
		ngScope.enableAddQuestion = true;
		ngScope.$apply();
	};

	var cleanUp = function (ngScope) {
		ngScope.questionList = [];
		ngScope.enableAddQuestion = false;
		ngScope.$apply();
	};

	var upvote = function (ngScope, roomId, questionId) {
		send(msgType.UPVOTE, {
			username: currentUsername,
			roomId: roomId,
			questionId: questionId
		});
	};

	var downvote = function (ngScope, roomId, questionId) {
		send(msgType.DOWNVOTE, {
			username: currentUsername,
			roomId: roomId,
			questionId: questionId
		});
	};

	var upvoteQuestion = function (ngScope, questionId, username) {
		var dirty = false,
			idx,
			qn = null;

		for(var i = 0, size = ngScope.questionList.length; i < size; ++i) {
			if(ngScope.questionList[i]._id == questionId) {
				qn = ngScope.questionList[i];
				break;
			}
		}

		if(qn == null) {
			return;
		}

		idx = qn.downvoters.indexOf(username);
		if(idx > -1) {
			qn.downvoters.splice(idx, 1);
			dirty = true;
		}

		idx = qn.upvoters.indexOf(username);
		if(idx == -1) {
			qn.upvoters.push(username);
			dirty = true;
		}

		// if(dirty) {
		// 	ngScope.$apply();
		// }

		// Better fix?
		if(dirty && currentUsername == username) {
			ngScope.$apply();
		}
	};

	var downvoteQuestion = function (ngScope, questionId, username) {
		var dirty = false,
			idx,
			qn = null;

		for(var i = 0, size = ngScope.questionList.length; i < size; ++i) {
			if(ngScope.questionList[i]._id == questionId) {
				qn = ngScope.questionList[i];
				break;
			}
		}

		if(qn == null) {
			return;
		}

		idx = qn.upvoters.indexOf(username);
		if(idx > -1) {
			qn.upvoters.splice(idx, 1);
			dirty = true;
		}

		idx = qn.downvoters.indexOf(username);
		if(idx == -1) {
			qn.downvoters.push(username);
			dirty = true;
		}

		// if(dirty) {
		// 	ngScope.$apply();
		// }

		// Better fix?
		if(dirty && currentUsername == username) {
			ngScope.$apply();
		}
	};
	// end of hacks

	var toggleLoadingSpinner = function () {
		if(loadingOverlay.style.display == "none") {
			loadingOverlay.style.display = "block";
		} else {
			loadingOverlay.style.display = "none";
		}
	}

	var isAttempting = function () {
		return connection != null;
	};

	var connect = function (username, roomId) {
		if(isAttempting()) {
			alert("Please be patient!\nYour browser is attempting to connect, or the connection has been established.");
			return;
		}

		if(!usernamePattern.test(username)) {
			alert("Username must adhere to regex rule " + usernamePattern);
			return;
		}

		if(!roomIdPattern.test(roomId)) {
			alert("Room ID must adhere to regex rule " + roomIdPattern);
			return;
		}

		// disconnect();

		// for future references
		currentUsername = username;
		currentRoomId = roomId;

		var completeUrl = url + roomId + '?' + 'username=' + username;

		connection = new WebSocket(completeUrl);
		connection.onopen = onopen;
		connection.onmessage = onmessage;
		connection.onclose = onclose;
		connection.onerror = onerror;
	};

	var onopen = function (event) {
		// console.log(event);
		cleanUp();
		enableAddQuestion();
		startPeriodicRefresh();
	};

	var onmessage = function (event) {
		var msgObj = JSON.parse(event.data),
			content = msgObj.content;

		switch(msgObj.type) {
			case msgType.QN_LIST:
				roomSettings = content.roomSettings;
				content.questionList.forEach(function (question) {
					addQuestion(question);
				});
				break;
			case msgType.SEND_QN:
				addQuestion(content);
				break;
			case msgType.UPVOTE:
				upvoteQuestion(content.questionId, content.username);
				break;
			case msgType.DOWNVOTE:
				downvoteQuestion(content.questionId, content.username);
				break;
		}
	};

	var onclose = function (event) {
		console.log("close:", event);
		if(event.reason.length > 0) {
			alert(event.reason);
		}

		stopPeriodicRefresh();
		cleanUp();
		disconnect();
	};

	var onerror = function (event) {
		console.log("error:", event);

		stopPeriodicRefresh();
		cleanUp();
		disconnect();
	};

	var disconnect = function () {
		if(connection instanceof WebSocket) {
			connection.close();
		}
		connection = null;
	};

	var isConnected = function () {
		if(connection == null) {
			return false;
		}

		return connection.readyState == 1;
	};

	var send = function (type, content) {
		if(isConnected()) {
			connection.send(JSON.stringify({
				type: type,
				content: content
			}));
			return true;
		}
		return false;
	}

	var sendQuestion = function (questionBody) {
		if(isConnected()) {
			if(questionBody.length < 4) {
				alert("Ask something! (At least 4 characters)")
				return;
			}

			var msgObj = {
				asker: currentUsername,
				roomId: currentRoomId,
				body: questionBody,
				upvoters: [],
				downvoters: [],
				filtered: !roomSettings.adminFilter
			};

			send(msgType.SEND_QN, msgObj);
		}
	};

	return {
		isConnected: isConnected,
		sendQuestion: sendQuestion,
		getRoomSettings: function () {
			return roomSettings;
		},
		connect: connect,
		disconnect: disconnect
	};
}();

document.addEventListener('DOMContentLoaded', function (event) {
	var connectBtn = document.getElementById('connect-btn'),
		usernameField = document.getElementById('username-field'),
		roomIdField = document.getElementById('room-id-field'),
		questionField = document.getElementById('question-field'),
		addQuestionBtn = document.getElementById('add-question-btn');

	connectBtn.onclick = function (event) {
		qna.connect(usernameField.value, roomIdField.value);
	};

	addQuestionBtn.onclick = function (event) {
		qna.sendQuestion(questionField.value);
		questionField.value = ""; // auto clear
	};
});