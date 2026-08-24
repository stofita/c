/**
 * AuthPortal - Core Application Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  
  // --------------------------------------------------------------------------
  // 1. THEME TOGGLE CONTROLLER
  // --------------------------------------------------------------------------
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const htmlEl = document.documentElement;

  const savedTheme = localStorage.getItem('aetheria_theme') || 'dark';
  htmlEl.setAttribute('data-theme', savedTheme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = htmlEl.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      htmlEl.setAttribute('data-theme', newTheme);
      localStorage.setItem('aetheria_theme', newTheme);
      
      showToast(`Mode ${newTheme === 'dark' ? 'Sombre' : 'Clair'} activé`, 'info', 'Thème');
    });
  }

  // --------------------------------------------------------------------------
  // 2. TAB CONTROLLER & VIEW SWITCHER
  // --------------------------------------------------------------------------
  const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
  const tabIndicator = document.getElementById('tabIndicator');
  const views = {
    login: document.getElementById('viewLogin'),
    register: document.getElementById('viewRegister'),
    verify: document.getElementById('viewVerify'),
    forgot: document.getElementById('viewForgot'),
    dashboard: document.getElementById('viewDashboard'),
    admin: document.getElementById('viewAdmin')
  };

  // État de session courant (en mémoire seulement, pas de stockage persistant)
  let session = { token: null, role: null };
  let adminUsersCache = [];
  let adminAppsCache = [];
  let adminAccessCache = [];

  function apiBase() {
    const el = document.getElementById('apiBase');
    return (el ? el.value : 'http://localhost:5116').replace(/\/$/, '');
  }

  // Appel authentifié (GET ou POST) vers une route admin protégée par JWT
  async function callApiAuth(path, method, body) {
    try {
      const opts = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.token
        }
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(apiBase() + path, opts);
      let data = {};
      try { data = await res.json(); } catch (_) {}
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { message: "Impossible de contacter AuthService." } };
    }
  }

  // Appel générique vers AuthService ; renvoie { ok, status, data }
  async function callApi(path, body) {
    try {
      const res = await fetch(apiBase() + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      let data = {};
      try { data = await res.json(); } catch (_) {}
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, status: 0, data: { message: "Impossible de contacter AuthService. Vérifiez qu'il tourne (dotnet run) et que CORS est activé." } };
    }
  }
  const authCard = document.getElementById('authCard');
  const authTabsNav = document.getElementById('authTabsNav');

  function updateTabPosition(activeTabBtn) {
    if (!activeTabBtn || !tabIndicator) return;
    const index = tabBtns.indexOf(activeTabBtn);
    if (index !== -1) {
      tabIndicator.style.transform = `translateX(${index * 100}%)`;
    }
  }

  function switchView(viewName) {
    // Hide all views
    Object.values(views).forEach(view => {
      if (view) {
        view.classList.remove('active');
        view.style.display = 'none';
      }
    });

    // Show target view
    const targetView = views[viewName];
    if (targetView) {
      targetView.style.display = 'block';
      setTimeout(() => targetView.classList.add('active'), 20);
    }

    // Hide top tabs if viewing Forgot Password, Dashboard, or Admin
    if (viewName === 'forgot' || viewName === 'dashboard' || viewName === 'admin' || viewName === 'verify') {
      if (authTabsNav) authTabsNav.style.display = 'none';
    } else {
      if (authTabsNav) authTabsNav.style.display = 'flex';
      const activeTabBtn = tabBtns.find(btn => btn.getAttribute('data-tab') === viewName);
      if (activeTabBtn) {
        tabBtns.forEach(btn => btn.classList.remove('active'));
        activeTabBtn.classList.add('active');
        updateTabPosition(activeTabBtn);
      }
    }

  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      switchView(tabTarget);
    });
  });

  // Buttons with data-target view switching
  document.querySelectorAll('.switch-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = btn.getAttribute('data-target');
      switchView(target);
    });
  });

  // Initialize indicator position
  const initialActiveTab = document.querySelector('.tab-btn.active');
  if (initialActiveTab) updateTabPosition(initialActiveTab);

  // --------------------------------------------------------------------------
  // 3. TOGGLE PASSWORD VISIBILITY
  // --------------------------------------------------------------------------
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('.input-wrapper');
      const input = wrapper.querySelector('input');
      const eyeShow = btn.querySelector('.eye-show');
      const eyeHide = btn.querySelector('.eye-hide');

      if (input.type === 'password') {
        input.type = 'text';
        if (eyeShow) eyeShow.style.display = 'none';
        if (eyeHide) eyeHide.style.display = 'block';
      } else {
        input.type = 'password';
        if (eyeShow) eyeShow.style.display = 'block';
        if (eyeHide) eyeHide.style.display = 'none';
      }
    });
  });

  // --------------------------------------------------------------------------
  // 4. FORM SUBMISSION HANDLERS
  // --------------------------------------------------------------------------
  
  // Charge la liste des applications disponibles (endpoint public, pas d'auth requise)
  async function loadPublicApplications() {
    const select = document.getElementById('loginAppName');
    if (!select) return;
    try {
      const res = await fetch(apiBase() + '/api/auth/applications');
      const apps = await res.json();
      select.innerHTML = Array.isArray(apps) && apps.length
        ? apps.map(name => `<option value="${name}">${name}</option>`).join('')
        : '<option value="">Aucune application disponible</option>';
    } catch (err) {
      select.innerHTML = '<option value="">AuthService injoignable</option>';
    }
  }
  loadPublicApplications();
  const apiBaseInput = document.getElementById('apiBase');
  if (apiBaseInput) {
    apiBaseInput.addEventListener('change', loadPublicApplications);
  }

  // LOGIN FORM
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('loginEmail');
      const passInput = document.getElementById('loginPassword');
      const appInput = document.getElementById('loginAppName');
      const submitBtn = document.getElementById('loginSubmitBtn');

      let isValid = true;
      if (!validateEmail(emailInput.value)) {
        showFieldError(emailInput, true);
        isValid = false;
      } else { showFieldError(emailInput, false); }

      if (!passInput.value.trim()) {
        showFieldError(passInput, true);
        isValid = false;
      } else { showFieldError(passInput, false); }

      if (!appInput.value.trim()) {
        showFieldError(appInput, true);
        isValid = false;
      } else { showFieldError(appInput, false); }

      if (!isValid) {
        triggerShake();
        return;
      }

      setLoading(submitBtn, true);
      const { ok, status, data } = await callApi('/api/auth/login', {
        email: emailInput.value,
        password: passInput.value,
        appName: appInput.value
      });
      setLoading(submitBtn, false);

      if (!ok) {
        // Messages distincts selon le code renvoyé par AuthService
        const msg = data.message || 'Erreur inconnue.';
        showToast(msg, 'error', status === 404 ? 'Application introuvable' : status === 403 ? 'Accès refusé' : 'Échec de connexion');
        triggerShake();
        return;
      }

      showToast(`Connecté en tant que ${emailInput.value}`, 'success', 'Authentification');

      session.token = data.token;
      session.role = data.role;

      const userName = emailInput.value.split('@')[0];
      document.getElementById('dashUserName').textContent = userName.charAt(0).toUpperCase() + userName.slice(1);
      document.getElementById('dashUserEmail').innerHTML = `${emailInput.value} • <span class="badge-role">${data.role || 'User'}</span>${data.isSuperAdmin ? ' <span class="badge-super">★ Super-admin</span>' : ''}`;
      document.getElementById('userInitial').textContent = userName.charAt(0).toUpperCase();
      document.getElementById('dashAppName').textContent = appInput.value;
      document.getElementById('dashRoleEcho').textContent = data.role || 'User';
      document.getElementById('dashAppNameEcho').textContent = appInput.value;
      document.getElementById('dashToken').textContent = data.token || '(non fourni)';

      const openAdminBtn = document.getElementById('openAdminBtn');
      if (openAdminBtn) openAdminBtn.style.display = data.isSuperAdmin ? 'flex' : 'none';

      switchView('dashboard');
    });
  }

  // REGISTER FORM
  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('regEmail');
      const passInput = document.getElementById('regPassword');
      const submitBtn = document.getElementById('registerSubmitBtn');

      let isValid = true;
      if (!validateEmail(emailInput.value)) {
        showFieldError(emailInput, true);
        isValid = false;
      } else { showFieldError(emailInput, false); }

      if (passInput.value.length < 8) {
        showFieldError(passInput, true);
        isValid = false;
      } else { showFieldError(passInput, false); }

      if (!isValid) {
        triggerShake();
        return;
      }

      setLoading(submitBtn, true);
      const { ok, data } = await callApi('/api/auth/register', {
        email: emailInput.value,
        password: passInput.value
      });
      setLoading(submitBtn, false);

      if (!ok) {
        showToast(data.message || 'Erreur inconnue.', 'error', 'Inscription refusée');
        triggerShake();
        return;
      }

      showToast('Compte créé. Vérifiez votre email pour activer votre compte.', 'success', 'Bienvenue');
      document.getElementById('verifyEmailDisplay').textContent = emailInput.value;
      document.getElementById('verifyCode').value = '';
      registerForm.reset();
      switchView('verify');
    });
  }

  // EMAIL VERIFICATION FORM
  const verifyForm = document.getElementById('verifyForm');
  if (verifyForm) {
    verifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const codeInput = document.getElementById('verifyCode');
      const emailDisplay = document.getElementById('verifyEmailDisplay').textContent;
      const submitBtn = document.getElementById('verifySubmitBtn');

      if (!/^[A-Za-z0-9]{6}$/.test(codeInput.value)) {
        showFieldError(codeInput, true);
        triggerShake();
        return;
      }
      showFieldError(codeInput, false);

      setLoading(submitBtn, true);
      const { ok, data } = await callApi('/api/auth/verify-email', {
        email: emailDisplay,
        code: codeInput.value.toUpperCase()
      });
      setLoading(submitBtn, false);

      if (!ok) {
        showToast(data.message || 'Code invalide.', 'error', 'Vérification refusée');
        triggerShake();
        return;
      }

      showToast('Email vérifié. Vous pouvez vous connecter.', 'success', 'Succès');
      switchView('login');
    });
  }

  // FORGOT PASSWORD FORM — étape 1 : demander le token
  const forgotForm = document.getElementById('forgotForm');
  if (forgotForm) {
    forgotForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('forgotEmail');
      const submitBtn = document.getElementById('forgotSubmitBtn');
      const successBox = document.getElementById('forgotSuccessBox');
      const resetForm = document.getElementById('resetForm');

      if (!validateEmail(emailInput.value)) {
        showFieldError(emailInput, true);
        triggerShake();
        return;
      }

      showFieldError(emailInput, false);
      setLoading(submitBtn, true);
      const { ok, data } = await callApi('/api/auth/forgot-password', { email: emailInput.value });
      setLoading(submitBtn, false);

      if (!ok) {
        showToast(data.message || 'Erreur inconnue.', 'error', 'Erreur');
        return;
      }

      if (successBox) successBox.style.display = 'flex';
      showToast(data.message || 'Demande traitée.', 'success', 'Récupération');

      // Le token arrive maintenant par un vrai email (Gmail SMTP) — on affiche
      // toujours le formulaire pour le coller, sans pré-remplissage automatique.
      if (resetForm) {
        resetForm.style.display = 'block';
        document.getElementById('resetToken').value = '';
        document.getElementById('resetToken').focus();
      }
    });
  }

  // FORGOT PASSWORD FORM — étape 2 : appliquer le nouveau mot de passe
  const resetForm = document.getElementById('resetForm');
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tokenInput = document.getElementById('resetToken');
      const newPassInput = document.getElementById('resetNewPassword');
      const submitBtn = document.getElementById('resetSubmitBtn');

      if (newPassInput.value.length < 8) {
        showFieldError(newPassInput, true);
        triggerShake();
        return;
      }
      showFieldError(newPassInput, false);

      setLoading(submitBtn, true);
      const { ok, data } = await callApi('/api/auth/reset-password', {
        token: tokenInput.value.toUpperCase(),
        newPassword: newPassInput.value
      });
      setLoading(submitBtn, false);

      if (!ok) {
        showToast(data.message || 'Erreur inconnue.', 'error', 'Réinitialisation refusée');
        triggerShake();
        return;
      }

      showToast('Mot de passe réinitialisé. Vous pouvez vous connecter.', 'success', 'Succès');
      resetForm.reset();
      resetForm.style.display = 'none';
      document.getElementById('forgotSuccessBox').style.display = 'none';
      switchView('login');
    });
  }

  // LOGOUT BUTTON (aucun endpoint serveur dédié : on efface juste l'état local)
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      session.token = null;
      session.role = null;
      document.getElementById('dashToken').textContent = '';
      showToast('Déconnecté (côté client).', 'info', 'Déconnexion');
      switchView('login');
    });
  }

  // --------------------------------------------------------------------------
  // PANNEAU ADMIN
  // --------------------------------------------------------------------------
  const openAdminBtn = document.getElementById('openAdminBtn');
  if (openAdminBtn) {
    openAdminBtn.addEventListener('click', () => {
      switchView('admin');
      loadAdminData();
    });
  }

  function showAdminError(msg) {
    const box = document.getElementById('adminErrorBox');
    if (!box) return;
    if (!msg) { box.classList.remove('show'); box.textContent = ''; return; }
    box.textContent = msg;
    box.classList.add('show');
  }

  async function loadAdminData() {
    showAdminError('');
    const [usersRes, appsRes, accessRes] = await Promise.all([
      callApiAuth('/api/admin/users', 'GET'),
      callApiAuth('/api/admin/applications', 'GET'),
      callApiAuth('/api/admin/access', 'GET')
    ]);

    if (!usersRes.ok || !appsRes.ok) {
      showAdminError('Session expirée ou droits insuffisants — reconnectez-vous avec un compte Admin.');
      return;
    }

    adminUsersCache = Array.isArray(usersRes.data) ? usersRes.data : [];
    adminAppsCache = Array.isArray(appsRes.data) ? appsRes.data : [];
    adminAccessCache = Array.isArray(accessRes.data) ? accessRes.data : [];

    renderUsersList(document.getElementById('searchUsers').value);
    renderAppsList(document.getElementById('searchApps').value);
    renderGrantUserOptions(document.getElementById('searchGrantUser').value);
    renderGrantAppOptions(document.getElementById('searchGrantApp').value);
    renderAccessList(document.getElementById('searchAccess').value);
  }

  function renderAccessList(filter) {
    const list = document.getElementById('adminAccessList');
    const q = (filter || '').trim().toLowerCase();
    const filtered = adminAccessCache.filter(a =>
      a.isAuthorized && (a.userEmail.toLowerCase().includes(q) || a.applicationName.toLowerCase().includes(q))
    );

    list.innerHTML = filtered.length
      ? filtered.map(a => `
          <li>
            <span class="item-label" title="${a.userEmail} → ${a.applicationName}">
              <strong>${a.userEmail} → ${a.applicationName}</strong>
              <span class="role-line">Rôle : ${a.role}</span>
            </span>
            <span class="status-badge active">Autorisé</span>
            <button class="admin-delete-btn" data-revoke-access="${a.id}" title="Révoquer cet accès">✕</button>
          </li>`).join('')
      : `<li class="empty">${adminAccessCache.some(a => a.isAuthorized) ? 'Aucun résultat' : 'Aucun accès attribué'}</li>`;
  }

  const searchAccessInput = document.getElementById('searchAccess');
  if (searchAccessInput) {
    searchAccessInput.addEventListener('input', () => renderAccessList(searchAccessInput.value));
  }

  function renderUsersList(filter) {
    const usersList = document.getElementById('adminUsersList');
    const q = (filter || '').trim().toLowerCase();
    const filtered = adminUsersCache.filter(u => u.email.toLowerCase().includes(q));

    usersList.innerHTML = filtered.length
      ? filtered.map(u => `
          <li>
            <span class="item-label" title="${u.email}">
              <strong>${u.email}</strong>
              ${u.isSuperAdmin ? '<span class="role-line">★ Super-admin</span>' : ''}
            </span>
            <span class="status-badge ${u.isActive ? 'active' : 'inactive'}">${u.isActive ? 'Active' : 'Inactive'}</span>
            <button class="admin-super-btn ${u.isSuperAdmin ? 'is-super' : ''}" data-toggle-super="${u.id}" data-is-super="${u.isSuperAdmin}" title="${u.isSuperAdmin ? 'Retirer le statut super-admin' : 'Accorder le statut super-admin'}">★</button>
            ${u.isActive
              ? `<button class="admin-delete-btn" data-delete-user="${u.id}" title="Désactiver cet utilisateur">✕</button>`
              : `<button class="admin-activate-btn" data-activate-user="${u.id}" title="Réactiver cet utilisateur">✓</button>`}
          </li>`).join('')
      : `<li class="empty">${adminUsersCache.length ? 'Aucun résultat' : 'Aucun utilisateur'}</li>`;
  }

  function renderAppsList(filter) {
    const appsList = document.getElementById('adminAppsList');
    const q = (filter || '').trim().toLowerCase();
    const filtered = adminAppsCache.filter(a => a.name.toLowerCase().includes(q));

    appsList.innerHTML = filtered.length
      ? filtered.map(a => `
          <li>
            <span class="item-label"><strong>${a.name}</strong></span>
            <span class="status-badge ${a.isActive ? 'active' : 'inactive'}">${a.isActive ? 'Active' : 'Inactive'}</span>
            ${a.isActive
              ? `<button class="admin-delete-btn" data-delete-app="${a.id}" title="Désactiver cette application">✕</button>`
              : `<button class="admin-activate-btn" data-activate-app="${a.id}" title="Réactiver cette application">✓</button>`}
          </li>`).join('')
      : `<li class="empty">${adminAppsCache.length ? 'Aucun résultat' : 'Aucune application'}</li>`;
  }

  // Les selects d'attribution n'affichent QUE les comptes/apps actifs (inutile d'attribuer un accès à un compte désactivé)
  function renderGrantUserOptions(filter) {
    const select = document.getElementById('grantUserSelect');
    const q = (filter || '').trim().toLowerCase();
    const filtered = adminUsersCache.filter(u => u.isActive && u.email.toLowerCase().includes(q));
    select.innerHTML = filtered.length
      ? filtered.map(u => `<option value="${u.id}">${u.email}</option>`).join('')
      : '<option value="">Aucun utilisateur actif</option>';
  }

  function renderGrantAppOptions(filter) {
    const select = document.getElementById('grantAppSelect');
    const q = (filter || '').trim().toLowerCase();
    const filtered = adminAppsCache.filter(a => a.isActive && a.name.toLowerCase().includes(q));
    select.innerHTML = filtered.length
      ? filtered.map(a => `<option value="${a.id}">${a.name}</option>`).join('')
      : '<option value="">Aucune application active</option>';
  }

  const searchGrantUserInput = document.getElementById('searchGrantUser');
  if (searchGrantUserInput) {
    searchGrantUserInput.addEventListener('input', () => renderGrantUserOptions(searchGrantUserInput.value));
  }
  const searchGrantAppInput = document.getElementById('searchGrantApp');
  if (searchGrantAppInput) {
    searchGrantAppInput.addEventListener('input', () => renderGrantAppOptions(searchGrantAppInput.value));
  }

  const searchUsersInput = document.getElementById('searchUsers');
  if (searchUsersInput) {
    searchUsersInput.addEventListener('input', () => renderUsersList(searchUsersInput.value));
  }
  const searchAppsInput = document.getElementById('searchApps');
  if (searchAppsInput) {
    searchAppsInput.addEventListener('input', () => renderAppsList(searchAppsInput.value));
  }

  // Délégation d'événement : un seul écouteur pour tous les boutons ✕ / ✓ (même ajoutés dynamiquement)
  document.addEventListener('click', async (e) => {
    const delUserBtn = e.target.closest('[data-delete-user]');
    const delAppBtn = e.target.closest('[data-delete-app]');
    const actUserBtn = e.target.closest('[data-activate-user]');
    const actAppBtn = e.target.closest('[data-activate-app]');
    const revokeAccessBtn = e.target.closest('[data-revoke-access]');
    const toggleSuperBtn = e.target.closest('[data-toggle-super]');

    if (delUserBtn) {
      if (!confirm('Désactiver cet utilisateur ? Il ne pourra plus se connecter.')) return;
      const { ok, data } = await callApiAuth(`/api/admin/users/${delUserBtn.dataset.deleteUser}`, 'DELETE');
      if (!ok) { showToast(data.message || 'Erreur inconnue.', 'error', 'Échec'); return; }
      showToast('Utilisateur désactivé.', 'success', 'Admin');
      loadAdminData();
    }

    if (delAppBtn) {
      if (!confirm('Désactiver cette application ? Plus personne ne pourra s\'y connecter.')) return;
      const { ok, data } = await callApiAuth(`/api/admin/applications/${delAppBtn.dataset.deleteApp}`, 'DELETE');
      if (!ok) { showToast(data.message || 'Erreur inconnue.', 'error', 'Échec'); return; }
      showToast('Application désactivée.', 'success', 'Admin');
      loadAdminData();
      loadPublicApplications();
    }

    if (actUserBtn) {
      const { ok, data } = await callApiAuth(`/api/admin/users/${actUserBtn.dataset.activateUser}/activate`, 'POST');
      if (!ok) { showToast(data.message || 'Erreur inconnue.', 'error', 'Échec'); return; }
      showToast('Utilisateur réactivé.', 'success', 'Admin');
      loadAdminData();
    }

    if (actAppBtn) {
      const { ok, data } = await callApiAuth(`/api/admin/applications/${actAppBtn.dataset.activateApp}/activate`, 'POST');
      if (!ok) { showToast(data.message || 'Erreur inconnue.', 'error', 'Échec'); return; }
      showToast('Application réactivée.', 'success', 'Admin');
      loadAdminData();
      loadPublicApplications();
    }

    if (revokeAccessBtn) {
      if (!confirm('Révoquer cet accès ?')) return;
      const { ok, data } = await callApiAuth(`/api/admin/access/${revokeAccessBtn.dataset.revokeAccess}`, 'DELETE');
      if (!ok) { showToast(data.message || 'Erreur inconnue.', 'error', 'Échec'); return; }
      showToast('Accès révoqué.', 'success', 'Admin');
      loadAdminData();
    }

    if (toggleSuperBtn) {
      const isSuper = toggleSuperBtn.dataset.isSuper === 'true';
      const action = isSuper ? 'revoke-super-admin' : 'grant-super-admin';
      if (!isSuper && !confirm('Accorder les droits de super-administrateur global à cet utilisateur ?')) return;
      const { ok, data } = await callApiAuth(`/api/admin/users/${toggleSuperBtn.dataset.toggleSuper}/${action}`, 'POST');
      if (!ok) { showToast(data.message || 'Erreur inconnue.', 'error', 'Échec'); return; }
      showToast(isSuper ? 'Statut super-admin retiré.' : 'Statut super-admin accordé.', 'success', 'Admin');
      loadAdminData();
    }
  });

  const createAppForm = document.getElementById('createAppForm');
  if (createAppForm) {
    createAppForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('newAppName');
      const submitBtn = document.getElementById('createAppBtn');

      if (!nameInput.value.trim()) {
        showFieldError(nameInput, true);
        triggerShake();
        return;
      }
      showFieldError(nameInput, false);

      setLoading(submitBtn, true);
      const { ok, data } = await callApiAuth('/api/admin/applications', 'POST', { name: nameInput.value.trim() });
      setLoading(submitBtn, false);

      if (!ok) {
        showToast(data.message || 'Erreur inconnue.', 'error', 'Création refusée');
        return;
      }

      showToast(`Application "${nameInput.value}" créée.`, 'success', 'Admin');
      nameInput.value = '';
      loadAdminData();
      loadPublicApplications();
    });
  }

  const grantAccessForm = document.getElementById('grantAccessForm');
  if (grantAccessForm) {
    grantAccessForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userSelect = document.getElementById('grantUserSelect');
      const appSelect = document.getElementById('grantAppSelect');
      const roleSelect = document.getElementById('grantRoleSelect');
      const submitBtn = document.getElementById('grantAccessBtn');

      if (!userSelect.value || !appSelect.value) {
        showToast('Aucun utilisateur ou application disponible.', 'error', 'Erreur');
        return;
      }

      setLoading(submitBtn, true);
      const { ok, data } = await callApiAuth('/api/admin/access', 'POST', {
        userId: userSelect.value,
        applicationId: appSelect.value,
        role: roleSelect.value
      });
      setLoading(submitBtn, false);

      if (!ok) {
        showToast(data.message || 'Erreur inconnue.', 'error', 'Attribution refusée');
        return;
      }

      showToast('Accès attribué avec succès.', 'success', 'Admin');
    });
  }

  // --------------------------------------------------------------------------
  // 5. HELPER FUNCTIONS
  // --------------------------------------------------------------------------
  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function showFieldError(inputEl, isError) {
    const group = inputEl.closest('.input-group');
    if (group) {
      if (isError) group.classList.add('invalid');
      else group.classList.remove('invalid');
    }
  }

  function triggerShake() {
    if (!authCard) return;
    authCard.classList.remove('shake');
    void authCard.offsetWidth; // trigger reflow
    authCard.classList.add('shake');
  }

  function setLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  // TOAST SYSTEM
  window.showToast = function(message, type = 'info', title = 'Notification') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconSvg}</div>
      <div class="toast-body">
        <h5>${title}</h5>
        <p>${message}</p>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 20);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 400);
    }, 4000);
  };
});
