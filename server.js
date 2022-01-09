// express
const express = require('express');
const app = express();
// bodyParser
app.use(express.urlencoded({extended: true}));
// ejs
app.set('view engine', 'ejs');
app.use('/public', express.static('public'));
// method-override
const methodOverride = require('method-override');
app.use(methodOverride('_method'));
// dotenv
require('dotenv').config();

// mongoDB
const MongoClient = require('mongodb').MongoClient;
var db;
MongoClient.connect(process.env.DB_URL, function(error, client) {
  if (error) {
    console.log(error);
  } else {
    db = client.db('MyToDoApp');
    app.listen(process.env.PORT, function() {
      console.log('listening on 7700');
    });
  }
});

app.get('/detail/:id', function(req, res) {
  db.collection('post').findOne({ _id : parseInt(req.params.id) }, function(error, result) {
    console.log(result);
    res.render('detail.ejs', { data : result });
  });
});

app.get('/edit/:id', function(req, res) {
  db.collection('post').findOne({ _id : parseInt(req.params.id) }, function(error, result) {
    console.log(result);
    console.log(result.date.toISOString().substring(0, 23));
    res.render('edit.ejs', { data : result });
  });
});

app.put('/edit', function(req, res) {
  db.collection('post').updateOne({ _id : parseInt(req.body.id) }, { $set : { title : req.body.title, date : new Date(req.body.date), detail : req.body.detail } }, function(error, result) {
    console.log('Edit Completed!');
    res.redirect('/list');
  });
});

// passport
const passport = require('passport');
// passport-local
const LocalStrategy = require('passport-local').Strategy;
// express-session
const session = require('express-session');
// middleware
app.use(session({secret: 'mysecretcode', resave: true, saveUninitialized: false}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/login', function(req, res) {
  res.render('login.ejs');
});

app.post('/login', passport.authenticate('local', {
  failureRedirect: '/fail'
}), function(req, res) {
  res.redirect('/');
});

function isLoggedIn(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.render('sign.ejs');
  }
}

passport.use(new LocalStrategy({
  usernameField: 'id', // name value in the form
  passwordField: 'pw', // name value in the form
  session: true, // save id and pw in the session?
  passReqToCallback: false // authenticate values other than id and pw?
}, function(inputID, inputPW, done) { // callback function to authenticate user's id and pw
  console.log(inputID, inputPW);
  db.collection('user').findOne({ id : inputID }, function(error, result) { // get user data from db
    // when error
    if (error) {
      return done(error);
    }
    // when result doesn't exist
    if (!result) {
      return done(null, false, { message : 'ID does not exist' });
    }
    // when result exists
    if (inputPW == result.pw) {
      // when password is correct
      return done(null, result);
    } else {
      // when password is wrong
      return done(null, false, { message : 'Wrong password' });
    }
  })
}));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});
passport.deserializeUser(function(id, done) {
  db.collection('user').findOne({ id : id }, function(error, result) {
    done(null, result);
  });
});

app.get('/', function(req, res) {
  console.log(req.user);
  res.render('index.ejs', {user : req.user});
});

app.get('/write', isLoggedIn, function(req, res) {
  res.render('write.ejs');
});

app.post('/register', function(req, res) {
  db.collection('user').insertOne({ id : req.body.newID, pw : req.body.newPW, name : req.body.newName }, function(error, result) {
    res.redirect('/');
  });
});

app.post('/add', function(req, res) {
  console.log(req.body.title);
  console.log(req.body.date);
  db.collection('counter').findOne({name: 'the number of posts'}, function(error, result) {
    console.log(result.totalPosts);
    var totalPosts = result.totalPosts;
    var insert = {
      _id : totalPosts + 1,
      title : req.body.title,
      date : new Date(req.body.date),
      writer : req.user._id,
      detail : req.body.detail,
      complete : false
    };
    db.collection('post').insertOne(insert, function(error, result) {
      console.log('saved!');
      // increment the number of total posts
      db.collection('counter').updateOne({name: 'the number of posts'}, { $inc:{totalPosts:1} }, function(error, result) {
        if (error) {
          console.log(error);
        } else {
          console.log(result);
        }
        res.redirect('/list');
      });
    });
  });
});

app.delete('/delete', function(req, res) {
  console.log(req.body);
  req.body._id = parseInt(req.body._id);
  var data = {
    _id : req.body._id,
    writer : req.user._id
  };
  db.collection('post').deleteOne(data, function(error, result) {
    if (error) {
      console.log(error);
      res.status(400).send( {message : 'Delete failed!'} );
    } else {
      console.log('Deleted success!');
      res.status(200).send({ message : 'Delete success!' });
    }
  });
});

app.get('/list', isLoggedIn, function(req, res) {
  db.collection('post').find({ writer : req.user._id }).sort({date : 1}).toArray(function(error, result) {
    console.log(result);
    console.log(req.user);
    res.render('list.ejs', {posts: result, user : req.user});
  });
});

app.put('/complete/:id', function(req, res) {
  db.collection('post').updateOne({ _id : parseInt(req.params.id) }, { $set : { complete : false } }, function(error, result) {
    if (error) {
      console.log(error);
    }
    console.log("Updated to incomplete!");
    res.redirect('/list');
  });
})

app.put('/list/:id', function(req, res) {
  var complete;
  db.collection('post').findOne({ _id : parseInt(req.params.id) }, function(error, result) {
    complete = result.complete;
    if (complete) {
      db.collection('post').updateOne({ _id : parseInt(req.params.id) }, { $set : { complete : false } }, function(error, result) {
        if (error) {
          console.log(error);
        }
        console.log("Updated to incomplete!");
        res.redirect('/list');
      });
    } else if (!complete) {
      db.collection('post').updateOne({ _id : parseInt(req.params.id) }, { $set : { complete : true } }, function(error, result) {
        if (error) {
          console.log(error);
        }
        console.log("Updated to complete!");
        res.redirect('/list');
      });
    }
  })
  
})

app.get('/mypage', isLoggedIn, function(req, res) {
  db.collection('post').find({ writer : req.user._id }).toArray(function(error, result) {
    res.render('mypage.ejs', { user : req.user, lists : result });
  })
});

app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/');
});