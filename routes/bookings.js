const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const authMiddleware = require('../middleware/authMiddleware');

// === BOOK AN EVENT ===
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.body;

    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Check capacity
    if (event.bookedCount >= event.capacity) {
      return res.status(400).json({ message: 'Event is fully booked' });
    }

    // Check if already booked
    const existingBooking = await Booking.findOne({
      event: eventId,
      guest: req.user.id
    });
    if (existingBooking) {
      return res.status(400).json({ message: 'You already booked this event' });
    }

    // Create booking
    const booking = new Booking({
      event: eventId,
      guest: req.user.id
    });
    await booking.save();

    // Update booked count
    event.bookedCount += 1;
    await event.save();

    res.status(201).json({ message: 'Booking confirmed', booking });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === GET MY BOOKINGS ===
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ guest: req.user.id })
      .populate('event')
      .sort({ createdAt: -1 });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === GET MY HOSTED EVENTS ===
router.get('/hosted', authMiddleware, async (req, res) => {
  try {
    const events = await Event.find({ host: req.user.id })
      .sort({ date: 1 });
    res.json(events);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// === CANCEL BOOKING ===
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.guest.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Booking.findByIdAndDelete(req.params.id);

    // Decrease booked count
    await Event.findByIdAndUpdate(booking.event, {
      $inc: { bookedCount: -1 }
    });

    res.json({ message: 'Booking cancelled successfully' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;