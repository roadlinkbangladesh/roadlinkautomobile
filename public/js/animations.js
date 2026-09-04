/**
 * Roadlink Automobiles - Modern Website Animations Controller
 * High-impact, GPU-accelerated scroll reveal & interaction engine.
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
    rootMargin: '0px 0px -45px 0px',
    threshold: 0.10
  };

  scrollObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add('is-revealed');
        // Unobserve to trigger entrance only once
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
export function staggerChildren(container, staggerMs = 85, maxStaggerMs = 500) {
  if (!container || !container.children) return;

  const children = Array.from(container.children);
  children.forEach((child, index) => {
    if (
      container.classList.contains('reveal-stagger-group') ||
      child.classList.contains('reveal') ||
      child.classList.contains('reveal-slide-up') ||
      child.classList.contains('reveal-scale') ||
      child.classList.contains('reveal-pop')
    ) {
      const delay = Math.min(index * staggerMs, maxStaggerMs);
      child.style.setProperty('--reveal-delay', `${delay}ms`);
    }
  });
}

/**
 * Observes a list or collection of elements for scroll reveal.
 * Distinguishes between above-the-fold and below-the-fold elements so above-the-fold
 * content visibly cascades in smoothly rather than appearing abruptly.
 * @param {NodeList|Array|HTMLElement} elements 
 */
export function observeElements(elements) {
  if (!elements) return;

  if (isReducedMotion) {
    if (elements instanceof HTMLElement) {
      elements.classList.add('is-revealed');
    } else if (elements && elements.forEach) {
      elements.forEach(el => el && el.classList && el.classList.add('is-revealed'));
    }
    return;
  }

  const observer = getObserver();
  const targets = elements instanceof HTMLElement 
    ? [elements] 
    : Array.from(elements || []);

  const visibleNow = [];
  const belowFold = [];
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  targets.forEach(el => {
    if (!el || !(el instanceof HTMLElement)) return;
    if (el.classList.contains('is-revealed')) return;

    const rect = el.getBoundingClientRect();
    const isVisible = rect.top < (viewportHeight - 30) && rect.bottom > 20;

    if (isVisible) {
      visibleNow.push(el);
    } else {
      belowFold.push(el);
    }
  });

  // Above-the-fold elements get a staged reveal so the user actually observes the motion
  visibleNow.forEach((el, index) => {
    setTimeout(() => {
      el.classList.add('is-revealed');
    }, 70 + index * 85);
  });

  // Below-the-fold elements are queued into the intersection observer
  if (observer) {
    belowFold.forEach(el => observer.observe(el));
  } else {
    belowFold.forEach(el => el.classList.add('is-revealed'));
  }
}

/**
 * Runs a dynamic staggered sequence for hero section components.
 * @param {HTMLElement|Document} root 
 */
export function initHeroSequence(root = document) {
  const heroContent = root.getElementById ? root.getElementById('hero-content-box') : document.getElementById('hero-content-box');
  if (!heroContent) return;

  // Ensure content box is visible
  heroContent.style.opacity = '1';

  const heroElements = [
    heroContent.querySelector('.hero-badge'),
    heroContent.querySelector('.hero-title'),
    heroContent.querySelector('.hero-desc'),
    heroContent.querySelector('.hero-ctas'),
    ...Array.from(heroContent.querySelectorAll('.hero-stats .stat-item'))
  ].filter(Boolean);

  heroElements.forEach((el, i) => {
    el.classList.add('reveal-slide-up');
    el.style.setProperty('--reveal-delay', `${100 + i * 90}ms`);
    // Trigger with slight timeout so the animation visibly runs
    setTimeout(() => {
      el.classList.add('is-revealed');
    }, 50);
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
    '#dyn-contact-list',
    '#related-vehicles-grid'
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
                !child.classList.contains('reveal-scale') &&
                !child.classList.contains('reveal-pop')
              ) {
                child.classList.add('reveal-slide-up');
              }
              const delay = Math.min(index * 85, 450);
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

/**
 * Scans a DOM subtree and binds animation observer to all reveal elements.
 * @param {HTMLElement|Document} root 
 */
export function initScrollAnimations(root = document) {
  if (typeof document === 'undefined') return;

  // Mark document as JS-ready to activate CSS transitions
  document.documentElement.classList.add('js-ready');

  if (isReducedMotion) {
    const all = root.querySelectorAll(
      '.reveal, .reveal-fade, .reveal-slide-up, .reveal-slide-left, .reveal-slide-right, .reveal-scale, .reveal-pop, .reveal-stagger-group > *'
    );
    all.forEach(el => el.classList.add('is-revealed'));
    return;
  }

  // 1. Process Stagger Groups
  const staggerGroups = root.querySelectorAll('.reveal-stagger-group');
  staggerGroups.forEach(group => {
    staggerChildren(group, 85);
    observeElements(group.children);
  });

  // 2. Process Individual Reveal Elements
  const revealElements = root.querySelectorAll(
    '.reveal, .reveal-fade, .reveal-slide-up, .reveal-slide-left, .reveal-slide-right, .reveal-scale, .reveal-pop'
  );
  observeElements(revealElements);

  // 3. Automated Hero Entrance Sequence
  initHeroSequence(root);

  // 4. Setup Dynamic Content Watcher
  initMutationWatcher(root);
}

// Expose globally for dynamic page controllers
if (typeof window !== 'undefined') {
  window.initScrollAnimations = initScrollAnimations;
  window.triggerHeroSequence = () => initHeroSequence(document);
  window.observeAnimatedElements = observeElements;
}

// Auto-initialize on module evaluation
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initScrollAnimations(document));
  } else {
    initScrollAnimations(document);
  }
}
