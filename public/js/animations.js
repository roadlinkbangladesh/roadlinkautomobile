/**
 * Roadlink Automobiles - Modern Website Animations Controller
 * Lightweight, zero-dependency, GPU-accelerated scroll reveal & interaction engine.
 * Adheres to W3C Accessibility, Core Web Vitals (CLS = 0), and graceful degradation.
 */

// Global state
let scrollObserver = null;
let mutationObserver = null;
const isReducedMotion = typeof window !== 'undefined' && 
  window.matchMedia && 
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Initializes the intersection observer for scroll-based reveals.
 */
function getObserver() {
  if (scrollObserver) return scrollObserver;

  if (typeof IntersectionObserver === 'undefined' || isReducedMotion) {
    return null;
  }

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -30px 0px',
    threshold: 0.08
  };

  scrollObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add('is-revealed');
        // Unobserve to trigger only once (Requirement 2)
        obs.unobserve(el);
      }
    });
  }, observerOptions);

  return scrollObserver;
}

/**
 * Applies staggered delays to direct children of a container.
 * @param {HTMLElement} container 
 * @param {number} staggerMs 
 * @param {number} maxStaggerMs 
 */
export function staggerChildren(container, staggerMs = 70, maxStaggerMs = 450) {
  if (!container || !container.children) return;

  const children = Array.from(container.children);
  children.forEach((child, index) => {
    // Only stagger elements that have a reveal class or are in a stagger group
    if (
      container.classList.contains('reveal-stagger-group') ||
      child.classList.contains('reveal') ||
      child.classList.contains('reveal-slide-up') ||
      child.classList.contains('reveal-scale')
    ) {
      const delay = Math.min(index * staggerMs, maxStaggerMs);
      child.style.setProperty('--reveal-delay', `${delay}ms`);
    }
  });
}

/**
 * Observes a list or collection of elements for scroll reveal.
 * @param {NodeList|Array|HTMLElement} elements 
 */
export function observeElements(elements) {
  if (isReducedMotion) {
    // If reduced motion is preferred, mark revealed immediately
    if (elements instanceof HTMLElement) {
      elements.classList.add('is-revealed');
    } else if (elements && elements.forEach) {
      elements.forEach(el => el && el.classList && el.classList.add('is-revealed'));
    }
    return;
  }

  const observer = getObserver();
  if (!observer) return;

  const targets = elements instanceof HTMLElement 
    ? [elements] 
    : Array.from(elements || []);

  targets.forEach(el => {
    if (!el || !(el instanceof HTMLElement)) return;
    if (el.classList.contains('is-revealed')) return;

    // Check if element is already within the visible viewport on load
    const rect = el.getBoundingClientRect();
    const isVisibleNow = (
      rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
      rect.bottom > 0
    );

    if (isVisibleNow) {
      // Immediate reveal for above-the-fold content to prevent initial blank flash
      requestAnimationFrame(() => {
        el.classList.add('is-revealed');
      });
    } else {
      observer.observe(el);
    }
  });
}

/**
 * Scans a DOM subtree and binds animation observer to all reveal elements.
 * @param {HTMLElement|Document} root 
 */
export function initScrollAnimations(root = document) {
  if (typeof document === 'undefined') return;

  // Mark document as JS-ready to activate CSS transitions
  document.documentElement.classList.add('js-ready');

  if (isReducedMotion) {
    // Reveal all elements immediately
    const all = root.querySelectorAll(
      '.reveal, .reveal-fade, .reveal-slide-up, .reveal-slide-left, .reveal-slide-right, .reveal-scale, .reveal-stagger-group > *'
    );
    all.forEach(el => el.classList.add('is-revealed'));
    return;
  }

  // 1. Process Stagger Groups
  const staggerGroups = root.querySelectorAll('.reveal-stagger-group');
  staggerGroups.forEach(group => {
    staggerChildren(group);
    observeElements(group.children);
  });

  // 2. Process Individual Reveal Elements
  const revealElements = root.querySelectorAll(
    '.reveal, .reveal-fade, .reveal-slide-up, .reveal-slide-left, .reveal-slide-right, .reveal-scale'
  );
  observeElements(revealElements);

  // 3. Automated Hero Entrance Sequence
  initHeroSequence(root);

  // 4. Setup Dynamic Content Watcher
  initMutationWatcher(root);
}

/**
 * Runs a smooth staggered sequence for hero section components.
 * @param {HTMLElement|Document} root 
 */
function initHeroSequence(root) {
  const heroContent = root.getElementById ? root.getElementById('hero-content-box') : null;
  if (!heroContent) return;

  const heroElements = [
    heroContent.querySelector('.hero-badge'),
    heroContent.querySelector('.hero-title'),
    heroContent.querySelector('.hero-desc'),
    heroContent.querySelector('.hero-ctas'),
    ...Array.from(heroContent.querySelectorAll('.hero-stats .stat-item'))
  ].filter(Boolean);

  heroElements.forEach((el, i) => {
    el.classList.add('reveal-slide-up');
    el.style.setProperty('--reveal-delay', `${60 + i * 70}ms`);
    requestAnimationFrame(() => {
      el.classList.add('is-revealed');
    });
  });
}

/**
 * Watches key dynamic containers (vehicle grids, testimonials, etc.) and
 * automatically attaches staggered entrance animations when content changes.
 * @param {HTMLElement|Document} root 
 */
function initMutationWatcher(root) {
  if (mutationObserver || typeof MutationObserver === 'undefined') return;

  const watchedSelectors = [
    '#vehicles-grid',
    '#testimonials-grid',
    '#stock-vehicles-grid',
    '.vehicles-grid',
    '#dyn-contact-list'
  ];

  const containers = watchedSelectors
    .map(sel => root.querySelector ? root.querySelector(sel) : null)
    .filter(Boolean);

  if (containers.length === 0) return;

  mutationObserver = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        const target = mutation.target;
        if (target instanceof HTMLElement) {
          const newChildren = Array.from(mutation.addedNodes).filter(
            node => node instanceof HTMLElement && !node.classList.contains('is-revealed')
          );

          if (newChildren.length > 0) {
            newChildren.forEach((child, index) => {
              if (
                !child.classList.contains('reveal') &&
                !child.classList.contains('reveal-slide-up') &&
                !child.classList.contains('reveal-scale')
              ) {
                child.classList.add('reveal-slide-up');
              }
              const delay = Math.min(index * 60, 360);
              child.style.setProperty('--reveal-delay', `${delay}ms`);
            });

            observeElements(newChildren);
          }
        }
      }
    });
  });

  containers.forEach(c => {
    mutationObserver.observe(c, { childList: true, subtree: false });
  });
}

// Auto-initialize on module evaluation
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initScrollAnimations(document));
  } else {
    // Run immediately if DOM already parsed
    initScrollAnimations(document);
  }
}
