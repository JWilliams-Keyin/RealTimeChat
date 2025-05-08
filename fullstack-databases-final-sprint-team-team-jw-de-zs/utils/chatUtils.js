const Message = require('../models/Message');
/**Find majority of functions controling the excbhnge of data using datasockets.
 * Shares overlap with functions in frontend.js and powers the routes in index.js and the JS on authenticated.ejs
 * 
 * First up function below handles a client disconnecting from the chat server...
 * 
 * This function isn't necessary and should be deleted if unused. But it's left as a hint to how you might want 
 * to handle the disconnection of clients -WE CHOSE TO INCORPOPRATE IT
 * 
 * @param {string} username The username of the client who disconnected
 * @param {Array} connectedClients Array of connected clients
 * @param {Function} broadcastMessage Function to broadcast messages to all clients
 */
function onClientDisconnected(username, connectedClients, broadcastMessage) {
    const index = connectedClients.findIndex(client => client.username === username);
    if (index != -1) {
        connectedClients.splice(index, 1)
        // Message sent when someone disconnects
        broadcastMessage({
            type: 'userDisconnected',
            username: username,
            timestamp: new Date(),
            onlineUsers: connectedClients.map(client => client.username)
        });
    }
}

/**
 * Handles a new client connecting to the chat server
 * 
 * 
 * @param {WebSocket} newSocket The socket the client has opened with the server
 * @param {string} username The username of the user who connected
 * @param {Array} connectedClients Array of connected clients
 * @param {Function} broadcastMessage Function to broadcast messages to all clients
 */
function onNewClientConnected(newSocket, username, connectedClients, broadcastMessage) {
    // Check if user is already connected...
  const existingClientIndex = connectedClients.findIndex(client => client.username === username);

  if (existingClientIndex !== -1) {
    // If user is already connected replace the existing socket with the new one
    connectedClients[existingClientIndex].socket = newSocket;
  } else {
    // If user doesn't exist qdd new client to connected clients list
    connectedClients.push({ socket:newSocket, username: username });
    // Message sent when someone joins
    broadcastMessage({
        type: 'userConnected',
        username: username,
        timestamp: new Date(),
        message: `User ${username} has joined the chat!`,
        onlineUsers: connectedClients.map(client => client.username)
    });
  }
}

/**
 * Handles a new chat message being sent from a client
 * 
 * This function isn't necessary and should be deleted if unused. But it's left as a hint to how you might want 
 * to handle new messages
 * 
 * @param {string} message The message being sent
 * @param {string} username The username of the user who sent the message
 * @param {string} id The ID of the user who sent the message
 * @param {Function} broadcastMessage Function to broadcast messages to all clients
 */
async function onNewMessage(messageContent, username, id, broadcastMessage) {
    try {
        const message = new Message({
            content: messageContent,
            sender: username,
            timestamp: new Date()
        });

        await message.save();

        broadcastMessage({
            type: 'chatMessage',
            message: messageContent,
            sender: username,
            timestamp: message.timestamp
            });
        
        return message;
    } catch (error) {
        console.log('Error saving message:', error);
        throw error;
    }
}

/**
 * Retrieves recent messages from the database
 * 
 * @param {number} limit Maximum number of messages to retrieve
 */
async function getRecentMessages(limit = 50) {
    try {
      const messages = await Message.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      
      return messages.reverse();
    } catch (error) {
      console.error('Error retrieving recent messages:', error);
      throw error;
    }
  }


module.exports = {
    onClientDisconnected,
    onNewClientConnected,
    onNewMessage,
    getRecentMessages
}