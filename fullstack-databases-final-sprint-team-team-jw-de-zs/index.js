// Desciption: This is a chat program that offer persistant memory storage for users and messages, written in JS express,
//             uses moongoose to interact with MongoDB and Websockets to connect the users to the coversation.  Program 
//             meets all requirements set in problem outline. Can open multiple windows on localhost:3000 and login multiple users.
//               
// Authors: JW-DE-ZS
// Date:April 20th,2-25




const express = require("express");
const expressWs = require("express-ws");
const path = require("path");
const mongoose = require("mongoose");
const session = require("express-session");
const bcrypt = require("bcrypt");

const chatUtils = require("./utils/chatUtils");

const User = require("./models/User");
const Message = require("./models/Message");


const PORT = 3000;
//TODO: Replace with the URI pointing to your own MongoDB setup...Or just keep it as is..?
const MONGO_URI = "mongodb://127.0.0.1:27017/realtime_chat";
const app = express();
expressWs(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.use(
  session({
    secret: "chat-app-secret",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Good for HTTP... Change and test for true as well
  })
);

// Authentication middleware, seperates out the users and provides them access to authenticated.ejs, 
const isAuthenticated = (request, response, next) => {
  if (request.session && request.session.userId) {
      return next();
  }
  response.redirect('/login');
};

// Admin middleware...like above but for admins
const isAdmin = (request, response, next) => {
  if (request.session && request.session.role === 'admin') {
      return next();
  }
  response.status(403).render('error', { message: 'Access denied. Admin privileges required.' });
};



//Here be Users...
let connectedClients = [];

// Function to broadcast to all connected clients. 
function broadcastMessage(message) {
  const messageStr = JSON.stringify(message);
  connectedClients.forEach(client => {
      if (client.socket.readyState === 1) { // Check connection
          client.socket.send(messageStr);
      }
  });
}

//Note: These are (probably) not all the required routes, nor are the ones present all completed.
//But they are a decent starting point for the routes you'll probably need

//Websocket connections

app.ws("/ws", async (socket, request) => {
  if (!request.session || !request.session.username) {
    socket.close();
    return;
  }

  const username = request.session.username;


  chatUtils.onNewClientConnected(socket, username, connectedClients, broadcastMessage);

  socket.on("message", async (rawMessage) => {
    try {
      const parsedMessage = JSON.parse(rawMessage);

      if (parsedMessage.type === "chatMessage") {
        await chatUtils.onNewMessage(
          parsedMessage.message,
          username,
          request.session.Id,
          broadcastMessage
        );
      }
    } catch (error) {
      console.log("Error processing message: ", error);
    }
  });

  socket.on("close", () => {
    chatUtils.onClientDisconnected(username, connectedClients, broadcastMessage); //Added broadcastMessage function,
    // This was causing the error with logout...
  });
});

// Page Routes

app.get("/", async (request, response) => {
  // Check if user is already on the chat...
  if (request.session.userId) {
    return response.redirect("/dashboard"); // Redirect to dashboard if logged in
  }

  try {
    // `connectedClients` is an array of users
    const onlineUserCount = connectedClients.length;

    // Render the unauthenticated page 
    response.render("index/unauthenticated", { onlineUserCount });//Must display number of users.
  } catch (error) {
    console.error("Error:", error); // Log any errors
    response.status(500).render("error", { message: "Internal server error" });
  }
});

app.get("/login", (request, response) => {
  const errorMessage = request.query.error || null;
  const successMessage = request.query.success || null;
  response.render("login", { errorMessage, successMessage });//This allows for successful signup message to us same 
                                                             //placement as error message, added new styles
});

app.post("/login", async (request, response) => {
  const successMessage = null;
    try {
        const { username, password } = request.body;
        
        if (!username || !password) {
            
        }
        
        // Find user by username
        const user = await User.findOne({ username });
        
        if (!user) {
            return response.render('login', { errorMessage: 'Invalid username or password' });
        }
        
        
        // Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) {
            return response.render('login', { errorMessage: 'Invalid username or password' });
        }
        
        // Set session data
        request.session.userId = user._id;
        request.session.username = user.username;
        request.session.role = user.role;
        
        response.redirect('/dashboard');
    } catch (error) {
        console.error('Login error:', error);
        response.render('login', { errorMessage: 'An error occurred during login' });
    }
});

app.get("/signup", (request, response) => {
  if (request.session.userId) {
    return response.redirect("/dashboard");
  }
  const errorMessage = request.query.error || null;
  response.render("signup", { errorMessage });
});

app.post("/signup", async (request, response) => {
  try {
    const { username, password, confirmPassword } = request.body;

    if (!username || !password) {
      return response.render("signup", { errorMessage: "All fields are required" });
    }

    if (password.length < 8) {
      return response.render('signup', { errorMessage: 'Password must be a minimum of 8 characters' });
    }

    if (password !== confirmPassword) {
      return response.render("signup", { errorMessage: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return response.render("signup", { errorMessage: "Username already exists" });
    }

    // Makes new user
    const newUser = new User({
      username,
      password: password,
      role: "user",
      joinDate: new Date(),
    });

    await newUser.save();

    // Redirect to login
    response.redirect("/login?success=Account created successfully");
   
  } catch (error) {
    console.error("Signup error:", error);
    response.render("signup", { errorMessage: "An error occurred during signup" });
  }
});

// Dashboard route, protected by the middleware function 
app.get('/dashboard', isAuthenticated, async (request, response) => {
  try {
      // Get recent messages
      const recentMessages = await chatUtils.getRecentMessages(50);
      
      // Get current user
      const user = await User.findById(request.session.userId);
      
      if (!user) {
          request.session.destroy();
          return response.redirect('/login');
      }
      
      response.render('index/authenticated', {
          username: user.username,
          messages: recentMessages,
          userId: user._id,
          role: user.role
      });
  } catch (error) {
      console.error('Dashboard error:', error);
      response.status(500).render('error', { message: 'Internal server error' });
  }
});

// Admin dashboard route
app.get('/admin/dashboard', isAuthenticated, isAdmin, async (request, response) => {
  try {
    const role = request.session.role;
    const users = await User.find().sort({ username: 1 });
    response.render('admin/dashboard', { users, role });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    response.status(500).render('error', { message: 'Internal server error' });
  }
});
//Delete user from database
app.post("/dashboard/remove/:userId", isAuthenticated, isAdmin, async (request, response) => {
  try {
    const userId = request.params.userId;
    
    
    const deletedUser = await User.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return response.status(404).render("error", { message: "User not found or could not be deleted" });
    }
    
    console.log(`User ${deletedUser.username} successfully deleted from database`);//COnfirm delete happens in MongoDB
    response.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Error removing user:", error);
    response.status(500).render("error", { message: "Internal server error" });
  }
});



//Gets the user's own profile... Profile in the navbar
app.get("/profile", isAuthenticated, async (request, response) => {
  try {
    const user = await User.findById(request.session.userId);

    if (!user) {
      return response.status(404).render("error", { message: "User not found" });
    }

    response.render("profile", {
      title: "Profile",
      username: user.username,
      joinDate: user.joinDate,
      role: user.role,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    response.status(500).render("error", { message: "Internal server error" });
  }
});


// Gets someone elses... hyperlinks in onlineUser 
app.get("/profile/:username", isAuthenticated, async (request, response) => {
  try {
      const profileUsername = request.params.username;
      const user = await User.findOne({ username: profileUsername });

      if (!user) {
          return response.status(404).render("error", { message: "User not found" });
      }

      response.render("profile", {
          title: `${profileUsername}'s Profile`,
          username: user.username,
          joinDate: user.joinDate,
          role: user.role,
          // Pass the current user's username to determine if this is the viewer's own profile
          currentUser: request.session.username
      });
  } catch (error) {
      console.error("Error fetching profile:", error);
      response.status(500).render("error", { message: "Internal server error" });
  }
});



app.get("/logout", (request, response) => {
  request.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return response
        .status(500)
        .render("error", { message: "Internal server error" });
    }
    response.redirect("/");
  });
});

//Establish connection to db and create a default admin user.
mongoose 
  .connect(MONGO_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    return User.findOne({ role: "admin" }).then((adminUser) => {
      if (!adminUser) {
        console.log("Creating default admin");
        const defaultAdmin = new User({
          username: "admin",
          password: "admin123",
          role: "admin",
          joinDate: new Date(),
        });
        return defaultAdmin.save();
      }
    });
  })
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Server running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error("MongoDB connection error:", err));
