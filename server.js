const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARE
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ========== IN-MEMORY STORAGE ==========
let users = [];
let events = [];
let bookings = [];

// Helper to get next ID
const nextId = () => Date.now();

// ========== AUTH ROUTES ==========
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: nextId(),
      username,
      email,
      password: hashedPassword,
      role: role || 'guest',
      createdAt: new Date()
    };
    users.push(user);

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'bookingsecret123',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'bookingsecret123',
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ========== AUTH MIDDLEWARE ==========
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token. Access denied.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'bookingsecret123');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token.' });
  }
};

// ========== EVENT ROUTES ==========
// Get all events
app.get('/api/events', (req, res) => {
  const eventsWithHosts = events.map(event => ({
    ...event,
    host: users.find(u => u.id === event.hostId) || { username: 'Unknown' }
  }));
  res.json(eventsWithHosts);
});

// Get single event
app.get('/api/events/:id', (req, res) => {
  const event = events.find(e => e.id == req.params.id);
  if (!event) return res.status(404).json({ message: 'Event not found' });
  const host = users.find(u => u.id === event.hostId);
  res.json({ ...event, host });
});

// Create event (hosts only)
app.post('/api/events', authMiddleware, (req, res) => {
  if (req.user.role !== 'host') {
    return res.status(403).json({ message: 'Only hosts can create events' });
  }

  const { title, description, location, date, capacity } = req.body;
  if (!title || !description || !location || !date || !capacity) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const event = {
    id: nextId(),
    title,
    description,
    location,
    date: new Date(date),
    capacity: parseInt(capacity),
    bookedCount: 0,
    hostId: req.user.id,
    createdAt: new Date()
  };
  events.push(event);
  res.status(201).json(event);
});

// Delete event (host only)
app.delete('/api/events/:id', authMiddleware, (req, res) => {
  const eventIndex = events.findIndex(e => e.id == req.params.id);
  if (eventIndex === -1) return res.status(404).json({ message: 'Event not found' });
  
  if (events[eventIndex].hostId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  events.splice(eventIndex, 1);
  res.json({ message: 'Event deleted successfully' });
});

// ========== BOOKING ROUTES ==========
// Book an event
app.post('/api/bookings', authMiddleware, (req, res) => {
  const { eventId } = req.body;
  const event = events.find(e => e.id == eventId);
  
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.bookedCount >= event.capacity) {
    return res.status(400).json({ message: 'Event is fully booked' });
  }
  
  const existingBooking = bookings.find(b => b.eventId === eventId && b.guestId === req.user.id);
  if (existingBooking) {
    return res.status(400).json({ message: 'You already booked this event' });
  }
  
  const booking = {
    id: nextId(),
    eventId: eventId,
    guestId: req.user.id,
    status: 'confirmed',
    createdAt: new Date()
  };
  bookings.push(booking);
  event.bookedCount++;
  
  res.status(201).json({ message: 'Booking confirmed', booking });
});

// Get my bookings
app.get('/api/bookings/my', authMiddleware, (req, res) => {
  const myBookings = bookings
    .filter(b => b.guestId === req.user.id)
    .map(booking => ({
      ...booking,
      event: events.find(e => e.id === booking.eventId)
    }));
  res.json(myBookings);
});

// Get my hosted events
app.get('/api/bookings/hosted', authMiddleware, (req, res) => {
  const hostedEvents = events.filter(e => e.hostId === req.user.id);
  res.json(hostedEvents);
});

// Cancel booking
app.delete('/api/bookings/:id', authMiddleware, (req, res) => {
  const bookingIndex = bookings.findIndex(b => b.id == req.params.id);
  if (bookingIndex === -1) return res.status(404).json({ message: 'Booking not found' });
  
  if (bookings[bookingIndex].guestId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }
  
  const booking = bookings[bookingIndex];
  const event = events.find(e => e.id === booking.eventId);
  if (event) event.bookedCount--;
  
  bookings.splice(bookingIndex, 1);
  res.json({ message: 'Booking cancelled successfully' });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// START SERVER
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Using in-memory storage (no MongoDB required)`);
  console.log(`✅ Booking system ready!`);
});