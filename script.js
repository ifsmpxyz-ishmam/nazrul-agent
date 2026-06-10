document.addEventListener("DOMContentLoaded", () => {

  // ================================
  // NAVBAR SCROLL EFFECT
  // ================================
  const navbar = document.getElementById("navbar");
  window.addEventListener("scroll", () => {
    navbar.classList.toggle("scrolled", window.scrollY > 60);
  });

  // ================================
  // HAMBURGER MENU
  // ================================
  const hamburger = document.getElementById("hamburger");
  const mobileMenu = document.getElementById("mobileMenu");

  hamburger.addEventListener("click", () => {
    mobileMenu.classList.toggle("open");
  });

  // Close mobile menu on link click
  mobileMenu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      mobileMenu.classList.remove("open");
    });
  });

  // ================================
  // FAQ TOGGLE
  // ================================
  function toggleFaq(el) {
    const answer = el.nextElementSibling;
    const arrow = el.querySelector(".faq-arrow");
    const isOpen = answer.classList.contains("open");

    // Close all
    document.querySelectorAll(".faq-a").forEach(a => a.classList.remove("open"));
    document.querySelectorAll(".faq-arrow").forEach(a => {
      a.style.transform = "rotate(0deg)";
      a.textContent = "+";
    });

    // Open clicked if it was closed
    if (!isOpen) {
      answer.classList.add("open");
      arrow.style.transform = "rotate(45deg)";
      arrow.textContent = "+";
    }
  }

  // Expose to global
  window.toggleFaq = toggleFaq;

  // ================================
  // STATS COUNTER ANIMATION
  // ================================
  function animateCounter(el, target, duration = 2000) {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        el.textContent = target.toLocaleString();
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(start).toLocaleString();
      }
    }, 16);
  }

  // Trigger when stats section is visible
  const statsSection = document.getElementById("stats");
  let statsAnimated = false;

  const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !statsAnimated) {
        statsAnimated = true;
        document.querySelectorAll(".stat-num").forEach(el => {
          const target = parseInt(el.dataset.target);
          animateCounter(el, target);
        });
      }
    });
  }, { threshold: 0.3 });

  if (statsSection) statsObserver.observe(statsSection);

  // ================================
// CONTACT FORM
// ================================
const form = document.getElementById("contactForm");

if (form) {
    form.addEventListener("submit", () => {
        const btn = form.querySelector(".form-submit");
        btn.textContent = "Sending...";
        btn.disabled = true;
        
    });
}
  // ================================
  // SMOOTH SCROLL for nav links
  // ================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", (e) => {
      const target = document.querySelector(anchor.getAttribute("href"));
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: "smooth" });
      }
    });
  });

  // ================================
  // SCROLL REVEAL ANIMATION
  // ================================
  const revealElements = document.querySelectorAll(
    ".service-card, .testimonial-card, .faq-item, .stat-item"
  );

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, { threshold: 0.1 });

  revealElements.forEach(el => {
    el.style.opacity = "0";
    el.style.transform = "translateY(20px)";
    el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    revealObserver.observe(el);
  });


// ================================
  // AIRTABLE REVIEWS
  // ================================
  const AIRTABLE_TOKEN = 'patCVS8LLjijglKPR.da0c941593ddd1f5103f75c51b99c782c1b943ed9b78df5ba753ee0bf75ea52f';
  const AIRTABLE_BASE = 'app2Ej8l8tDNDGJ6X';
  const AIRTABLE_TABLE = 'Table%201';
 
  let selectedRating = 0;
 
  // Star rating selector
  const stars = document.querySelectorAll('#starSelect span');
  stars.forEach(star => {
    star.addEventListener('mouseover', () => {
      const val = parseInt(star.dataset.val);
      stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= val));
    });
    star.addEventListener('mouseout', () => {
      stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= selectedRating));
    });
    star.addEventListener('click', () => {
      selectedRating = parseInt(star.dataset.val);
      stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= selectedRating));
    });
  });
 
  // Render stars
  function renderStars(rating) {
    const r = Math.round(rating) || 5;
    return '★'.repeat(r) + '☆'.repeat(5 - r);
  }

  // Escape HTML for reviews
  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
 
  // Load 3 latest approved reviews
  async function loadPreviewReviews() {
    const container = document.getElementById('reviews-preview');
    try {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}?filterByFormula={Approved}=1&maxRecords=3&sort[0][field]=Name&sort[0][direction]=desc`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}` }
      });
      const data = await res.json();
      const records = data.records || [];
 
      if (records.length === 0) {
        container.innerHTML = '<div class="reviews-loading">No reviews yet. Be the first!</div>';
        return;
      }
 
      container.innerHTML = records.map(r => {
        const f = r.fields;
        const initials = (f.Name || 'A').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        return `
          <div class="testimonial-card">
            <div class="stars">${renderStars(f.Rating)}</div>
            <p>"${escapeHtml(f.Review || '')}"</p>
            <div class="testimonial-author">
              <div class="author-avatar">${initials}</div>
              <div>
                <div class="author-name">${f.Name || 'Anonymous'}</div>
                <div class="author-company">${f.Company || ''}</div>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = '<div class="reviews-loading">Could not load reviews.</div>';
    }
  }
 
  // Submit review to Airtable
  async function submitReview() {
    const name = document.getElementById('rName').value.trim();
    const company = document.getElementById('rCompany').value.trim();
    const review = document.getElementById('rReview').value.trim();
    const btn = document.getElementById('rSubmit');
    const success = document.getElementById('rSuccess');
 
    if (!name || !review || selectedRating === 0) {
      alert('Please fill in your name, rating, and review.');
      return;
    }
 
    btn.textContent = 'Submitting...';
    btn.disabled = true;
 
    try {
      const res = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${AIRTABLE_TABLE}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: {
            Name: name,
            Company: company,
            Review: review,
            Rating: selectedRating,
            Approved: false
          }
        })
      });
 
      if (res.ok) {
        document.getElementById('rName').value = '';
        document.getElementById('rCompany').value = '';
        document.getElementById('rReview').value = '';
        selectedRating = 0;
        stars.forEach(s => s.classList.remove('active'));
        btn.textContent = 'Submit Review';
        btn.disabled = false;
        success.style.display = 'block';
        setTimeout(() => { success.style.display = 'none'; }, 6000);
      } else {
        throw new Error('Failed');
      }
    } catch (err) {
      btn.textContent = 'Submit Review';
      btn.disabled = false;
      alert('Something went wrong. Please try again.');
    }
  }
 
  window.submitReview = submitReview;
  loadPreviewReviews();
});
