// === API URL ===
const API = '';

// === GET TOKEN ===
function getToken() {
  return localStorage.getItem('token');
}

// === GET USER ===
function getUser() {
  return JSON.parse(localStorage.getItem('user'));
}

// === AUTH HEADERS ===
function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

// === LOGOUT ===
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}

// === FORMAT DATE ===
function formatDate(dateString) {
  const options = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return new Date(dateString).toLocaleDateString('en-US', options);
}// === SWITCH TAB ===
function switchTab(tab) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const tabs = document.querySelectorAll('.tab');

  tabs.forEach(t => t.classList.remove('active'));

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    tabs[0].classList.add('active');
  } else {
    signupForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    tabs[1].classList.add('active');
  }
}

// === SIGNUP ===
async function signup() {
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  const role = document.getElementById('signup-role').value;
  const feedback = document.getElementById('signup-feedback');

  if (!username || !email || !password) {
    feedback.className = 'feedback error';
    feedback.textContent = 'All fields are required.';
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role })
    });

    const data = await res.json();

    if (!res.ok) {
      feedback.className = 'feedback error';
      feedback.textContent = data.message;
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    feedback.className = 'feedback success';
    feedback.textContent = 'Account created! Redirecting...';

    setTimeout(() => {
      window.location.href = '/events.html';
    }, 1000);

  } catch (error) {
    feedback.className = 'feedback error';
    feedback.textContent = 'Something went wrong. Try again.';
  }
}

// === LOGIN ===
async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const feedback = document.getElementById('login-feedback');

  if (!email || !password) {
    feedback.className = 'feedback error';
    feedback.textContent = 'All fields are required.';
    return;
  }

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      feedback.className = 'feedback error';
      feedback.textContent = data.message;
      return;
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    feedback.className = 'feedback success';
    feedback.textContent = 'Login successful! Redirecting...';

    setTimeout(() => {
      window.location.href = '/events.html';
    }, 1000);

  } catch (error) {
    feedback.className = 'feedback error';
    feedback.textContent = 'Something went wrong. Try again.';
  }
}// === SHOW/HIDE CREATE FORM ===
function showCreateForm() {
  document.getElementById('form-overlay').classList.add('active');
}

function hideCreateForm() {
  document.getElementById('form-overlay').classList.remove('active');
  document.getElementById('event-feedback').textContent = '';
}

// === LOAD ALL EVENTS ===
async function loadEvents() {
  const user = getUser();
  if (!user) { window.location.href = '/'; return; }

  // Show create button for hosts only
  if (user.role === 'host') {
    document.getElementById('create-btn').style.display = 'block';
  }

  try {
    const res = await fetch(`${API}/api/events`);
    const events = await res.json();
    const grid = document.getElementById('events-grid');

    if (events.length === 0) {
      grid.innerHTML = '<p class="empty-state">No events yet. Check back soon!</p>';
      return;
    }

    grid.innerHTML = events.map(event => {
      const isFull = event.bookedCount >= event.capacity;
      const fillPercent = Math.min((event.bookedCount / event.capacity) * 100, 100);
      const isHost = user.role === 'host';

      return `
        <div class="event-card">
          <h3>${event.title}</h3>
          <p>${event.description}</p>
          <div class="event-meta">
            <span>📍 <strong>${event.location}</strong></span>
            <span>📅 <strong>${formatDate(event.date)}</strong></span>
            <span>👤 <strong>Hosted by ${event.host.username}</strong></span>
            <span>🎟 <strong>${event.bookedCount}/${event.capacity} spots filled</strong></span>
          </div>
          <div class="capacity-bar">
            <div class="capacity-fill ${isFull ? 'full' : ''}"
              style="width: ${fillPercent}%"></div>
          </div>
          <div class="event-actions">
            ${!isHost ? `
              <button class="btn-small" onclick="bookEvent('${event._id}')"
                ${isFull ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                ${isFull ? 'Fully Booked' : 'Book Now'}
              </button>
            ` : `
              <button class="btn-danger" onclick="deleteEvent('${event._id}')">
                Delete
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    document.getElementById('events-grid').innerHTML =
      '<p class="empty-state">Failed to load events.</p>';
  }
}

// === CREATE EVENT ===
async function createEvent() {
  const title = document.getElementById('event-title').value.trim();
  const description = document.getElementById('event-description').value.trim();
  const location = document.getElementById('event-location').value.trim();
  const date = document.getElementById('event-date').value;
  const capacity = document.getElementById('event-capacity').value;
  const feedback = document.getElementById('event-feedback');

  if (!title || !description || !location || !date || !capacity) {
    feedback.className = 'feedback error';
    feedback.textContent = 'All fields are required.';
    return;
  }

  try {
    const res = await fetch(`${API}/api/events`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ title, description, location, date, capacity })
    });

    const data = await res.json();

    if (!res.ok) {
      feedback.className = 'feedback error';
      feedback.textContent = data.message;
      return;
    }

    hideCreateForm();
    loadEvents();

  } catch (error) {
    feedback.className = 'feedback error';
    feedback.textContent = 'Something went wrong.';
  }
}

// === BOOK EVENT ===
async function bookEvent(eventId) {
  try {
    const res = await fetch(`${API}/api/bookings`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ eventId })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message);
      return;
    }

    alert('Booking confirmed!');
    loadEvents();

  } catch (error) {
    alert('Something went wrong.');
  }
}

// === DELETE EVENT ===
async function deleteEvent(eventId) {
  if (!confirm('Are you sure you want to delete this event?')) return;

  try {
    const res = await fetch(`${API}/api/events/${eventId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.message);
      return;
    }

    loadEvents();

  } catch (error) {
    alert('Something went wrong.');
  }
}// === LOAD DASHBOARD ===
async function loadDashboard() {
  const user = getUser();
  if (!user) { window.location.href = '/'; return; }

  document.getElementById('dashboard-subtitle').textContent =
    `Welcome back, ${user.username}!`;

  if (user.role === 'host') {
    document.getElementById('host-view').style.display = 'block';
    loadHostedEvents();
  } else {
    document.getElementById('guest-view').style.display = 'block';
    loadMyBookings();
  }
}

// === LOAD HOSTED EVENTS ===
async function loadHostedEvents() {
  try {
    const res = await fetch(`${API}/api/bookings/hosted`, {
      headers: authHeaders()
    });

    const events = await res.json();
    const grid = document.getElementById('hosted-events');

    if (events.length === 0) {
      grid.innerHTML = '<p class="empty-state">You have not created any events yet.</p>';
      return;
    }

    grid.innerHTML = events.map(event => {
      const fillPercent = Math.min((event.bookedCount / event.capacity) * 100, 100);
      return `
        <div class="event-card">
          <h3>${event.title}</h3>
          <div class="event-meta">
            <span>📍 <strong>${event.location}</strong></span>
            <span>📅 <strong>${formatDate(event.date)}</strong></span>
            <span>🎟 <strong>${event.bookedCount}/${event.capacity} spots filled</strong></span>
          </div>
          <div class="capacity-bar">
            <div class="capacity-fill" style="width: ${fillPercent}%"></div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    document.getElementById('hosted-events').innerHTML =
      '<p class="empty-state">Failed to load events.</p>';
  }
}

// === LOAD MY BOOKINGS ===
async function loadMyBookings() {
  try {
    const res = await fetch(`${API}/api/bookings/my`, {
      headers: authHeaders()
    });

    const bookings = await res.json();
    const grid = document.getElementById('my-bookings');

    if (bookings.length === 0) {
      grid.innerHTML = '<p class="empty-state">You have not booked any events yet.</p>';
      return;
    }

    grid.innerHTML = bookings.map(booking => `
      <div class="event-card">
        <h3>${booking.event.title}</h3>
        <div class="event-meta">
          <span>📍 <strong>${booking.event.location}</strong></span>
          <span>📅 <strong>${formatDate(booking.event.date)}</strong></span>
        </div>
        <span class="badge badge-confirmed">Confirmed</span>
        <div class="event-actions">
          <button class="btn-danger" onclick="cancelBooking('${booking._id}')">
            Cancel Booking
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    document.getElementById('my-bookings').innerHTML =
      '<p class="empty-state">Failed to load bookings.</p>';
  }
}

// === CANCEL BOOKING ===
async function cancelBooking(bookingId) {
  if (!confirm('Cancel this booking?')) return;

  try {
    const res = await fetch(`${API}/api/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.message);
      return;
    }

    loadMyBookings();

  } catch (error) {
    alert('Something went wrong.');
  }
}// === DETECT CURRENT PAGE AND LOAD ===
const path = window.location.pathname;

if (path === '/events.html') loadEvents();
if (path === '/dashboard.html') loadDashboard();