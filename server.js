// server.js
// where your n    return next(err.message)ode app starts

// init project
var express = require('express');
var app = express();
var bparser = require("body-parser");
var mongo = require("mongodb");
var mClient = mongo.MongoClient;
var mongo_url = process.env.MONGOURL;
var express_validator = require("express-validator")
var session = require("express-session")
var ObjectId = require('mongodb').ObjectID;

var email_regex = new RegExp("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?");

//set view engine
app.set("view engine","pug");

//middleware
app.use(bparser.json());
app.use(bparser.urlencoded({extended: true}));
app.use(express_validator());
//session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: false,
}));

//local variables for pug template dynamic rendering
app.use(function(request,response,next) {
  response.locals.currentUser = request.session.userId;
  next();
})

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('public'));

// http://expressjs.com/en/starter/basic-routing.html
app.get("/", function (request, response) {
  response.render("index")
});

app.get("/login", function(request,response) {
  response.render("login")
})

app.get("/signup",function(request,response) {
  response.render("signup.pug")
})
app.get("/logout",function(request,response) {
  request.session.destroy();
  response.redirect("/");
})

app.get("/polls",function(request,response) {
  if(request.session.userId) {
    // show the users polls
    var user_polls;
    mClient.connect(mongo_url,function(error,database) {
      database.collection("user-data").find({"_id": ObjectId(request.session.userId)}).toArray(function(error,data) {
        if(error)throw error;
        response.render("polls",{user_polls: data[0].polls})
      })
    })

  }
  else {
    var err = new Error("you are not logged in");
    response.send(err.message)
  }
});

//getting user created polls
app.get("/poll/*",function(request,response) {
  var poll_link = parseInt(request.url.split("/")[2]);
  //find poll data based on link passed in
  mClient.connect(mongo_url,function(error,database) {
    if (error)throw error;
    database.collection("user-data").aggregate([{"$unwind": "$polls"},{"$match": {"polls.link": poll_link}}]).toArray(function(error,data) {
      if (error) throw error;
      //render the data as a chart by passing values to the test_chart pug file
      //in the pug file these variables are denoted by !{}
      
      var poll_arr =[]
      for(var i =1;i<Object.keys(data[0].polls).length - 1;i++) {
        poll_arr.push(data[0].polls["option" + i]);
      }

      response.render("test_chart",{
        title: data[0].polls.title,
        op_1_name: data[0].polls.option1.name,
        op_1_count: data[0].polls.option1.count,
        op_2_name: data[0].polls.option2.name,
        op_2_count: data[0].polls.option2.count,
        poll_link: data[0].polls.link,
        poll_obj_length: Object.keys(data[0].polls).length,
        poll_obj: JSON.stringify(data[0].polls),
        poll_arr: poll_arr
      })
    })
  })
});

app.get("/all-polls",function(request,response) {
  mClient.connect(mongo_url,function(error,database) {
    if(error)throw error;
    database.collection("user-data").find({}).toArray(function(error,data) {
      var poll_arr = [];
      for(var i = 1; i< data.length; i++) {
        poll_arr.push(data[i].polls)
      }
      var final_arr = [];
      for(var i = 0;i < poll_arr.length;i++) {
        for(var x = 0; x < poll_arr[i].length;x++) {
          final_arr.push(poll_arr[i][x])
        }
      }
      response.render("all-polls",{poll_array: final_arr})
    })
  })
})

app.get("/edit-poll/*",function(request,response) {
  var poll_link = request.url.split("/edit-poll/")[1]
  poll_link = parseInt(poll_link)
  mClient.connect(mongo_url,function(error,database) {
    if(error)throw error;
    database.collection("user-data").aggregate([{"$unwind": "$polls"},{"$match": {"polls.link": poll_link}}]).toArray(function(error,data) {
      if (error)throw error;
      var poll_arr = [];
      
      for(var i=1;i<Object.keys(data[0].polls).length -1;i++) {
        poll_arr.push(data[0].polls["option" + i])
      }
      
      console.log(poll_arr)
      response.render("edit-poll",{poll_arr: poll_arr,poll_link: poll_link})
    })
  })
})




//post handling for the login form
app.post("/login",function(request,response,next) {
  
  //throw error for empty fields on login form
      if(request.body.user == "" || request.body.pass == "") {
        var err = new Error("Fields cannot be empty");
        return response.render("login",{error: err.message})
      }
  
  mClient.connect(mongo_url,function(error,database) {
    if(error)throw error;
    
    //search databse for username
    database.collection("user-data").find({username: request.body.user}).toArray(function(error,data) {
      if(error)throw error;
      
      //if user not found throw error
      if(data == "") {
        var err = new Error("user not found");
        return response.render("login",{error: err.message})
      }
      
      //if password doesnt match throw error
      if(request.body.pass != data[0].password) {
        var err = new Error("Incorrect Password");
        err.status = 400;
        return response.render("login",{error: err.message})
      }
      
      //check input against database data
      if(request.body.user.toLowerCase() == data[0].username && request.body.pass == data[0].password) {
        //authorize client with session ID
        request.session.userId = data[0]._id
        response.redirect("/")
      } 
      
    })
  })
})

//post handling for the signup form 
app.post("/signup",function(request,response,next) {
  //create object containing form data
  var user_data = {
    username: request.body.user.toLowerCase(),
    email: request.body.email,
    password: request.body.pass,
    polls: []
  }
  
  //check for empty fields
  if(request.body.user == "" || request.body.email == "" || request.body.pass == "") {
    var err = new Error("fields cannot be empty");
    return response.render("signup",{error: err.message});
  }
  
  mClient.connect(mongo_url,function(error,database) {
    if(error)throw error;
    //check if username exists, if not ,check if email exists,if not , create account
    database.collection("user-data").find({username: request.body.user}).toArray(function(error,data) {
      if(error)throw error;
      
      if(data == "") {
        database.collection("user-data").find({email: request.body.email}).toArray(function(error,data) {
          if(data == "") {
            database.collection("user-data").insertOne(user_data);
            response.redirect("/login")
          }
          else {
            err = new Error("Email is already in use");
            return response.render("signup",{error: err.message});
          }
        })
        
      }
      else {
        var err = new Error("User already exists");
        return response.render("signup",{error: err.message});
      }
      
    })
  })
})

//post handling for data from poll creation form
app.post("/create-poll",function(request,response,next) {
  //return an error if any fields are empty
  if(request.body["poll-title"] == ""|| request.body["poll-option-1"] == ""||request.body["poll-option-2"] == ""){
    var err = new Error("fields cannot be empty");
    return response.render("index",{error: err.message})
  }
  //return error if not logged in when trying to create a poll.
  if (request.session.userID == "undefined") {
    var err = new Error("you must be logged in to create a poll")
    return response.render("index",{error: err.message});
  }
  
  //increment count for poll link generation

  //initialise poll object for pushing to db
  var poll_data = {
    title: request.body["poll-title"],
    option1: {
      name: request.body["poll-option-1"],
      count: 0
    },
    option2: {
      name: request.body["poll-option-2"],
      count: 0
    },
    link: ""
  }
  
  //push poll data to users data on db based on ID
  mClient.connect(mongo_url,function(error,database) {
    if(error)throw error;
    //find the counter value by its ID, increment then pass it to the poll_data as link
    database.collection("user-data").update({_id: ObjectId("5a1d2fd3f36d280cc00f0689")},{$inc: {counter: 1}});
    database.collection("user-data").find({_id: ObjectId("5a1d2fd3f36d280cc00f0689")}).toArray(function(error,data) {
      poll_data.link = data[0].counter
      //push data to end of users polls array on database
      database.collection("user-data").update({_id: ObjectId(request.session.userId)},{$push: {polls: poll_data} })
      response.redirect("/poll/"+ data[0].counter)
    })
    
    
  })
});

//post for voting on charts
app.post("/chart-inc",function(request,response) {
  //get the link of the poll on which to increment value
  var poll_link = request.body.option.split("__")[1];
  poll_link = parseInt(poll_link)
  //get the option that was clicked on
  var option_name = request.body.option.split("__")[0];

  
  mClient.connect(mongo_url,function(error,database) {
    if (error) throw error;
    //increment value on database based on option_name
    database.collection("user-data").update({"polls.link": poll_link},{$inc: {["polls.$." + option_name + ".count"]: 1}})

    //reload poll page
    response.redirect("/poll/" + poll_link)
  })
})

//post for deleting a users poll
app.post("/delete-poll",function(request,response) {
  var poll_link = parseInt(request.body.delete_button);
  
  mClient.connect(mongo_url,function(error,database) {
    if(error)throw error;
    database.collection("user-data").update({"_id": ObjectId(request.session.userId)},{$pull: {polls: {link: poll_link}}})
  })
  response.redirect("/polls")
})

app.post("/create-test",function(request,response) {
  var ob_length = Object.keys(request.body).length;
  
  //check for whitespace in inputs
  var val_arr = Object.values(request.body)
  for(var i =0; i<val_arr.length;i++) {
    val_arr[i] = val_arr[i].trim()
  }
  if(val_arr.indexOf("") != -1) {
    response.render("test",{error: "fields cannot be empty"})
  }
  if(!request.session.userId) {
    return response.render("test",{error: "you must be logged in to create a poll"})
  }
  
  
  //object to pass to database
  var poll_obj = {
    title: request.body.title,
  }
  
  //populate the object with the option fields and values
  for (var i = 1; i < ob_length; i++) {
    poll_obj["option" + String(i)] = {
      name: request.body["option" + String(i)],
      count: 0
    }
  }
  
  //push poll to users document on db
  mClient.connect(mongo_url,function(error,database) {
    if(error)throw error;
    
    //find the counter value by its ID, increment then pass it to the poll_data as link
    database.collection("user-data").update({_id: ObjectId("5a1d2fd3f36d280cc00f0689")},{$inc: {counter: 1}});
    //find user based on session id
    database.collection("user-data").find({_id: ObjectId("5a1d2fd3f36d280cc00f0689")}).toArray(function(error,data) {
      poll_obj.link = data[0].counter
      //push data to end of users polls array on database
      database.collection("user-data").update({_id: ObjectId(request.session.userId)},{$push: {polls: poll_obj} })
      //redirect to newly created poll
      response.redirect("/poll/"+ data[0].counter)
    })
  })
})

app.post("/edit-poll",function(request,response) {
  var poll_link = request.body["submit-link"]
  poll_link = parseInt(poll_link)
  
  mClient.connect(mongo_url,function(error,database) {
    //update each option on the database based on the input data from the request body
    for(var i = 1;i < Object.keys(request.body).length;i++) {
      database.collection("user-data").update({"polls.link": poll_link},{$set: {["polls.$." + "option" + i +".name"] : request.body["option" + i]}})
    }
    database.close()
  })
  
  response.redirect("/poll/" +poll_link)
})
// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is live at port ' + listener.address().port);
});

