
// Establish a WebSocket connection to the server
const socket = new WebSocket('ws://localhost:3000/ws');

socket.addEventListener('open', () => {
    console.log('WebSocket connection established');
    socket.send(JSON.stringify({ type: 'test', message: 'hello' })); // test
});

// Listen for messages from the server
socket.addEventListener('message', (event) => {
    console.log("should have something", event.data)
    try {
        const data = JSON.parse(event.data);
        if (data.type === 'poll-update') {
            console.log("Poll update received:", data);
            onIncomingVote(data);
        } else {
            console.log("Unexpected data type:", data.type);
        }
    } catch (err) {
        console.error("Error parsing message:", err);
    }
    //TODO: Handle the events from the socket
});


/**
 * Handles adding a new poll to the page when one is received from the server
 * 
 * @param {*} data The data from the server (ideally containing the new poll's ID and it's corresponding questions)
 */
function onNewPollAdded(data) {
    //TODO: Fix this to add the new poll to the page
    
    const pollContainer = document.getElementById('polls');
    const newPoll = null;
    pollContainer.appendChild(newPoll);

    //TODO: Add event listeners to each vote button. This code might not work, it depends how you structure your polls on the poll page. However, it's left as an example 
    //      as to what you might want to do to get clicking the vote options to actually communicate with the server
    newPoll.querySelectorAll('.poll-form').forEach((pollForm) => {
        pollForm.addEventListener('submit', onVoteClicked);
    });
}

/**
 * Handles updating the number of votes an option has when a new vote is recieved from the server
 * 
 * @param {*} data The data from the server (probably containing which poll was updated and the new vote values for that poll)
 */
function onIncomingVote(data) {
    const poll = data.poll;
    const id = document.getElementById(poll.id);

    if(id){
        let options = id.querySelector(".poll-options");
        options.innerHTML='';

        poll.options.forEach(({answer, votes}) =>{
            options.innerHTML += `<li>><strong>${answer}:</strong> ${votes} votes</li>`
        });


        console.log("vote cast")
    }else{
        console.error("vote failed");
    }


};
/**
 * Handles processing a user's vote when they click on an option to vote
 * 
 * @param {FormDataEvent} event The form event sent after the user clicks a poll option to "submit" the form
 */
function onVoteClicked(event) {
    //Note: This function only works if your structure for displaying polls on the page hasn't changed from the template. If you change the template, you'll likely need to change this too
    event.preventDefault();
    const formData = new FormData(event.target);

    const pollId = formData.get("poll-id");
    const selectedOption = event.submitter.value;
    
    //TOOD: Tell the server the user voted
    console.log(`Poll ID: ${pollId}, Selected Option: ${selectedOption}`);
    socket.send(JSON.stringify({type: 'vote', pollId, option: selectedOption}));
}

//Adds a listener to each existing poll to handle things when the user attempts to vote
document.querySelectorAll('.poll-form').forEach((pollForm) => {
    pollForm.addEventListener('submit', onVoteClicked);
});
