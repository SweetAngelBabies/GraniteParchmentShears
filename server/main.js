var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var path = require('path');
var bodyParser = require('body-parser');
var browserify = require('browserify-middleware');
var history = require('connect-history-api-fallback');
var db = require('./db');

module.exports = app;


//--------------Express Middlware-------------//
//--------------------------------------------//
// Load all files --> get this to load style files in index.html
app.use(express.static(path.join(__dirname, "../client/public")));
// Parse the body of response
app.use(bodyParser.json());

/* Generic error handling: Commented out because express comes with default error handling
    app.use(function(err, req, res, next) {
      console.error(err.stack);
      res.status(500).send('Something broke!');
  }); */

//----------------- Server/Database Calls--------------------//
//----------------------------------------------------------//

// taking accessCode from request body, create new game record in db
app.post('/api/games', (req, res) => {
  db('games').insert({
    access_code: req.body.accessCode,
    status: 'waiting'
  })
  .returning('id')
  .then(gameId => {
    console.log(gameId)
    res.send(gameId)
  })
  // We were handling errors this way:
  .catch((err) => {
    console.error(err);
    res.sendStatus(500);
  });
});

// taking gameId and username from request body, create new user record in db
app.post('/api/users', (req, res) => {
  db('users').insert({
    game_id: req.body.gameId,
    name: req.body.name,
    score: 0,
    status: 'waiting'
  })
  .returning('id')
  .then(userId => {
    res.send(userId)
  })
});

// returns array of game objects
app.get('/api/games', (req, res) => {
  db.select('*').from('games')
    .then(rows => {
      res.send(rows);
    })
});

// returns array of player objects that match a given gameId
app.get('/api/games/:gameId/users', (req, res) => {
  db('users').where('game_id', req.params.gameId)
    .then(rows => {
      res.send(rows);
    })
});

// returns the game that matches a given gameId
app.get('/api/games/:gameId', (req, res) => {
  db('games').where('id', req.params.gameId)
    .then(rows => {
      res.send(rows);
    })
});

//----- updates game status that matches a given gameId----//
//---------------------------------------------------------//
app.patch('/api/gameStatus', (req, res) => {
  db('games').where('id', req.body.gameId).update('status', req.body.status)
    .then(() => {
      res.send({});
    })
});

app.patch('/api/resetUser', (req, res) => {
  db('users').where('id', req.body.userId).update({
    status: 'waiting',
    score: 0
  })
    .then(() => {
      res.send({});
    })
});

//------------ post player throw-------------//
//--------------------------------------------//
app.patch('/api/userMove', (req, res) => {
  let move = req.body.move;
  let userId = req.body.userId;

  // insert the move under status where id === userId
  db('users').where('id', userId).update({status: move})
    .then(() => {
      res.send({});
	    // res.sendStatus(200);
    })
});

// delete user by id
app.delete('/api/users', (req,res) => {
  db('users').where('id', req.body.userId).del()
    .then(() => {
      res.send({});
    })
});

// delete game by id
app.delete('/api/games', (req,res) => {
  db('games').where('id', req.body.gameId).del()
    .then(() => {
      res.send({});
    })
});

//----------- increment player score----------//
//--------------------------------------------//
app.patch('/api/incUserScore', (req,res) => {
  let userId = req.body.userId;

  // increment the score by 1 where id === userId
  db('users').where('id', req.body.userId).increment('score', 1)
    .then(() => {
      res.send({userId});
    })
});

//------------ get player object by id-------//
//-------------------------------------------//
app.get('/api/users/:id', (req,res) => {
  db.select('*').from('users').where('id', req.params.id)
    .then((data) => {
      res.send(data)
    })
})
//------get opponent object by player id-----//
//-------------------------------------------//
app.get('/api/users/:userId/opponent/:gameId', (req,res) => {
  var userId = req.params.userId;
  var gameId = req.params.gameId;
  db.select('*').from('users').where('game_id', '=', gameId).whereNot('id', '=', userId)
    .then((data) => {
      res.send(data)
    })
})
//---------------------------------------------------------------------------//

// use history api fallback middleware after defining db routes
// to not interfere with get requests
app.use(history());


app.get('/app-bundle.js',
 browserify('./client/main.js', {
    transform: [ [ require('babelify'), { presets: ["es2015", "react"] } ] ]
  })
);

//---  socket.io is listening for queues triggered by ----//
//---  players, then emits information to both     ----//
io.on('connection', function(socket){
	socket.on('join game', gameId => {
		io.emit('join game', gameId)
	})

	socket.on('leave game', gameId => {
		io.emit('leave game', gameId)
	})

	socket.on('start game', gameId => {
		io.emit('start game', gameId)
	})

	socket.on('resolve round', gameId => {
		io.emit('resolve round', gameId)
	})

	socket.on('end game', data => {
		io.emit('end game', data)
	})

	socket.on('rematch', gameId => {
		io.emit('rematch', gameId)
	})
})

var port = process.env.PORT || 4000;
http.listen(port);
console.log("Listening on localhost:" + port);
