/* ============================================================
 * Global Logistics Network — script.js
 *
 * Dependencies: none (vanilla JS, ES2020+)
 * All Airtable calls now route through /.netlify/functions/reviews
 * ============================================================ */

'use strict';

/* ── Utility: safe DOM query helpers ─────────────────────────────────────── */

/** Returns element or null — avoids throws on missing IDs. */
const q  = id  => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qa = sel => Array.from(document.querySelectorAll(sel));

/* ── Navbar scroll behaviour ─────────────────────────────────────────────── */

const navbar = q('navbar');

if (navbar) {
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 60);
  }, { passive: true });
}

/* ── Hamburger / mobile menu ─────────────────────────────────────────────── */

const hamburger  = q('hamburger');
const mobileMenu = q('mobileMenu');

if (hamburger && mobileMenu) {

  function setMenuOpen(open) {
    mobileMenu.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    mobileMenu.setAttribute('aria-hidden',  String(!open));
  }

  hamburger.addEventListener('click', () => {
    setMenuOpen(!mobileMenu.classList.contains('open'));
  });

  /* Close when a nav link is tapped */
  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => setMenuOpen(false));
  });

  /* Close when user clicks outside the menu */
  document.addEventListener('click', e => {
    if (!hamburger.contains(e.target) && !mobileMenu.contains(e.target)) {
      setMenuOpen(false);
    }
  });

  /* Keyboard: Escape closes the menu */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
      setMenuOpen(false);
      hamburger.focus();
    }
  });
}

/* ── Animated stat counters ──────────────────────────────────────────────── */

const COUNTER_DURATION = 1800; // ms

/**
 * Animate a single counter element from 0 to its data-target value.
 * Uses requestAnimationFrame with cubic ease-out.
 */
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  if (isNaN(target)) return;

  const startTime = performance.now();

  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / COUNTER_DURATION, 1);
    const eased    = 1 - Math.pow(1 - progress, 3); // ease-out cubic

    el.textContent = Math.floor(eased * target).toLocaleString();

    if (progress < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target.toLocaleString(); // Ensure exact final value
    }
  }

  requestAnimationFrame(step);
}

const counterEls = qa('.stat-num[data-target]');

if (counterEls.length > 0) {
  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        animateCounter(entry.target);
        observer.unobserve(entry.target); // Run once; clean up to avoid memory leaks
      }
    });
  }, { threshold: 0.35 });

  counterEls.forEach(el => counterObserver.observe(el));
}

/* ── Scroll-reveal animations ─────────────────────────────────────────────── */

const REVEAL_SELECTORS = [
  '.service-card',
  '.process-card',
  '.stat-item',
  '.faq-item',
  '.about-left',
  '.about-right',
  '.contact-item',
  '.testimonial-card',
].join(', ');

const revealEls = qa(REVEAL_SELECTORS);

if (revealEls.length > 0 && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target); // Unobserve after reveal; avoids unnecessary callbacks
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  revealEls.forEach(el => {
    el.classList.add('reveal');
    revealObserver.observe(el);
  });
}

/* ── FAQ accordion ────────────────────────────────────────────────────────── */

/**
 * Toggle a FAQ item open/closed.
 * Called by onclick="toggleFaq(this)" in index.html.
 * Also wired to keyboard events below.
 */
function toggleFaq(triggerEl) {
  const item   = triggerEl.closest('.faq-item');
  if (!item) return;

  const isOpen = item.classList.contains('open');

  /* Close every open item first */
  qa('.faq-item.open').forEach(openItem => {
    openItem.classList.remove('open');
    const btn = openItem.querySelector('.faq-q');
    const arr = openItem.querySelector('.faq-arrow');
    const ans = openItem.querySelector('.faq-a');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (arr) arr.textContent = '+';
    if (ans) ans.setAttribute('aria-hidden', 'true');
  });

  /* Open this one if it was previously closed */
  if (!isOpen) {
    item.classList.add('open');
    triggerEl.setAttribute('aria-expanded', 'true');
    const arr = item.querySelector('.faq-arrow');
    const ans = item.querySelector('.faq-a');
    if (arr) arr.textContent = '−';
    if (ans) ans.setAttribute('aria-hidden', 'false');
  }
}

/* Keyboard support for FAQ (Enter / Space)
 * FIX: renamed loop parameter from 'q' to 'faqBtn' to avoid shadowing
 *      the global q() utility function defined above.
 */
qa('.faq-q').forEach(faqBtn => {
  faqBtn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleFaq(faqBtn);
    }
  });
});

/* ── Star rating selector ─────────────────────────────────────────────────── */

const starSelect    = q('starSelect');
let   selectedRating = 0;

if (starSelect) {
  const stars = Array.from(starSelect.querySelectorAll('span[data-val]'));

  function highlightStars(upTo) {
    stars.forEach(s => {
      const val = parseInt(s.dataset.val, 10);
      s.classList.toggle('active', val <= upTo);
      s.setAttribute('aria-checked', String(val === upTo));
    });
  }

  stars.forEach(star => {
    const val = parseInt(star.dataset.val, 10);

    star.addEventListener('mouseenter', () => highlightStars(val));
    star.addEventListener('mouseleave', () => highlightStars(selectedRating));

    star.addEventListener('click', () => {
      selectedRating = val;
      highlightStars(selectedRating);
      /* Clear the inline rating error as soon as a star is picked */
      const ratingErrEl = q('ratingError');
      if (ratingErrEl) ratingErrEl.style.display = 'none';
    });

    star.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectedRating = val;
        highlightStars(selectedRating);
        const ratingErrEl = q('ratingError');
        if (ratingErrEl) ratingErrEl.style.display = 'none';
      }
    });
  });
}

/* ── Review submission (POST → Netlify Function) ─────────────────────────── */

async function submitReview() {
  const nameEl      = q('rName');
  const companyEl   = q('rCompany');
  const reviewEl    = q('rReview');
  const submitBtn   = q('rSubmit');
  const successEl   = q('rSuccess');
  const ratingErrEl = q('ratingError');
  const honeypotEl  = q('rHoneypot');

  if (!nameEl || !reviewEl || !submitBtn) return;

  /* FIX: Clear all previous validation states before re-validating.
   * Without this, a field marked invalid on attempt #1 stays marked
   * invalid even after the user corrects it and a different field fails.
   */
  nameEl.removeAttribute('aria-invalid');
  reviewEl.removeAttribute('aria-invalid');
  if (ratingErrEl) ratingErrEl.style.display = 'none';

  const name    = nameEl.value.trim();
  const company = companyEl ? companyEl.value.trim() : '';
  const review  = reviewEl.value.trim();
  /* Honeypot value — should always be empty for real users */
  const hp      = honeypotEl ? honeypotEl.value : '';

  /* Client-side validation */
  if (!name) {
    nameEl.focus();
    nameEl.setAttribute('aria-invalid', 'true');
    return;
  }
  if (!selectedRating) {
    /* FIX: Show inline error instead of alert() for consistent UX */
    if (ratingErrEl) {
      ratingErrEl.style.display = 'block';
      ratingErrEl.focus();
    } else if (starSelect) {
      starSelect.focus();
    }
    return;
  }
  if (review.length < 10) {
    reviewEl.focus();
    reviewEl.setAttribute('aria-invalid', 'true');
    return;
  }

  /* Disable button while in flight */
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const res = await fetch('/.netlify/functions/reviews', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        name,
        company,
        rating: selectedRating,
        review,
        _hp: hp, // Honeypot — server rejects silently if non-empty
      }),
    });

    const data = await res.json();

    if (res.ok) {
      /* Reset the form */
      nameEl.value  = '';
      nameEl.removeAttribute('aria-invalid');
      if (companyEl) companyEl.value = '';
      reviewEl.value = '';
      reviewEl.removeAttribute('aria-invalid');
      selectedRating = 0;

      if (starSelect) {
        starSelect.querySelectorAll('span[data-val]').forEach(s => {
          s.classList.remove('active');
          s.setAttribute('aria-checked', 'false');
        });
      }

      if (successEl) {
        successEl.style.display = 'block';
        successEl.focus();
      }
    } else {
      alert(data.error || 'Something went wrong. Please try again.');
    }

  } catch (err) {
    console.error('[submitReview] Network error:', err);
    alert('Network error. Please check your connection and try again.');
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Submit Review';
  }
}

/* ── Build a review card with safe DOM methods (XSS-safe) ────────────────── */

/**
 * Constructs a .testimonial-card element entirely with DOM APIs.
 * No innerHTML with user data — textContent is always XSS-safe.
 */
function buildReviewCard(review) {
  const rating   = Math.min(5, Math.max(1, review.rating || 5));
  const initials = (review.name || 'A')
    .split(' ')
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 2);

  /* Card wrapper */
  const card = document.createElement('div');
  card.className = 'testimonial-card';
  /* FIX: add role="listitem" to match the container's role="list".
   * reviews.html's buildCard() already does this; now consistent. */
  card.setAttribute('role', 'listitem');

  /* Stars */
  const stars = document.createElement('div');
  stars.className   = 'stars';
  stars.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  stars.setAttribute('aria-label', `${rating} out of 5 stars`);

  /* Review text */
  const body = document.createElement('p');
  body.textContent = review.review; // textContent = never parsed as HTML

  /* Author row */
  const author  = document.createElement('div');
  author.className = 'testimonial-author';

  const avatar  = document.createElement('div');
  avatar.className   = 'author-avatar';
  avatar.textContent = initials;
  avatar.setAttribute('aria-hidden', 'true');

  const info    = document.createElement('div');

  const nameEl  = document.createElement('div');
  nameEl.className   = 'author-name';
  nameEl.textContent = review.name || 'Anonymous';

  const compEl  = document.createElement('div');
  compEl.className   = 'author-company';
  compEl.textContent = review.company || '';

  info.appendChild(nameEl);
  info.appendChild(compEl);
  author.appendChild(avatar);
  author.appendChild(info);

  card.appendChild(stars);
  card.appendChild(body);
  card.appendChild(author);

  return card;
}

/* ── Load homepage review preview (GET → Netlify Function) ───────────────── */

async function loadReviewsPreview() {
  const container = q('reviews-preview');
  if (!container) return;

  try {
    const res = await fetch('/.netlify/functions/reviews');

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data    = await res.json();
    const reviews = data.reviews || [];

    /* Clear the "Loading reviews…" placeholder */
    container.innerHTML = '';

    if (reviews.length === 0) {
      const msg       = document.createElement('p');
      msg.className   = 'reviews-loading';
      msg.textContent = 'No reviews yet. Be the first to leave one!';
      container.appendChild(msg);
      return;
    }

    /* Show up to 3 on the homepage */
    reviews.slice(0, 3).forEach(review => {
      container.appendChild(buildReviewCard(review));
    });

  } catch (err) {
    console.error('[loadReviewsPreview] Error:', err);
    /* FIX: reuse the already-captured `container` reference instead of
     * re-querying the DOM with a confusingly named container2 variable. */
    container.innerHTML = '';
    const msg = document.createElement('p');
    msg.className   = 'reviews-loading';
    msg.textContent = 'Could not load reviews right now.';
    container.appendChild(msg);
  }
}

/* Only execute on pages that have the preview section */
if (q('reviews-preview')) {
  loadReviewsPreview();
}
