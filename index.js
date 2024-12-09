const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { connect } = require('http2');
const { connected } = require('process');
const { request } = require('http');

const PORT = 3000;
//TODO: Update this URI to match your own MongoDB setup
const MONGO_URI = 'mongodb://localhost:27017/FinalsDatabase';
const app = express();
expressWs(app);
const SALT_ROUNDS = 10;

// moved the connection up here made more sense to me
mongoose.connect(MONGO_URI)
    .then(() => app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)))
    .catch((err) => console.error('MongoDB connection error:', err));


const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
  });

const pollSchema = new mongoose.Schema({
    question: {type: String, required: true},
    options: [
        {
            answer: {type: String, required: true},
            votes: { type: Number, required: true, default: 0 },
        }
    ]
});

const User = mongoose.model('User', userSchema);
const Polls = mongoose.model('Polls', pollSchema);

// some middleware so that the header can check is someone is signed in
app.use((request, response, next) => {
    response.locals.session = request.session;
    next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(session({
    secret: 'voting-app-secret',
    resave: false,
    saveUninitialized: false,
    cookie:{
        secure: false
    }
}));
let connectedClients = [];

//Note: Not all routes you need are present here, some are missing and you'll need to add them yourself.

// app.ws('/ws', (socket, request) => {
//     connectedClients.push(socket);
                                                                                                // THIS WAS A TEST TO SEE IF SOCKET WAS WORKING
//     socket.on('message', (message) => {
//         console.log("Message received from client:", message);
//     });

//     socket.on('close', () => {
//         connectedClients = connectedClients.filter((client) => client !== socket);
//         console.log("Client disconnected");
//     });
// });





app.ws('/ws', (socket, request) => {
    connectedClients.push(socket);

    socket.on('message', async (message) => {
        try {
            const data = JSON.parse(message);
            console.log("Parsed message from client:", data); // Debug log

            if (data.type === "vote") {
                console.log("Processing vote:", data);
                await onNewVote(data.pollId, data.option);
            } else {
                console.warn("Unhandled message type:", data.type);
            }
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    });

});






app.get('/', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }
    const polls = await Polls.find();
    response.render('index/unauthenticatedIndex', { polls , totalPolls: polls.length, session: request.session});
});








app.get('/login', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }
    
    response.render("login")
});



app.post('/goBack', async(request, response)=>{
    response.redirect('/')
});



app.get('/authenticatedIndex', async (request, response) =>{
    try{
        const polls = await Polls.find();
        response.render('index/authenticatedIndex', { polls, totalPolls: polls.length, session: request.session });
    }catch(err){
        console.log("whoops!")
    }
    
});









app.post('/login', async (request, response) => {
    
    const {username, password} = request.body;
    
    try {
        const user = await User.findOne({username: username});
        
        if(!user){
            return response.render("login", {errorMessage: "Invalid Credentials."})
        }

        const checkPass = bcrypt.compareSync(password, user.password);

        if(!checkPass){
            return response.render("login", {errorMessage: "Invalid Credentials."})
        }
    
        request.session.user = {id: user._id, username: user.username};
        response.redirect('/authenticatedIndex');
    }catch(err){
        response.render("login", {errorMessage: "There was an error signing in."})
    }

   
});

app.post('/logout', async(request, response) =>{
    request.session.destroy();
    response.redirect('/dashboard')
});







app.get('/signup', async (request, response) => {
    if (request.session.user?.id) {
        return response.redirect('/dashboard');
    }

    return response.render('signup', { errorMessage: null });
});








app.post("/signup", async (req, res) => {
    const { username, password } = req.body;

    try {
       
        const hashedPassword = bcrypt.hashSync(password, SALT_ROUNDS);

    
        const newUser = new User({ username, password: hashedPassword });

       
        await newUser.save();
        console.log("User saved to MongoDB");

        res.render("signup", { errorMessage: "Your account has been made" });
    } catch (err) {
        console.error("Error saving user to MongoDB:", err);
    }
});










// ~~I guess i don't need a get for the dashboard? i need post for the nav button. get doesnt do anything? am i stupid? i'm stupid~~
// UPDATE: i am actually stupid. i need get for redirects and POST for form submission. dummy

app.get('/dashboard', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }
    const polls = await Polls.find();
    //TODO: Fix the polls, this should contain all polls that are active. I'd recommend taking a look at the
    //authenticatedIndex template to see how it expects polls to be represented
    return  response.render('index/authenticatedIndex', { polls, totalPolls: polls.length, session: request.session })
});

app.post('/dashboard', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }
    const polls = await Polls.find();
    //TODO: Fix the polls, this should contain all polls that are active. I'd recommend taking a look at the
    //authenticatedIndex template to see how it expects polls to be represented
    return  response.render('index/authenticatedIndex', { polls, totalPolls: polls.length, session: request.session })
});





app.get('/profile', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }

    return response.render('profile', {session: request.session})
});

app.post('/profile', async(request, response)=>{
    if (!request.session.user?.id) {
        return response.redirect('/');
    }

    return response.render('profile', {session: request.session})
});





app.get('/createPoll', async (request, response) => {
    if (!request.session.user?.id) {
        return response.redirect('/');
    }

    return response.render('createPoll', {session: request.session})
});









// Poll creation
app.post('/createPoll', async (request, response) => {
    const { question, options } = request.body;
    const formattedOptions = Object.values(options).map((option) => ({ answer: option, votes: 0 }));

    const test = onCreateNewPoll(question, formattedOptions);
    if(!test){
        response.render("createPoll", {errorMessage: "Poll womp", session: request.session})
    }
    response.render("createPoll", {successMessage: "Poll made", session: request.session})
    //TODO: If an error occurs, what should we do?
});











/**
 * Handles creating a new poll, based on the data provided to the server
 * 
 * @param {string} question The question the poll is asking
 * @param {[answer: string, votes: number]} pollOptions The various answers the poll allows and how many votes each answer should start with
 * @returns {string?} An error message if an error occurs, or null if no error occurs.
 */
async function onCreateNewPoll(question, pollOptions) {
    try {
        //TODO: Save the new poll to MongoDB
        const newPoll = new Polls({ question, options: pollOptions }); 
        await newPoll.save();
        console.log("Poll saved to MongoDB");
        //TODO: Tell all connected sockets that a new poll was added
        for (const client of connectedClients) {
            if (client.readyState === 1) {
              client.send(JSON.stringify({ type: "newPoll", Polls }));
            }
          }
       
        // response.render("createPoll", { successMessage: "Your poll has been made!" })   
    
    }catch (error) {
        console.error(error);
        return "Error creating the poll";
    }

    
    

    return null;
}









/**
 * Handles processing a new vote on a poll
 * 
 * This function isn't necessary and should be removed if it's not used, but it's left as a hint to try and help give
 * an idea of how you might want to handle incoming votes
 * 
 * @param {string} pollId The ID of the poll that was voted on
 * @param {string} selectedOption Which option the user voted for
 */

// SENDS TO MONGO DATABASE PLEAAAAAAAAAAAAAAAAAASE DONT FORGET TO UPDATE THIS LATER
async function onNewVote(pollId, selectedOption) {
    try {
        const poll = await Polls.findById(pollId);
        if(!poll){
            console.log("Cannot be found")
            return;
        }

        const option = poll.options.find((select) => select.answer === selectedOption);
        if(option){
            option.votes+=1;
            await poll.save();
            console.log("poll updated")
            for (const client of connectedClients){
                if(client.readyState ===1){
                    client.send(JSON.stringify({type:"updatePoll", poll}));
                }
            }
        }
    }
    catch (error) {
        console.error('Error updating poll:', error);
    }
}
