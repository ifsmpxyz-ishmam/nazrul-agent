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
        // Netlify নিজেই handle করবে
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

});