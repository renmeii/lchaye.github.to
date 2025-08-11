// Utilities
const root = document.documentElement;
const $ = (sel, parent = document) => parent.querySelector(sel);
const $$ = (sel, parent = document) => Array.from(parent.querySelectorAll(sel));

// Theme toggle with persistence
const THEME_KEY = 'ws_theme';
function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyTheme(theme) {
  root.setAttribute('data-theme', theme);
}
function toggleTheme() {
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

// Mobile navigation
function setupMobileNav() {
  const toggleBtn = document.querySelector('[data-nav-toggle]');
  const mobileNav = document.getElementById('mobile-nav');
  if (!toggleBtn || !mobileNav) return;

  function closeMobile() {
    mobileNav.hidden = true;
    toggleBtn.setAttribute('aria-expanded', 'false');
  }
  function openMobile() {
    mobileNav.hidden = false;
    toggleBtn.setAttribute('aria-expanded', 'true');
  }

  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    expanded ? closeMobile() : openMobile();
  });

  // Close on link click
  $$('[data-close-mobile]', mobileNav).forEach((link) => link.addEventListener('click', closeMobile));

  // Close on escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobile();
  });
}

// Smooth scroll focus management
function setupSmoothAnchors() {
  $$('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', href);
      // focus for a11y
      if (target.tabIndex === -1) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    });
  });
}

// Intersection Observer reveal animations
function setupReveal() {
  const elements = $$('.reveal');
  if (!('IntersectionObserver' in window) || elements.length === 0) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  elements.forEach((el) => observer.observe(el));
}

// Back to top button
function setupToTop() {
  const btn = document.querySelector('[data-to-top]');
  if (!btn) return;
  const onScroll = () => {
    btn.hidden = window.scrollY < 300;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

// Contact form validation + fake submit
function setupContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const status = $('.form-status', form);

  function setError(name, message) {
    const el = $(`[data-error-for="${name}"]`, form);
    if (el) el.textContent = message || '';
  }

  function validate() {
    let valid = true;
    const name = $('#name', form);
    const email = $('#email', form);
    const message = $('#message', form);

    setError('name', ''); setError('email', ''); setError('message', '');

    if (!name.value.trim()) { setError('name', 'Please enter your name.'); valid = false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { setError('email', 'Enter a valid email.'); valid = false; }
    if (!message.value.trim()) { setError('message', 'Please include a message.'); valid = false; }
    return valid;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    if (!validate()) return;

    // Fake async submit
    status.textContent = 'Sending…';
    await new Promise((r) => setTimeout(r, 900));
    status.textContent = 'Thanks! We will get back to you shortly.';
    form.reset();
  });
}

// Footer year
function setYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  applyTheme(getPreferredTheme());
  const themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  setupMobileNav();
  setupSmoothAnchors();
  setupReveal();
  setupToTop();
  setupContactForm();
  setYear();
});

