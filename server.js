const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Set port from environment variable with fallback
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());  // Allow all origins during development
app.use(express.json());

// Import routes
const authRoutes = require('./routes/auth');
const newsRoutes = require('./routes/news');
const postsRoutes = require('./routes/posts');
const newsletterRoutes = require('./routes/newsletter');

// API Routes - these must come BEFORE the static file serving and catch-all route
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/newsletter', newsletterRoutes);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route - this must come AFTER the API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Keep track of connected users
const connectedUsers = new Map();

// Socket.io middleware for authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('\x1b[36m%s\x1b[0m', `Socket connected: ${socket.id}`);

  // Handle user joining chat
  socket.on('join chat', async (username) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Store user information
      connectedUsers.set(socket.id, {
        username: user.username,
        userId: user._id
      });

      // Notify others that user has joined
      socket.broadcast.emit('user joined', user.username);

      // Send current users list to the newly joined user
      const usersList = Array.from(connectedUsers.values()).map(u => u.username);
      socket.emit('users list', usersList);
    } catch (error) {
      console.error('Join chat error:', error);
      socket.emit('error', { message: 'Failed to join chat' });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user) {
      io.emit('user left', user.username);
      connectedUsers.delete(socket.id);
    }
    console.log('User disconnected');
  });

  // Handle chat messages
  socket.on('chat message', async (data) => {
    try {
      const user = await User.findById(socket.userId);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      const messageData = {
        username: user.username,
        message: data.message,
        timestamp: new Date()
      };

      io.emit('chat message', messageData);
    } catch (error) {
      console.error('Chat message error:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server
server.listen(PORT, () => {
  console.log('\x1b[35m%s\x1b[0m', `Server running on port ${PORT}`);
  console.log('\x1b[30m%s\x1b[35m', 'Tech News Platform with ', 'Black & Lavender Theme');
});