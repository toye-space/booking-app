const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const authMiddleware = require('../middleware/authMiddleware');

// === GET ALL EVENTS ===
router.get('/', async (req, res) => {
  try {
    const events = await Event.find()
      .populate('host', 'username email')
      .sort({ date: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === GET SINGLE EVENT ===
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('host', 'username email');
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json(event);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === CREATE EVENT (hosts only) ===
router.post('/', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'host') {
      return res.status(403).json({ message: 'Only hosts can create events' });
    }

    const { title, description, location, date, capacity } = req.body;

    if (!title || !description || !location || !date || !capacity) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const event = new Event({
      title,
      description,
      location,
      date,
      capacity,
      host: req.user.id
    });

    const savedEvent = await event.save();
    res.status(201).json(savedEvent);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === DELETE EVENT (host only) ===
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.host.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Event.findByIdAndDelete(req.params.id);
    res.json({ message: 'Event deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;