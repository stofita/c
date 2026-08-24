/**
 * AuthPortal - Real-time Password Strength Meter
 */
(function() {
  const regPasswordInput = document.getElementById('regPassword');
  const strengthBar = document.getElementById('strengthBar');
  const strengthText = document.getElementById('strengthText');

  const reqLength = document.getElementById('reqLength');
  const reqUpper = document.getElementById('reqUpper');
  const reqNumber = document.getElementById('reqNumber');
  const reqSpecial = document.getElementById('reqSpecial');

  if (!regPasswordInput || !strengthBar || !strengthText) return;

  regPasswordInput.addEventListener('input', function() {
    const val = this.value;
    evaluateStrength(val);
  });

  function evaluateStrength(password) {
    if (!password) {
      strengthBar.style.width = '0%';
      strengthBar.style.backgroundColor = 'transparent';
      strengthText.textContent = 'Très faible';
      strengthText.style.color = 'var(--text-muted)';
      resetTags();
      return;
    }

    const hasLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    updateTag(reqLength, hasLength);
    updateTag(reqUpper, hasUpper);
    updateTag(reqNumber, hasNumber);
    updateTag(reqSpecial, hasSpecial);

    let score = 0;
    if (hasLength) score += 25;
    if (hasUpper) score += 25;
    if (hasNumber) score += 25;
    if (hasSpecial) score += 25;

    // Extra length bonus
    if (password.length >= 12 && score === 100) score = 100;

    strengthBar.style.width = score + '%';

    if (score <= 25) {
      strengthBar.style.backgroundColor = '#ef4444';
      strengthText.textContent = 'Faible';
      strengthText.style.color = '#ef4444';
    } else if (score <= 50) {
      strengthBar.style.backgroundColor = '#f59e0b';
      strengthText.textContent = 'Moyen';
      strengthText.style.color = '#f59e0b';
    } else if (score <= 75) {
      strengthBar.style.backgroundColor = '#3b82f6';
      strengthText.textContent = 'Bon';
      strengthText.style.color = '#3b82f6';
    } else {
      strengthBar.style.backgroundColor = '#10b981';
      strengthText.textContent = 'Ultra-Sécurisé 🛡️';
      strengthText.style.color = '#10b981';
    }
  }

  function updateTag(element, isPassed) {
    if (!element) return;
    if (isPassed) {
      element.classList.add('passed');
    } else {
      element.classList.remove('passed');
    }
  }

  function resetTags() {
    [reqLength, reqUpper, reqNumber, reqSpecial].forEach(el => {
      if (el) el.classList.remove('passed');
    });
  }
})();
