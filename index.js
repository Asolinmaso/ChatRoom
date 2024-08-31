const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketio = require('socket.io');
const User = require('./models/User');
const Message = require('./models/Message');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

mongoose.connect('mongodb+srv://Balaji:1234@cluster0.lsbl5ui.mongodb.net/Chatroom?retryWrites=true&w=majority&appName=Cluster0');


app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render('index');
});

io.on('connection', (socket) => {
  socket.on('joinRoom', async ({ username, room }) => {
    await User.findOneAndDelete({ username, room });

    const user = new User({ username, room, socketId: socket.id });
    await user.save();

    socket.join(room);

    // Load chat history
    const chatHistory = await Message.find({ room }).sort({ time: 1 });
    socket.emit('loadMessages', chatHistory);

    // Notify others of the new user
    socket.broadcast.to(room).emit('message', {
      username: 'System',
      text: `${username} has joined the chat`,
    });

    updateRoomUsers(room);

    socket.on('chatMessage', async (msg) => {
      const message = new Message({ username, room, text: msg });
      await message.save();

      io.to(room).emit('message', message);
    });

    socket.on('typing', () => {
      socket.broadcast.to(room).emit('typing', username);
    });

    socket.on('disconnect', async () => {
      await User.findOneAndDelete({ socketId: socket.id });
      socket.leave(room);

      io.to(room).emit('message', {
        username: 'System',
        text: `${user.username} has left the chat`,
      });

      updateRoomUsers(room);
    });
  });
});

async function updateRoomUsers(room) {
  const users = await User.find({ room });
  io.to(room).emit('roomUsers', {
    room,
    users: users.map(user => user.username),
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
