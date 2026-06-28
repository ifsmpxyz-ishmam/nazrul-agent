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
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
        ticking = false;
      });
      ticking = true;
    }
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
 * Also wired to keyboard events below.
 */


// FIX: closing brace was misplaced after `if (!item) return;`, cutting the
// function body short and leaving the rest of the logic as orphaned code.
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
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span>Submitting...';

  // FIX: The original fetch was split into disconnected statements.
  // Fixed by combining everything into one properly structured fetch call.
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch('/.netlify/functions/reviews', {
      signal:  controller.signal,
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

  const info   = document.createElement('div');
  const nameEl = document.createElement('div');
  nameEl.className   = 'author-name';
  nameEl.textContent = review.name || 'Anonymous';

  const compEl = document.createElement('div');
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

    /* FIX: 404 means the function isn't deployed yet (e.g. local dev).
     * Exit silently instead of showing an error message to visitors.
     */
    if (res.status === 404) {
      container.innerHTML = '';
      return;
    }

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
     * re-querying the DOM with a confusingly named container2 variable.
     */
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

/* ── Multi-file upload state ──────────────────────────────────────────────── */

let   selectedFiles = [];
const MAX_FILES     = 4;
const MAX_BYTES     = 10 * 1024 * 1024;

function fileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼';
  if (ext === 'pdf')                                        return '📄';
  if (['doc', 'docx'].includes(ext))                        return '📝';
  return '📎';
}

function syncInputFiles() {
  const input = q('cFile');
  if (!input) return;
  try {
    const dt = new DataTransfer();
    selectedFiles.forEach(f => dt.items.add(f));
    input.files = dt.files;
  } catch (e) {
    console.warn('[fileUpload] DataTransfer assignment not supported:', e.message);
  }
}

function handleFileSelect(input) {
  const incoming = Array.from(input.files);
  input.value = '';

  const skipped = [];

  for (const file of incoming) {
    if (selectedFiles.length >= MAX_FILES) {
      skipped.push(`"${file.name}" — max ${MAX_FILES} files reached.`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push(`"${file.name}" — exceeds 10 MB.`);
      continue;
    }
    const isDupe = selectedFiles.some(f => f.name === file.name && f.size === file.size);
    if (isDupe) continue;
    selectedFiles.push(file);
  }

  if (skipped.length) {
    alert('Some files were skipped:\n\n' + skipped.join('\n'));
  }

  syncInputFiles();
  renderFileChips();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  syncInputFiles();
  renderFileChips();
}

function clearFile() {
  selectedFiles = [];
  syncInputFiles();
  renderFileChips();
}

function renderFileChips() {
  const label      = q('fileLabel');
  const countBadge = q('fileCount');
  const btnWrap    = qs('.file-upload-btn');
  const clearBtn   = q('fileClearBtn');
  const listEl     = q('fileList');

  if (selectedFiles.length === 0) {
    if (label)      label.textContent = 'Choose Files';
    if (countBadge) countBadge.style.display = 'none';
    if (btnWrap)    btnWrap.classList.remove('has-file');
    if (clearBtn)   clearBtn.style.display = 'none';
    if (listEl)     listEl.innerHTML = '';
    return;
  }

  if (label) label.textContent = selectedFiles.length < MAX_FILES ? 'Add More' : 'Max files reached';
  if (countBadge) {
    countBadge.textContent   = `${selectedFiles.length}/${MAX_FILES}`;
    countBadge.style.display = 'inline-flex';
  }
  if (btnWrap)  btnWrap.classList.add('has-file');
  if (clearBtn) clearBtn.style.display = 'flex';
  if (!listEl)  return;

  listEl.innerHTML = '';

  selectedFiles.forEach((file, i) => {
    const sizeMB   = (file.size / (1024 * 1024)).toFixed(1);
    const safeName = file.name.length > 30 ? file.name.slice(0, 27) + '…' : file.name;

    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.setAttribute('role', 'listitem');

    const icon = document.createElement('span');
    icon.className   = 'file-chip-icon';
    icon.textContent = fileIcon(file.name);
    icon.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className   = 'file-chip-name';
    name.textContent = safeName;
    name.title       = file.name;

    const size = document.createElement('span');
    size.className   = 'file-chip-size';
    size.textContent = `${sizeMB} MB`;

    const removeBtn = document.createElement('button');
    removeBtn.type      = 'button';
    removeBtn.className = 'file-chip-remove';
    removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', (function(idx) {
      return function() { removeFile(idx); };
    })(i));

    chip.appendChild(icon);
    chip.appendChild(name);
    chip.appendChild(size);
    chip.appendChild(removeBtn);
    listEl.appendChild(chip);
  });
}

/* ── Contact Form ─────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const RULES = {
    cName: {
      test: v => v.trim().length >= 2,
      msg:  'Please enter your full name (at least 2 characters).',
    },
    cPhone: {
      test: v => /^[0-9]{11}$/.test(v.trim()),
      msg:  'Please enter a valid 11-digit phone number.',
    },
    cEmail: {
      test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      msg:  'Please enter a valid email address.',
    },
    cService: {
      test: v => v.trim() !== '',
      msg:  'Please select the service you need.',
    },
    cMessage: {
      test: v => v.trim().length >= 10,
      msg:  'Please describe your request (at least 10 characters).',
    },
  };

  function getField(id)   { return document.getElementById(id); }
  function getErrorEl(id) { return document.getElementById(id + '-err'); }

  function showError(id, msg) {
    const field = getField(id);
    if (!field) return;
    field.classList.add('cf-invalid');
    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', id + '-err');
    let err = getErrorEl(id);
    if (!err) {
      err = document.createElement('span');
      err.id        = id + '-err';
      err.className = 'cf-error-msg';
      err.setAttribute('role', 'alert');
      field.parentNode.appendChild(err);
    }
    err.textContent = msg;
  }

  function clearError(id) {
    const field = getField(id);
    if (!field) return;
    field.classList.remove('cf-invalid');
    field.removeAttribute('aria-invalid');
    field.removeAttribute('aria-describedby');
    const err = getErrorEl(id);
    if (err) err.textContent = '';
  }

  function validateOne(id) {
    const field = getField(id);
    if (!field) return true;
    const rule = RULES[id];
    if (!rule)  return true;
    if (rule.test(field.value)) {
      clearError(id);
      return true;
    } else {
      showError(id, rule.msg);
      return false;
    }
  }

  function attachListeners() {
    Object.keys(RULES).forEach(id => {
      const field = getField(id);
      if (!field) return;
      field.addEventListener('blur',   () => validateOne(id));
      field.addEventListener('input',  () => { if (field.classList.contains('cf-invalid')) validateOne(id); });
      field.addEventListener('change', () => { if (field.classList.contains('cf-invalid')) validateOne(id); });
    });
  }

  function attachSubmit() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      /* ── 1. Validate ── */
      let allValid          = true;
      let firstInvalidField = null;

      Object.keys(RULES).forEach(id => {
        const ok = validateOne(id);
        if (!ok) {
          allValid = false;
          if (!firstInvalidField) firstInvalidField = getField(id);
        }
      });

      if (!allValid) {
        e.stopPropagation();
        if (firstInvalidField) {
          firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
          firstInvalidField.focus();
        }
        return;
      }

      /* ── 2. Show sending state ── */
      const submitBtn = form.querySelector('.form-submit');
      if (submitBtn) {
        submitBtn.disabled    = true;
        submitBtn.textContent = 'Sending…';
      }

      /* ── 3. Fire to web3forms, then redirect ── */
      const formData = new FormData(form);

      fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body:   formData,
      })
        .catch(err => console.error('[contactForm] web3forms error:', err))
        .finally(() => {
          form.reset();
          clearFile();
          window.location.href = 'success.html';
        });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    attachListeners();
    attachSubmit();
  }

})();
