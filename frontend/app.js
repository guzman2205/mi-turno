// ===== MI TURNO v2 — Shared API Client, State & UI Utilities =====

const MT = {
  apiBase: window.location.origin.includes(':80') || window.location.origin.includes('localhost') 
    ? '/api' 
    : 'http://localhost:3000/api',
  
  socket: null,
  user: null,

  // ── Init ────────────────────────────────────────────────
  init() {
    this.loadUser();
    this.initSocket();
    this.scheduleTokenRefresh();
    this.registerServiceWorker();
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          console.log('⚡ PWA Service Worker registrado:', reg.scope);
        }).catch((err) => {
          console.warn('Service Worker no registrado:', err.message);
        });
      });
    }
  },

  loadUser() {
    try {
      const stored = localStorage.getItem('miturno_user') || sessionStorage.getItem('ht_user');
      this.user = stored ? JSON.parse(stored) : null;
    } catch (e) {
      this.user = null;
    }
  },

  getToken() {
    return localStorage.getItem('miturno_token') || '';
  },

  requireAuth() {
    if (!this.getToken()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  logout() {
    localStorage.removeItem('miturno_token');
    localStorage.removeItem('miturno_user');
    sessionStorage.removeItem('ht_user');
    window.location.href = 'login.html';
  },

  // ── Session Refresh Token ───────────────────────────────
  async refreshToken() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const data = await this.api('/auth/refresh', { method: 'POST' });
      if (data && data.token) {
        localStorage.setItem('miturno_token', data.token);
        if (data.user) {
          localStorage.setItem('miturno_user', JSON.stringify(data.user));
          this.user = data.user;
        }
        console.log('🔄 Sesión renovada automáticamente');
        return true;
      }
    } catch (err) {
      console.warn('No se pudo renovar la sesión:', err.message);
    }
    return false;
  },

  scheduleTokenRefresh() {
    // Renovar el token de sesión cada 4 horas automáticamente si hay un usuario logueado
    setInterval(() => {
      if (this.getToken()) {
        this.refreshToken();
      }
    }, 4 * 60 * 60 * 1000);
  },

  // ── API Fetch Helper ────────────────────────────────────
  async api(endpoint, options = {}) {
    const url = `${this.apiBase}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.getToken() ? { 'Authorization': `Bearer ${this.getToken()}` } : {}),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/refresh')) {
        // Intentar refrescar token una vez antes de cerrar sesión
        const refreshed = await this.refreshToken();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.getToken()}`;
          const retryRes = await fetch(url, { ...options, headers });
          if (retryRes.ok) return await retryRes.json();
        }
        this.logout();
        return null;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error en la petición');
      return data;
    } catch (err) {
      console.warn(`[MT API] Error en ${endpoint}:`, err.message);
      throw err;
    }
  },

  // ── Real-Time Socket.io con Reconexión Automática ──────
  initSocket() {
    if (typeof io !== 'undefined' && !this.socket) {
      try {
        const socketUrl = window.location.origin.includes(':80') || window.location.origin.includes('localhost')
          ? undefined
          : 'http://localhost:3000';

        this.socket = io(socketUrl, {
          reconnection: true,
          reconnectionAttempts: 15,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 10000,
          timeout: 20000,
        });

        this.socket.on('connect', () => {
          console.log('⚡ Socket.io conectado');
        });

        this.socket.on('reconnect', (attempt) => {
          console.log(`⚡ Socket.io reconectado exitosamente en el intento #${attempt}`);
          if (window.__MT_ROOM === 'display') {
            this.socket.emit('join_display');
          } else if (window.__MT_ROOM === 'agent') {
            this.socket.emit('join_agent', { agentId: this.user?.id });
          }
        });

        this.socket.on('reconnect_failed', () => {
          console.warn('⚠️ Falló la reconexión con el servidor Socket.io');
          if (typeof this.toast === 'function') {
            this.toast('Conexión en tiempo real perdida. Por favor recargue la página si no se restablece.', 'error');
          }
        });
      } catch (e) {
        console.warn('Socket no disponible en este entorno:', e);
      }
    }
  },

  // ── UI Components: Sidebar & Topbar ──────────────────────
  renderSidebar(activePage = 'dashboard') {
    this.loadUser();
    const el = document.getElementById('sidebar-container');
    if (!el) return;

    const roleName = String(typeof this.user?.role === 'string' ? this.user.role : this.user?.role?.name || '').toLowerCase().trim();
    const roleId = Number(this.user?.role_id || this.user?.role?.id || 1);
    const isAdmin = !this.user || roleId === 1 || roleName.includes('admin') || roleName.includes('administrador');

    el.innerHTML = `
      <aside class="app-sidebar">
        <div class="sidebar-brand">
          <div class="brand-logo"><i class="fa-solid fa-layer-group"></i></div>
          <div class="brand-title">Mi <span>turno</span></div>
        </div>

        <nav class="sidebar-nav">
          <div class="nav-section-label">OPERACIÓN EN VIVO</div>
          <a href="dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}">
            <i class="fa-solid fa-chart-pie"></i> <span>Tablero de Control</span>
          </a>
          <a href="call.html" class="nav-item ${activePage === 'call' ? 'active' : ''}">
            <i class="fa-solid fa-bullhorn"></i> <span>Panel de Llamadas</span>
          </a>
          <a href="display.html" target="_blank" class="nav-item ${activePage === 'display' ? 'active' : ''}">
            <i class="fa-solid fa-tv"></i> <span>Pantalla TV (Pública)</span>
            <span class="badge-live">EN VIVO</span>
          </a>
          <a href="display.html?type=administrative" target="_blank" class="nav-item ${activePage === 'display-admin' ? 'active' : ''}">
            <i class="fa-solid fa-building-user"></i> <span>Pantalla TV (Administrativa)</span>
            <span class="badge-live" style="background:#0284c7;">CITAS</span>
          </a>
          <a href="kiosk.html" target="_blank" class="nav-item ${activePage === 'kiosk' ? 'active' : ''}">
            <i class="fa-solid fa-ticket"></i> <span>Quiosco de Clientes</span>
          </a>

          <div class="nav-section-label">CONFIGURACIÓN & GESTIÓN</div>
          <a href="appointments.html" class="nav-item ${activePage === 'appointments' ? 'active' : ''}">
            <i class="fa-solid fa-calendar-check"></i> <span>Reserva de Citas</span>
          </a>
          <a href="departments.html" class="nav-item ${activePage === 'departments' ? 'active' : ''}">
            <i class="fa-solid fa-building-user"></i> <span>Departamentos</span>
          </a>
          <a href="counters.html" class="nav-item ${activePage === 'counters' ? 'active' : ''}">
            <i class="fa-solid fa-desktop"></i> <span>Mostradores</span>
          </a>
          <a href="services.html" class="nav-item ${activePage === 'services' ? 'active' : ''}">
            <i class="fa-solid fa-briefcase"></i> <span>Servicio</span>
          </a>
          <a href="users.html" class="nav-item ${activePage === 'users' ? 'active' : ''}">
            <i class="fa-solid fa-users"></i> <span>Personal y Usuarios</span>
          </a>
          <a href="roles.html" class="nav-item ${activePage === 'roles' ? 'active' : ''}">
            <i class="fa-solid fa-user-shield"></i> <span>Permisos y Roles</span>
          </a>
          <a href="reports.html" class="nav-item ${activePage === 'reports' ? 'active' : ''}">
            <i class="fa-solid fa-chart-line"></i> <span>Reportes y Métricas</span>
          </a>
          <a href="announcements.html" class="nav-item ${activePage === 'announcements' ? 'active' : ''}">
            <i class="fa-solid fa-scroll"></i> <span>Anuncios en Pantalla</span>
          </a>
          <a href="settings.html" class="nav-item ${activePage === 'settings' ? 'active' : ''}">
            <i class="fa-solid fa-sliders"></i> <span>Configuración General</span>
          </a>
          <a href="logs.html" class="nav-item ${activePage === 'logs' ? 'active' : ''}">
            <i class="fa-solid fa-shield-halved"></i> <span>Auditoría & Logs</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-avatar">${(this.user?.name || 'User').slice(0, 2).toUpperCase()}</div>
            <div class="user-meta">
              <span class="user-name">${this.user?.name || 'Operador'}</span>
              <span class="user-role">${this.user?.role?.name || (isAdmin ? 'Administrador' : 'Agente')}</span>
            </div>
            <button class="btn-logout" title="Cerrar Sesión" onclick="MT.logout()">
              <i class="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      </aside>
    `;
  },

  renderTopbar(title = 'Tablero de Control', subtitle = 'Vista general en tiempo real') {
    const el = document.getElementById('sidebar-container') ? document.getElementById('topbar-container') : null;
    const topbarEl = document.getElementById('topbar-container');
    if (!topbarEl) return;

    topbarEl.innerHTML = `
      <header class="app-topbar">
        <div class="topbar-left">
          <h1 class="page-title">${title}</h1>
          <span class="page-subtitle">${subtitle}</span>
        </div>
        <div class="topbar-right">
          <div class="clock-display" id="clock-display">--:--:--</div>
          <div class="topbar-actions">
            <a href="display_announcements.html" target="_blank" class="btn-topbar" style="background:#8b5cf6; color:#ffffff; border-color:#8b5cf6; font-weight:700;" title="Ver Pantalla de Anuncios, Promociones y Flyers">
              <i class="fa-solid fa-film"></i> Pantalla Anuncios
            </a>
            <a href="kiosk.html" target="_blank" class="btn-topbar" title="Abrir Quiosco">
              <i class="fa-solid fa-ticket"></i> Quiosco
            </a>
            <a href="display.html" target="_blank" class="btn-topbar primary" title="Abrir Pantalla TV Pública">
              <i class="fa-solid fa-tv"></i> TV Pública
            </a>
            <a href="display.html?type=administrative" target="_blank" class="btn-topbar" style="background:#0284c7; color:#fff;" title="Abrir Pantalla TV Administrativa">
              <i class="fa-solid fa-building-user"></i> TV Citas
            </a>
          </div>
        </div>
      </header>
    `;

    this.startClock();
  },

  startClock() {
    const update = () => {
      const clockEl = document.getElementById('clock-display');
      if (clockEl) {
        const now = new Date();
        clockEl.textContent = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    };
    update();
    setInterval(update, 1000);
  },

  // ── Audio & Speech Synthesis ─────────────────────────────
  playChime(overrideType = null) {
    return new Promise((resolve) => {
      try {
        const soundType = overrideType || window.MT_SETTINGS?.tts_chime_sound || 'custom';
        if (!overrideType && (soundType === 'none' || window.MT_SETTINGS?.tts_chime_enabled === 'false')) {
          resolve();
          return;
        }

        // ── 0. Tono Institucional de Turno (Audio MP3 extraído de MP4) ─────────────
        if (soundType === 'custom' || soundType === 'video_chime' || soundType === 'hospiturno') {
          const audio = new Audio('assets/chime_custom.mp3');
          audio.volume = 0.85;
          audio.onended = () => resolve();
          audio.onerror = () => {
            // Fallback sintetizado si falla la carga del archivo MP3
            this.playChime('classic').then(resolve);
          };
          audio.play().then(() => {
            setTimeout(resolve, 4000);
          }).catch(() => resolve());
          return;
        }

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { resolve(); return; }

        const ctx = new AudioContext();
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime + 0.01;

        if (soundType === 'airport') {
          // ── 1. Aeropuerto (3 Tonos PA Terminal: La4 440Hz -> Do#5 554Hz -> Mi5 659Hz) ──
          const notes = [
            { freq: 440.00, start: 0.00, dur: 0.40, gain: 0.40 },
            { freq: 554.37, start: 0.22, dur: 0.40, gain: 0.40 },
            { freq: 659.25, start: 0.44, dur: 0.80, gain: 0.50 }
          ];
          notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(n.freq, now + n.start);
            gain.gain.setValueAtTime(0.001, now + n.start);
            gain.gain.linearRampToValueAtTime(n.gain, now + n.start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur);
          });
          setTimeout(resolve, 1100);

        } else if (soundType === 'digital') {
          // ── 2. Beep Digital Staccato (3 Pulsos Electrónicos) ────────────
          const notes = [
            { freq: 880.00,  start: 0.00, dur: 0.08, gain: 0.30 },
            { freq: 1174.66, start: 0.10, dur: 0.08, gain: 0.35 },
            { freq: 1567.98, start: 0.20, dur: 0.18, gain: 0.40 }
          ];
          notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(n.freq, now + n.start);
            gain.gain.setValueAtTime(0.001, now + n.start);
            gain.gain.linearRampToValueAtTime(n.gain, now + n.start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur);
          });
          setTimeout(resolve, 500);

        } else if (soundType === 'marimba' || soundType === 'soft') {
          // ── 3. Marimba Madera (Percusión de madera: Do4 -> Sol4 -> Do5 -> Mi5) ──
          const notes = [
            { freq: 261.63, start: 0.00, dur: 0.25, gain: 0.50 },
            { freq: 392.00, start: 0.14, dur: 0.25, gain: 0.50 },
            { freq: 523.25, start: 0.28, dur: 0.25, gain: 0.50 },
            { freq: 659.25, start: 0.42, dur: 0.60, gain: 0.55 }
          ];
          notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(n.freq, now + n.start);
            gain.gain.setValueAtTime(0.001, now + n.start);
            gain.gain.linearRampToValueAtTime(n.gain, now + n.start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur);
          });
          setTimeout(resolve, 1000);

        } else if (soundType === 'melody') {
          // ── 4. Melodía Fanfarria (Do5 -> Mi5 -> Sol5 -> Do6) ───────────
          const notes = [
            { freq: 523.25,  start: 0.00, dur: 0.20, gain: 0.40 },
            { freq: 659.25,  start: 0.15, dur: 0.20, gain: 0.40 },
            { freq: 783.99,  start: 0.30, dur: 0.20, gain: 0.40 },
            { freq: 1046.50, start: 0.45, dur: 0.60, gain: 0.45 }
          ];
          notes.forEach(n => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(n.freq, now + n.start);
            gain.gain.setValueAtTime(0.001, now + n.start);
            gain.gain.linearRampToValueAtTime(n.gain, now + n.start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur);
          });
          setTimeout(resolve, 1100);

        } else {
          // ── 5. Classic Ding-Dong (E5 659Hz -> C5 523Hz Gong) ───────────
          const osc1 = ctx.createOscillator(), gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(659.25, now);
          gain1.gain.setValueAtTime(0.001, now);
          gain1.gain.linearRampToValueAtTime(0.45, now + 0.03);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.65);

          const osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(523.25, now + 0.25);
          gain2.gain.setValueAtTime(0.001, now + 0.25);
          gain2.gain.linearRampToValueAtTime(0.50, now + 0.28);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.25);
          osc2.stop(now + 1.25);

          setTimeout(resolve, 950);
        }
      } catch (e) {
        resolve();
      }
    });
  },

  speakTicket(ticketOrNumber, counterName, options = {}) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        console.warn('SpeechSynthesis no soportado en este navegador');
        resolve();
        return;
      }

      window.speechSynthesis.cancel();

      const isObj = typeof ticketOrNumber === 'object' && ticketOrNumber !== null;
      const ticketNum = isObj ? (ticketOrNumber.number || '') : String(ticketOrNumber);
      const isPref = isObj ? (ticketOrNumber.is_preferential === true) : (options.isPreferential === true);
      const serviceName = isObj ? (ticketOrNumber.service?.name || '') : '';

      // ── Try template-based approach first ──────────────────────
      const settings = window.MT_SETTINGS || {};
      const templateNormal = options.templateNormal || settings.tts_template_normal || 'Turno {turno}, por favor proceder a {ventanilla}.';
      const templatePref   = options.templatePref   || settings.tts_template_preferential || 'Atención. Turno preferencial {turno}, por favor proceder a {ventanilla}.';
      const token          = options.token          || settings.voice_token_translation || 'Turno';
      const rate           = parseFloat(options.rate || settings.tts_rate || '0.9');
      const pitch          = parseFloat(options.pitch || settings.tts_voice_pitch || '1.05');

      let phrase = '';

      if (templateNormal || templatePref) {
        // Template-based substitution
        let template = isPref ? (templatePref || templateNormal) : templateNormal;
        const motivo = isObj ? (ticketOrNumber.preferential_reason || 'Atención Prioritaria') : 'Preferencial';
        const clientName = isObj ? (ticketOrNumber.client_name || options.clientName || '') : (options.clientName || '');
        const callByMode = options.callByMode || settings.call_by_mode || (clientName ? 'name' : 'number');

        // Format ticket number for voice: P-CG-003 → "P, C G, 3", CG-012 → "C G, 12"
        const cleanParts = ticketNum.split('-');
        const formattedNum = cleanParts.map(part => {
          if (/^\d+$/.test(part)) return `${parseInt(part, 10)}`;
          return part.split('').join(' ');
        }).join(', ');

        const numOnly = cleanParts.length > 0 && /^\d+$/.test(cleanParts[cleanParts.length - 1])
          ? `${parseInt(cleanParts[cleanParts.length - 1], 10)}`
          : ticketNum;

        const hasExplicitNameTag = /\{nombre\}|\{cliente\}|\{usuario\}/i.test(template);

        let cleanTemplate = template;

        if (callByMode === 'name' && clientName) {
          if (hasExplicitNameTag) {
            cleanTemplate = cleanTemplate
              .replace(/\{token\}\s*/gi, '')
              .replace(/Turno\s+preferencial\s+\{turno\}/gi, 'Atención preferencial, {nombre}')
              .replace(/Turno\s+\{turno\}/gi, '{nombre}');
          } else {
            cleanTemplate = cleanTemplate
              .replace(/\{token\}\s*/gi, '')
              .replace(/Turno\s+preferencial\s+\{turno\}/gi, 'Atención preferencial, ' + clientName)
              .replace(/Turno\s+\{turno\}/gi, clientName)
              .replace(/\{turno\}|\{ticket\}/gi, clientName);
          }
        } else if (callByMode === 'both' && clientName) {
          if (!hasExplicitNameTag) {
            cleanTemplate = cleanTemplate.replace(/\{turno\}|\{ticket\}/gi, `${formattedNum}, usuario ${clientName}`);
          }
        } else {
          cleanTemplate = cleanTemplate.replace(/\{turno\}|\{ticket\}/gi, formattedNum);
        }

        phrase = cleanTemplate
          .replace(/\{token\}/gi, token)
          .replace(/\{nombre\}|\{cliente\}|\{usuario\}/gi, clientName || formattedNum)
          .replace(/\{numero\}/gi, numOnly)
          .replace(/\{servicio\}|\{service\}/gi, serviceName || 'General')
          .replace(/\{ventanilla\}|\{modulo\}|\{mostrador\}|\{counter\}/gi, counterName || 'Ventanilla')
          .replace(/\{motivo\}|\{razon\}|\{reason\}/gi, motivo);
      } else {
        // Fallback
        const callPhrase = options.callTranslation || settings.voice_call_translation || 'Por favor proceder a';
        const destination = counterName || 'Ventanilla';
        const cleanParts = ticketNum.split('-');
        const formattedParts = cleanParts.map(part => {
          if (/^\d+$/.test(part)) return `${parseInt(part, 10)}`;
          return part.split('').join(' ');
        }).join(', ');

        if (isPref) {
          phrase = `Atención. ${token} preferencial, ${formattedParts}. ${callPhrase} ${destination}.`;
        } else {
          phrase = `${token}, ${formattedParts}. ${callPhrase} ${destination}.`;
        }
      }

      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = 'es-ES';
      utter.rate = rate;
      utter.pitch = 1.05;

      const setVoiceAndSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const preferredVoice = voices.find(v => v.lang.startsWith('es') && (
            v.name.includes('Natural') || v.name.includes('Google') || 
            v.name.includes('Helena') || v.name.includes('Sabina') || 
            v.name.includes('Alvaro') || v.name.includes('Mia') || v.name.includes('Paulina')
          )) || voices.find(v => v.lang.startsWith('es'));
          
          if (preferredVoice) utter.voice = preferredVoice;
        }

        utter.onend = () => resolve();
        utter.onerror = (err) => {
          console.warn('TTS finalizado o interrumpido:', err);
          resolve();
        };

        window.speechSynthesis.speak(utter);
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => setVoiceAndSpeak();
        setTimeout(setVoiceAndSpeak, 250);
      } else {
        setVoiceAndSpeak();
      }
    });
  },

  // ── Template-based TTS (alias con soporte de repeticiones) ───────────────
  async speakTicketTemplate(ticketOrNumber, counterName, options = {}) {
    const repeats = parseInt(options.repeats || window.MT_SETTINGS?.tts_repeats || '1', 10);
    for (let i = 0; i < repeats; i++) {
      await this.speakTicket(ticketOrNumber, counterName, options);
      if (i < repeats - 1) {
        // Pausa de 1 segundo entre repeticiones
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  },

  // ── Toast Notifications ──────────────────────────────────
  toast(msg, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;
    const icon = type === 'success' ? 'circle-check' : type === 'error' ? 'circle-exclamation' : 'circle-info';
    toast.innerHTML = `<i class="fa-solid fa-${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => MT.init());
