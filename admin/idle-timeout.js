import { isAuthenticated, clearToken } from "./auth.js";
import { showLoginView } from "./ui.js";
import { $ } from "./utils.js";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_LIMIT_MS = 28 * 60 * 1000; // 28 minutes

let lastActivityTime = Date.now();
let intervalId = null;
let warningModalActive = false;
let countdownIntervalId = null;

/**
 * Resets the last activity timestamp.
 */
export function resetActivity() {
  lastActivityTime = Date.now();
  if (warningModalActive) {
    hideWarningModal();
  }
}

/**
 * Checks if Remember Me is enabled for the current session.
 * Idle timeout applies ONLY to users logged in without Remember Me.
 */
function isRememberMeActive() {
  return localStorage.getItem("token") !== null || localStorage.getItem("rememberMe") === "true";
}

/**
 * Shows the warning modal and updates the countdown.
 */
function showWarningModal() {
  const modal = $("idle-timeout-modal");
  if (modal) {
    modal.style.display = "flex";
  }
  warningModalActive = true;
  updateCountdown();

  // Start a fast countdown interval to show accurate ticking seconds
  if (!countdownIntervalId) {
    countdownIntervalId = setInterval(updateCountdown, 1000);
  }
}

/**
 * Hides the warning modal and clears the countdown interval.
 */
function hideWarningModal() {
  const modal = $("idle-timeout-modal");
  if (modal) {
    modal.style.display = "none";
  }
  warningModalActive = false;
  if (countdownIntervalId) {
    clearInterval(countdownIntervalId);
    countdownIntervalId = null;
  }
}

/**
 * Updates the remaining seconds label in the warning modal.
 */
function updateCountdown() {
  const label = $("idle-countdown-seconds");
  if (!label) return;

  const elapsed = Date.now() - lastActivityTime;
  const remainingMs = IDLE_LIMIT_MS - elapsed;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));

  label.textContent = remainingSec;

  if (remainingSec <= 0) {
    handleTimeout();
  }
}

/**
 * Handles session logout on timeout.
 */
function handleTimeout() {
  hideWarningModal();
  clearToken();
  showLoginView();
  alert("Your session has expired due to inactivity. Please log in again.");
}

/**
 * Periodic check loop running every second.
 */
function checkIdleTime() {
  if (!isAuthenticated()) {
    // If not authenticated, reset last activity to now so we don't trigger anything when logging back in
    lastActivityTime = Date.now();
    if (warningModalActive) {
      hideWarningModal();
    }
    return;
  }

  // If user used "Remember Me", idle timeout is completely disabled
  if (isRememberMeActive()) {
    if (warningModalActive) {
      hideWarningModal();
    }
    return;
  }

  const elapsed = Date.now() - lastActivityTime;

  if (elapsed >= IDLE_LIMIT_MS) {
    handleTimeout();
  } else if (elapsed >= WARNING_LIMIT_MS) {
    if (!warningModalActive) {
      showWarningModal();
    }
  } else {
    if (warningModalActive) {
      hideWarningModal();
    }
  }
}

/**
 * Starts the idle timeout tracker.
 */
export function initIdleTimeout() {
  // Reset activity initially
  resetActivity();

  // Activity listeners
  const activityEvents = ["mousemove", "keydown", "mousedown", "click", "scroll", "touchstart"];
  activityEvents.forEach(evt => {
    window.addEventListener(evt, resetActivity, { passive: true });
  });

  // Modal stay button
  const btnStay = $("btn-idle-stay");
  if (btnStay) {
    btnStay.addEventListener("click", () => {
      resetActivity();
    });
  }

  // Modal logout button
  const btnLogout = $("btn-idle-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      handleTimeout();
    });
  }

  // Start checking loop
  if (!intervalId) {
    intervalId = setInterval(checkIdleTime, 1000);
  }
}
