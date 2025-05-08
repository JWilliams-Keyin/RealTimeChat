//All (most?) of the functions that connect the websocket data connections to the browser.
//Supports authenticated.ejs along with index.js along with functions found in chatUtils.js and index.js.

// Initialize variables that we're getting from the DOM.
let chatMessages; 
let messageForm;
let messageInput;
let onlineUsersList;
let socket;

// Load the DOM
document.addEventListener('DOMContentLoaded', function() {
    // Get the DOM elements we need
    chatMessages = document.getElementById('chatMessages');
    messageForm = document.getElementById('messageForm');
    messageInput = document.getElementById('messageInput');
    onlineUsersList = document.getElementById('onlineUsers');
    
    // Get username from the script variable
    const username = chatUsername; 
    
    // Connect to WebSocket
    connectToWebSocket();
    

    //
    messageForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const message = messageInput.value.trim();
        if (message) {
            // Send message to server
            socket.send(JSON.stringify({
                type: 'chatMessage',
                message: message
            }));
            
            // Clear input field
            messageInput.value = '';
        }
    });
});


// Websocket connection
function connectToWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    
    socket.onopen = function() {
        console.log('Connected to chat server');
    };
    //Provide the status of messages to incorporate updates of users coming and going.
    socket.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        switch(data.type) {
            case 'chatMessage':
                addMessageToChat(data);
                break;
            
            case 'userConnected':
                addSystemMessage(data.message);
                updateOnlineUsers(data.onlineUsers);
                break;
            
            case 'userDisconnected':
                addSystemMessage(`User ${data.username} has left the chat`);
                updateOnlineUsers(data.onlineUsers);
                break;
            
            default:
                console.log('Unknown message type:', data.type);
        }
    };
    
    socket.onclose = function() {
        console.log('Disconnected from chat server');
        // Try to reconnect after 5 seconds
        setTimeout(connectToWebSocket, 5000);
    };
    
    socket.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

// Add a message to the chat.
function addMessageToChat(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${data.sender === chatUsername ? 'my-message' : 'other-message'}`;
    
    // Add user's name...
    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = data.sender;
    messageDiv.appendChild(senderDiv);
    
    // Add the message...
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = data.message;
    messageDiv.appendChild(contentDiv);
    
    // Add the formated timestamp...
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'message-timestamp';
    timestampDiv.textContent = new Date(data.timestamp).toLocaleString();
    messageDiv.appendChild(timestampDiv);
    
    // post to the chat box
    chatMessages.appendChild(messageDiv);
    
    // THis is my favorite pieces of code in the whole project... Thanks to Stack Overflow and "Automatically scroll down chat div"
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add a system message to the chat window
function addSystemMessage(message) {
    const systemDiv = document.createElement('div');
    systemDiv.className = 'system-message';
    systemDiv.textContent = message;
    
    const systemMessages = document.getElementById('systemMessages');
    if (systemMessages) {
        systemMessages.appendChild(systemDiv);
        systemMessages.scrollTop = systemMessages.scrollHeight;
    } else {
        // Fallback to old behavior if container not found
        chatMessages.appendChild(systemDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// Update the list of online users. Make all hyperlinks to connect to profile
function updateOnlineUsers(users) {
    // Start with empty list
    onlineUsersList.innerHTML = '';
    
    // Add each user
    users.forEach(user => {
        const li = document.createElement('li');
        // Create a 'link' to the user profile
        const userLink = document.createElement('a');
        userLink.href = `/profile/${user}`; // Link to their profile
        userLink.textContent = user;
        userLink.className = 'user-profile-link';
        
        // Add the link to the list item
        li.appendChild(userLink);
        onlineUsersList.appendChild(li);
    });
}