// Safe startup
try {
    if (typeof PRAYER_TEXTS === 'undefined') {
        window.PRAYER_TEXTS = { shacharit: '', mincha: '', arvit: '' };
    }

    // --- FAB MENU LOGIC (Auto-Open) ---
    window.addEventListener('load', () => {
        const fabMenu = document.getElementById('prayer-fab-menu');
        // Auto open after a short delay so user sees it
        setTimeout(() => {
            if (fabMenu) fabMenu.classList.add('open');
            if (fabMenu) fabMenu.classList.remove('hidden');
        }, 1000);
    });

    window.toggleFabMenu = function () {
        const menu = document.getElementById('prayer-fab-menu');
        if (menu) {
            if (menu.classList.contains('open')) {
                menu.classList.remove('open');
                setTimeout(() => menu.classList.add('hidden'), 300); // Wait for transition
            } else {
                menu.classList.remove('hidden');
                // Small delay to allow CSS transition to render
                requestAnimationFrame(() => menu.classList.add('open'));
            }
        }
    };

    // --- SUBSCRIBE REDIRECT ---
    // Overwriting default submit behavior if inline in HTML, 
    // but better to attach listener or just call this function.
    window.handleSubscribe = function (e) {
        e.preventDefault();
        window.setupView('thank-you');
        return false;
    };

    // --- FONT SCALING FIX (Targeted) ---
    window.adjustPrayerFont = function (delta) {
        window.prayerFontSize = Math.max(1.0, Math.min(3.0, window.prayerFontSize + delta));
        const sizeRem = window.prayerFontSize + 'rem';
        console.log('Adjusting prayer font to:', sizeRem);

        // ONLY target prayer text inside prayer views - NOT cards, NOT UI
        const prayerContainers = [
            '#prayer-view',
            '#birkat-view',
            '#meein-view',
            '#haderech-view'
        ];

        prayerContainers.forEach(container => {
            const el = document.querySelector(container);
            if (el) {
                // Find all text elements inside this prayer view
                el.querySelectorAll('.prayer-paragraph, .prayer-paragraph *, .prayer-line, .prayer-line *, .bracha-start, .prayer-instruction, #prayer-text, #prayer-text *, .hebrew-text:not(.card .hebrew-text):not(.section-header .hebrew-text), .blessing-text, #mein-shalosh-text, #birkat-text, #haderech-text').forEach(textEl => {
                    textEl.style.fontSize = sizeRem;
                });
            }
        });

        // Also set a CSS variable for future elements
        document.documentElement.style.setProperty('--prayer-font-size', sizeRem);
    };

    const MAJOR_KEYWORDS = ['ברכות השחר', 'פרשת התמיד', 'פטום הקטורת', 'הודו', 'אשרי', 'קריאת שמע', 'עמידה', 'תחנון', 'עלינו לשבח', 'תפילין'];

    // --- Core Logic ---
    // --- Core Logic ---
    window.formatPrayerText = function (rawText) {
        if (!rawText) return { html: '<p>Loading...</p>', sections: [] };
        if (rawText.length < 50) return { html: '<p class="prayer-instruction">No text found (Check data.js).</p>', sections: [] };

        const sections = [];
        let sectionIndex = 0;
        let html = '';

        // Buffering for Paragraph Mode
        let buffer = [];

        // Keywords
        const MAIN_TITLES = ['תפילת שחרית', 'תפילת מנחה', 'תפילת ערבית', 'ברכת המזון', 'קריאת שמע'];
        const SUBTITLE_KEYWORDS = ['סדר', 'נוסח', 'פרשת'];
        const LIST_SECTIONS = ['ברכות השחר', 'אשרי']; // Sections that should NOT be grouped into block paragraphs

        let currentSectionTitle = '';
        let isListMode = false;

        const flushBuffer = () => {
            if (buffer.length > 0) {
                // Join filtered lines. Check if we need space.
                const text = buffer.join(' ');
                // Auto-bold first Hebrew word (Siddur Style)
                // We only bold the VERY FIRST word of the entire paragraph
                const bolded = text.replace(/^([\u0590-\u05FF]+)/, '<span class="bracha-start">$1</span>');
                html += `<p class="prayer-paragraph">${bolded}</p>`;
                buffer = [];
            }
        };

        const lines = rawText.split('\n');

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim().replace(/<[^>]*>/g, '');
            if (!line) {
                // Empty line -> Force flush (New Paragraph)
                flushBuffer();
                continue;
            }

            // Header Detection
            let isHeader = false;
            let isMainTitle = false;
            let isSubtitle = false;

            // Simple heuristics for headers
            if ((line.length < 45 && !line.includes('.') && !line.includes(':')) || line.includes('עמידה') && line.length < 20) {
                isHeader = true;
            }

            if (isHeader) {
                flushBuffer(); // Headers break paragraphs always

                isMainTitle = MAIN_TITLES.some(t => line.includes(t));
                isSubtitle = SUBTITLE_KEYWORDS.some(k => line.startsWith(k)) || line.includes('נוסח');

                // Track Section for Mode Switching
                currentSectionTitle = line.replace(/[\[\]]/g, '');
                // Detect List Mode
                isListMode = LIST_SECTIONS.some(k => currentSectionTitle.includes(k));

                const id = 'sec-' + sectionIndex++;

                // Add to Nav
                const isMajor = MAJOR_KEYWORDS.some(k => currentSectionTitle.includes(k) || (k === 'עמידה' && currentSectionTitle.includes('שמונה עשרה')));
                if (isMajor) sections.push({ id, title: currentSectionTitle, isMajor: true });

                if (isMainTitle) {
                    html += `<h2 id="${id}" class="prayer-main-title">${currentSectionTitle}</h2>`;
                } else if (isSubtitle) {
                    html += `<h4 id="${id}" class="prayer-subtitle">${currentSectionTitle}</h4>`;
                } else {
                    html += `<h3 id="${id}" class="prayer-header">${currentSectionTitle}</h3>`;
                }

                continue; // Next line
            }

            // Instructions (Italic/Small)
            if (line.startsWith('(') || line.includes('אומרים') || line.includes('ממשיך')) {
                flushBuffer();
                html += `<div class="prayer-instruction">${line}</div>`;
                continue;
            }

            // --- TEXT PROCESSING ---

            // Heuristic for "New Blessing" starts (Like 'Baruch Atah') -> Force new paragraph
            // Only if NOT in list mode (List mode handles this naturally by line breaks)
            if (!isListMode && (line.startsWith('ברוך אתה') || line.startsWith('בָּרוּךְ אַתָּה'))) {
                flushBuffer();
            }

            if (isListMode) {
                // DIRECT RENDER (No Buffer) - "Tight List"
                // Bold first word still applies
                const bolded = line.replace(/^([\u0590-\u05FF]+)/, '<span class="bracha-start">$1</span>');
                html += `<p class="prayer-line">${bolded}</p>`;
            } else {
                // BLOCK MODE - Buffer it
                buffer.push(line);
            }
        }

        flushBuffer(); // Final flush
        return { html, sections };
    };

    // State
    window.appState = {
        fontSize: 1.6,
        theme: 'dark', // 'dark' or 'light'
        isCentered: false,
        isFullWidth: false
    };

    // Sidebar Toggle Functions
    window.toggleSidebar = function () {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('open');
    };

    window.closeSidebar = function () {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    // Global Functions (Window)
    window.toggleTheme = function () {
        // Toggle between 2 modes: Dark and Light
        const modes = ['dark', 'light'];
        let nextIndex = (modes.indexOf(window.appState.theme) + 1) % modes.length;
        window.appState.theme = modes[nextIndex];

        const b = document.body;
        const btn = document.getElementById('theme-btn');

        // Remove all theme classes first
        b.classList.remove('theme-parchment', 'theme-light', 'theme-dark');

        // Add new class
        b.classList.add('theme-' + window.appState.theme);

        // Update Button Icon - use innerHTML for HTML entities
        if (window.appState.theme === 'light') {
            if (btn) btn.innerHTML = '&#9728;'; // Sun for Light mode
        } else {
            if (btn) btn.innerHTML = '&#127769;'; // Moon for Dark mode
        }

        // Update Logo dynamically
        const logo = document.getElementById('app-logo');
        if (logo) {
            if (window.appState.theme === 'light') {
                logo.src = 'img/logo-light.png';
            } else {
                logo.src = 'img/logo-dark.png';
            }
        }

        // Toggle Zmanim Widget (Light/Dark)
        const zmanimLight = document.getElementById('zmanim-widget-light');
        const zmanimDark = document.getElementById('zmanim-widget-dark');
        if (zmanimLight && zmanimDark) {
            if (window.appState.theme === 'light') {
                zmanimLight.style.display = 'block';
                zmanimDark.style.display = 'none';
            } else {
                zmanimLight.style.display = 'none';
                zmanimDark.style.display = 'block';
            }
        }
    };

    // Toggle Prayer Background: White or Parchment
    window.prayerBgParchment = false; // Default: no parchment
    window.togglePrayerBg = function () {
        window.prayerBgParchment = !window.prayerBgParchment;
        const btn = document.getElementById('parchment-btn');

        if (window.prayerBgParchment) {
            document.body.classList.add('parchment-active');
            if (btn) btn.innerHTML = '&#128220;'; // Scroll emoji
            console.log('Parchment mode ON');
        } else {
            document.body.classList.remove('parchment-active');
            if (btn) btn.innerHTML = '&#128196;'; // Page emoji
            console.log('Parchment mode OFF');
        }
    };

    // Adjust Prayer/Blessing Font Size
    window.prayerFontSize = 1.4; // Default rem
    window.adjustPrayerFont = function (delta) {
        window.prayerFontSize = Math.max(1.0, Math.min(2.5, window.prayerFontSize + delta));

        const sizeRem = window.prayerFontSize + 'rem';

        // Apply to all prayer and blessing text elements
        const selectors = [
            '#prayer-text',
            '.prayer-content-wrapper',
            '.prayer-content',
            '.blessing-text',
            '.blessing-content',
            '.hebrew-text',
            '#blessing-text',
            '.bracha-text',
            '#mein-shalosh-text', // Static View
            '#birkat-text',       // Static View
            '#haderech-text'      // Static View
        ];

        selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.style.fontSize = sizeRem;
            });
        });

        // Also set CSS variable for persistence
        document.documentElement.style.setProperty('--prayer-font-size', sizeRem);

        console.log('Text size:', sizeRem);
    };

    window.adjustFont = function (delta) {
        window.appState.fontSize = Math.max(1.0, window.appState.fontSize + delta);
        // Apply globally
        document.documentElement.style.setProperty('--font-size-base', window.appState.fontSize + 'rem');
        document.body.style.fontSize = window.appState.fontSize + 'rem';
    };

    // Shared Controls HTML
    const PRAYER_CONTROLS_HTML = `
        <div class="prayer-controls-toolbar" style="display:flex; justify-content:center; gap:10px; margin-bottom:15px;">
            <button onclick="window.adjustPrayerFont(0.1)" class="control-btn">A+</button>
            <button onclick="window.adjustPrayerFont(-0.1)" class="control-btn">A-</button>
            <button onclick="window.toggleAlign()" class="control-btn" id="align-btn">↔️</button>
            <button onclick="window.togglePrayerBg()" class="control-btn" id="parchment-btn">📄</button>
        </div>
    `;

    window.toggleAlign = function () {
        window.appState.isCentered = !window.appState.isCentered;

        // Target ALL prayer containers (Dynamic + Static)
        const targets = ['prayer-text', 'birkat-text', 'haderech-text', 'mein-shalosh-text'];
        const btn = document.getElementById('align-btn'); // Only updates first one found, but typically only one toolbar visible

        targets.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                if (window.appState.isCentered) el.classList.add('text-center');
                else el.classList.remove('text-center');
            }
        });

        // Update all buttons text
        document.querySelectorAll('#align-btn').forEach(b => {
            b.textContent = window.appState.isCentered ? '➡️' : '↔️';
        });
    };

    window.toggleWidth = function () {
        window.appState.isFullWidth = !window.appState.isFullWidth;
        const el = document.querySelector('.content-area'); // Target main container
        const btn = document.getElementById('width-btn');
        if (el) {
            el.style.maxWidth = window.appState.isFullWidth ? '100%' : '1200px';
            if (btn) btn.textContent = window.appState.isFullWidth ? '📄' : '↔';
        }
    };

    window.setupView = function (viewId) {
        // Save scroll position before navigating away
        if (document.getElementById('home-view') && !document.getElementById('home-view').classList.contains('hidden')) {
            window.savedScrollPosition = window.scrollY || window.pageYOffset;
        }

        // CRITICAL: Scroll to top when navigating to any view
        window.scrollTo(0, 0);

        if (viewId === 'store') { window.open('https://elit-express.square.site'); return; }

        // Hide all
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));

        // Show Back
        const back = document.getElementById('back-btn');
        if (back) back.classList.remove('hidden');

        // Logic
        if (['shacharit', 'mincha', 'arvit'].includes(viewId)) {
            const pv = document.getElementById('prayer-view');
            pv.classList.remove('hidden'); pv.classList.add('active');

            // Render
            const raw = PRAYER_TEXTS[viewId];
            const processed = window.formatPrayerText(raw);
            const container = document.getElementById('prayer-text');

            document.getElementById('page-title').textContent = viewId.charAt(0).toUpperCase() + viewId.slice(1);

            // Nav Bar
            let nav = '';
            const navItems = processed.sections;

            if (navItems.length > 0) {
                nav = '<div class="prayer-nav scroll-hide">' + navItems.map(s =>
                    `<button onclick="document.getElementById('${s.id}').scrollIntoView({behavior:'smooth',block:'center'})">${s.title}</button>`
                ).join('') +
                    `<button onclick="window.togglePrayerSearch()" style="background: var(--gold); color: black; font-weight: bold; border: 1px solid rgba(0,0,0,0.2);">🔍 Find</button>` +
                    '</div>';
            } else {
                nav = '<div class="prayer-nav scroll-hide"><button onclick="window.togglePrayerSearch()" style="background: var(--gold); color: black; font-weight: bold;">🔍 Find Text</button></div>';
            }

            // Controls + Nav + Content (No Local Toolbar)
            container.innerHTML = nav + `<div class="prayer-content">${processed.html}</div>`;

            // Reapply settings
            if (window.appState.isCentered) document.querySelector('.prayer-content').classList.add('text-center');

            window.scrollTo(0, 0);

        } else if (viewId === 'calendar') {
            const el = document.getElementById('calendar-view');
            el.classList.remove('hidden'); el.classList.add('active');
            document.getElementById('page-title').textContent = 'Tzadikim Hillulot';
            window.renderCalendar();

        } else if (viewId === 'zmanim') {
            const el = document.getElementById('zmanim-view');
            el.classList.remove('hidden'); el.classList.add('active');
            document.getElementById('page-title').textContent = 'Halachic Times';

        } else if (viewId === 'parasha') {
            const el = document.getElementById('parasha-view');
            el.classList.remove('hidden');
            el.classList.add('active');
            document.getElementById('page-title').textContent = "Weekly Parasha";
            if (window.loadParasha) window.loadParasha();

        } else if (['birkat', 'haderech', 'meein'].includes(viewId) || viewId === 'meein-view') {
            // Handle Static Prayer Views
            // Map viewId to correct View Element
            let actualViewId = viewId;
            if (viewId === 'meein') actualViewId = 'meein-view';
            if (viewId === 'birkat') actualViewId = 'birkat-view';
            if (viewId === 'haderech') actualViewId = 'haderech-view';

            // Handle weird ID mismatch legacy
            let el = document.getElementById(actualViewId);
            if (!el) el = document.getElementById(viewId + '-view'); // Fallback specific
            if (!el) el = document.getElementById(viewId); // Fallback exact

            if (el) {
                el.classList.remove('hidden');
                el.classList.add('active');

                // Set Title
                const title = viewId.replace(/-/g, ' ').replace('view', '').trim();
                document.getElementById('page-title').textContent = title.charAt(0).toUpperCase() + title.slice(1);

                // No injectControls needed - use global header

                // Apply current alignment
                let textContainerId = '';
                if (viewId.includes('meein')) textContainerId = 'mein-shalosh-text';
                else if (viewId.includes('birkat')) textContainerId = 'birkat-text';
                else if (viewId.includes('haderech')) textContainerId = 'haderech-text';

                const textContainer = document.getElementById(textContainerId);
                if (window.appState.isCentered && textContainer) textContainer.classList.add('text-center');

            } else {
                console.warn("Could not find view for", viewId);
            }

        } else {
            // Generic fallback
            let el = document.getElementById(viewId);
            if (!el) el = document.getElementById(viewId + '-view');

            if (el) {
                el.classList.remove('hidden');
                el.classList.add('active');
                // Set title if header exists
                const title = viewId.charAt(0).toUpperCase() + viewId.slice(1).replace(/-/g, ' ');
                const pageTitle = document.getElementById('page-title');
                if (pageTitle) pageTitle.textContent = title;
            } else {
                console.warn('View not found:', viewId);
            }
        }
    };

    // Scroll position memory
    window.savedScrollPosition = 0;

    window.goHome = function () {
        document.querySelectorAll('.view').forEach(el => el.classList.add('hidden'));
        document.getElementById('home-view').classList.remove('hidden');
        document.getElementById('home-view').classList.add('active');

        const backBtn = document.getElementById('back-btn');
        if (backBtn) backBtn.classList.add('hidden');

        const pageTitle = document.getElementById('page-title');
        // if (pageTitle) pageTitle.textContent = "Eli's Prayers"; // Keep generic or hide? 
        // User asked for "Logo click brings to home at top".

        // CRITICAL: Scroll to top
        window.scrollTo({ top: 0, behavior: 'instant' });

        // Close sidebar if open
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
    };

    window.renderCalendar = function () {
        if (!window.RABBI_CALENDAR) return;
        const container = document.getElementById('calendar-content');
        if (!container || container.innerHTML.trim() !== '') return; // Already rendered (or not empty)

        let html = '';
        window.RABBI_CALENDAR.forEach(rabbi => {
            html += `
                <div class="rabbi-card">
                    <h3>${rabbi.name}</h3>
                    <div class="rabbi-date">🕯️ ${rabbi.date}</div>
                    <div class="rabbi-location">📍 ${rabbi.location}</div>
                    <p class="rabbi-desc">${rabbi.description}</p>
                </div>
            `;
        });
        container.innerHTML = html;
    };

    window.scrollToTop = function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Live Clock & Analog Logic
    window.updateClock = function () {
        const now = new Date();
        const seconds = now.getSeconds();
        const minutes = now.getMinutes();
        const hours = now.getHours();

        const timeString = now.toLocaleTimeString(); // Digital
        const el = document.getElementById('header-time');
        if (el) el.textContent = timeString;

        // Analog Rotation
        const secDeg = ((seconds / 60) * 360);
        const minDeg = ((minutes / 60) * 360) + ((seconds / 60) * 6);
        const hourDeg = ((hours % 12) / 12) * 360 + ((minutes / 60) * 30);

        const secHand = document.querySelector('.second-hand');
        const minHand = document.querySelector('.minute-hand');
        const hourHand = document.querySelector('.hour-hand');

        if (secHand) secHand.style.transform = `rotate(${secDeg}deg)`;
        if (minHand) minHand.style.transform = `rotate(${minDeg}deg)`;
        if (hourHand) hourHand.style.transform = `rotate(${hourDeg}deg)`;
    };

    // Zman Countdown - Show minutes until next zman
    window.zmanData = null;
    window.tomorrowZmanData = null;
    window.updateZmanCountdown = function () {
        const el = document.getElementById('zman-countdown');
        if (!el) return;

        const now = new Date();
        const today = new Date();

        // After 10 PM, use tomorrow's date for Zmanim
        let targetDate = today;
        if (now.getHours() >= 22) {
            targetDate = new Date(today);
            targetDate.setDate(targetDate.getDate() + 1);
        }
        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

        if (!window.zmanData) {
            // Fetch zmanim from Hebcal
            console.log('Fetching Zmanim for Countdown...');
            fetch(`https://www.hebcal.com/zmanim?cfg=json&geonameid=6077243&date=${dateStr}`)
                .then(r => r.json())
                .then(data => {
                    if (data.times) {
                        console.log('Zmanim Data Received:', data.times);
                        window.zmanData = data.times;
                        window.updateZmanCountdown();
                    }
                })
                .catch((e) => {
                    console.error('Countdown Fetch Error:', e);
                    el.textContent = 'Zmanim Unavailable';
                    el.style.color = '#ef4444';
                });
            return;
        }

        const zmanim = [
            { name: 'Dawn', time: window.zmanData.alotHaShachar },
            { name: 'Sunrise', time: window.zmanData.sunrise },
            { name: 'Shema', time: window.zmanData.sofZmanShmaMGA },
            { name: 'Midday', time: window.zmanData.chatzot },
            { name: 'Mincha', time: window.zmanData.minchaGedola },
            { name: 'Sunset', time: window.zmanData.sunset },
            { name: 'Bdi Avad', time: window.zmanData.sunset ? new Date(new Date(window.zmanData.sunset).getTime() + 18 * 60000).toISOString() : null },
            { name: 'Nightfall', time: window.zmanData.tzeit72min }
        ].filter(z => z.time);

        // Find next zman today
        for (const z of zmanim) {
            const zTime = new Date(z.time);
            if (zTime > now) {
                const diffMs = zTime - now;
                const hours = Math.floor(diffMs / 3600000);
                const mins = Math.round((diffMs % 3600000) / 60000);
                const timeStr = hours > 0 ? `${hours}h${mins}m` : `${mins}m`;

                // Sunset warning: highlight red if within 15 minutes
                if ((z.name === 'Sunset' || z.name === 'Bdi Avad') && diffMs < 15 * 60000) {
                    el.textContent = `⚠️ ${timeStr} → ${z.name}`;
                    el.style.color = '#ef4444'; // Red warning
                    el.style.fontWeight = '700';
                } else {
                    el.textContent = `${timeStr} → ${z.name}`;
                    el.style.color = '#fbbf24'; // Normal gold
                    el.style.fontWeight = '500';
                }
                return;
            }
        }

        // After nightfall - show time until tomorrow's dawn
        if (window.zmanData.alotHaShachar) {
            const tomorrowDawn = new Date(window.zmanData.alotHaShachar);
            tomorrowDawn.setDate(tomorrowDawn.getDate() + 1);
            const diffMs = tomorrowDawn - now;
            const hours = Math.floor(diffMs / 3600000);
            const mins = Math.round((diffMs % 3600000) / 60000);
            el.textContent = `🌙 ${hours}h ${mins}m to Dawn`;
        } else {
            el.textContent = '🌙 Night';
        }

        // Update Bdi Avad display in Zmanim widget
        const bdiAvadEl = document.getElementById('bdi-avad-time');
        if (bdiAvadEl && window.zmanData.sunset) {
            const sunsetTime = new Date(window.zmanData.sunset);
            const bdiAvadTime = new Date(sunsetTime.getTime() + 18 * 60000); // +18 minutes
            const hours = bdiAvadTime.getHours();
            const mins = bdiAvadTime.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const displayHours = hours % 12 || 12;
            const timeStr = `${displayHours}:${String(mins).padStart(2, '0')} ${ampm}`;
            bdiAvadEl.textContent = timeStr;

            // Also update header Bdi Avad
            const headerBdiAvad = document.getElementById('bdi-avad-header-time');
            if (headerBdiAvad) {
                headerBdiAvad.textContent = timeStr;
            }

            // Hide Bdi Avad inline if 5 minutes have passed since Bdi Avad time
            const bdiAvadInline = document.getElementById('bdi-avad-inline');
            const now = new Date();
            const fiveMinAfterBdiAvad = new Date(bdiAvadTime.getTime() + 5 * 60000);
            if (bdiAvadInline) {
                if (now > fiveMinAfterBdiAvad) {
                    bdiAvadInline.style.display = 'none';
                } else {
                    bdiAvadInline.style.display = 'inline';
                }
            }
        }
    };

    // Parasha Data (Static for now, can be properly fetched later)
    const PARASHA_DATA = {
        name: "Va'era",
        date: "January 17-18, 2026 / 28 Tevet 5786",
        summary: "G-d reveals Himself to Moses as 'Hashem', promising to redeem the Israelites. Moses confronts Pharaoh, demanding clarity. The first seven plagues strike Egypt: Blood, Frogs, Lice, Wild Animals, Pestilence, Boils, and Hail. Pharaoh remains stubborn.",
        times: {
            lighting: "4:24 PM",
            havdalah: "5:31 PM"
        },
        questions: [
            "What was the first plague?",
            "Why did the fish die in the Nile?",
            "Who were Moses and Aaron's parents?"
        ],
        links: [
            { title: "Chabad Parasha Section", url: "https://www.chabad.org/parshah/default_cdo/jewish/Torah-Portion.htm" },
            { title: "Aish.com Family Parasha", url: "https://aish.com/weekly-torah-portion/" }
        ]
    };

    window.loadParasha = function () {
        document.getElementById('parasha-title').textContent = "Parashat " + PARASHA_DATA.name;
        document.getElementById('parasha-date').textContent = PARASHA_DATA.date;
        document.getElementById('parasha-summary').textContent = PARASHA_DATA.summary;

        // Times
        document.getElementById('parasha-times').innerHTML = `
            <p><strong>🕯️ Candle Lighting:</strong> ${PARASHA_DATA.times.lighting}</p>
            <p><strong>✨ Shabbat Ends:</strong> ${PARASHA_DATA.times.havdalah}</p>
        `;

        // Kids
        const qList = PARASHA_DATA.questions.map(q => `<li>${q}</li>`).join('');
        document.getElementById('parasha-kids').innerHTML = `<ul>${qList}</ul>`;

        // Links
        const lList = PARASHA_DATA.links.map(l => `<a href="${l.url}" target="_blank" class="accent-link" style="display:block; margin-bottom:5px;">${l.title} 🔗</a>`).join('');
        document.getElementById('parasha-links').innerHTML = lList;
    };

    // Scroll Listener for Back to Top
    window.addEventListener('scroll', function () {
        const btn = document.getElementById('back-to-top');
        if (!btn) return;
        if (window.scrollY > 300) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
        }
    });

    // PWA Install Logic
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const btn = document.getElementById('install-btn');
        if (btn) btn.classList.remove('hidden');
    });

    window.installPWA = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        }
        deferredPrompt = null;
        document.getElementById('install-btn').classList.add('hidden');
    };

    // Language Toggle
    let currentLang = 'en';
    window.toggleLanguage = function () {
        currentLang = currentLang === 'en' ? 'he' : 'en';
        const t = window.APP_CONFIG.translations[currentLang];

        // Update elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (t[key]) el.textContent = t[key];
        });

        // Update Welcome
        const w = document.getElementById('welcome-msg');
        if (w) w.textContent = t.welcome;

        // Button label
        const btn = document.getElementById('lang-btn');
        if (btn) btn.textContent = currentLang === 'en' ? '🌐 EN/HE' : '🌐 HE/EN';

        // RTL for Hebrew
        if (currentLang === 'he') {
            document.body.style.direction = 'rtl';
            document.body.classList.add('hebrew-ui');
        } else {
            document.body.style.direction = 'ltr';
            document.body.classList.remove('hebrew-ui');
        }
    };

    // Daily Quote
    window.initQuote = function () {
        const quotes = window.APP_CONFIG.quotes;
        // Pick based on day of year to change daily
        const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
        const quote = quotes[dayOfYear % quotes.length];
        const el = document.getElementById('daily-quote');
        if (el) el.textContent = `"${quote}"`;
    };

    // Init
    document.addEventListener('DOMContentLoaded', function () {
        const d = document.getElementById('current-date');
        if (d) d.textContent = new Date().toDateString();

        // Date displays (welcome banner + header)
        const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const shortDateStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

        const dDisplay = document.getElementById('date-display');
        if (dDisplay) dDisplay.textContent = dateStr;

        const headerDate = document.getElementById('header-date');
        if (headerDate) headerDate.textContent = shortDateStr;

        // Hebrew Date (both locations)
        fetch('https://www.hebcal.com/converter?cfg=json&g2h=1&gy=' + new Date().getFullYear() + '&gm=' + (new Date().getMonth() + 1) + '&gd=' + new Date().getDate())
            .then(r => r.json())
            .then(data => {
                if (data.hebrew) {
                    const hebrewDateDisplay = document.getElementById('hebrew-date-display');
                    if (hebrewDateDisplay) hebrewDateDisplay.textContent = data.hebrew;

                    const headerHebrew = document.getElementById('header-hebrew-date');
                    if (headerHebrew) headerHebrew.textContent = data.hebrew;
                }
            })
            .catch(() => { });

        // Start Clock
        window.updateClock();
        setInterval(window.updateClock, 1000);

        // Start Zman Countdown
        window.updateZmanCountdown();
        setInterval(window.updateZmanCountdown, 60000); // Update every minute

        // Daily Quote
        if (window.initQuote) window.initQuote();

        // Initial Theme - Dark Blue Mode
        document.body.classList.add('theme-dark');
        const btn = document.getElementById('theme-btn');
        if (btn) btn.textContent = '🌙';

        // Re-inject Zmanim if needed (sometimes needed for dynamic views)
        const zContainer = document.getElementById('myzmanim-embed');
        if (zContainer && !zContainer.hasChildNodes()) {
            const s = document.createElement('script');
            s.src = "https://www.myzmanim.com/widget.aspx?lang=en&mode=vertical&width=300";
            zContainer.appendChild(s);
        }
        // === SEARCH FUNCTIONALITY ===

        // Searchable Index
        const searchIndex = [
            { id: 'shacharit', title: 'Shacharit', hebrew: 'שחרית', desc: 'Morning Service', icon: '☀️' },
            { id: 'mincha', title: 'Mincha', hebrew: 'מנחה', desc: 'Afternoon Service', icon: '☀️' },
            { id: 'arvit', title: 'Arvit', hebrew: 'ערבית', desc: 'Evening Service', icon: '🌙' },
            { id: 'haderech', title: 'Tefilat Haderech', hebrew: 'תפילת הדרך', desc: 'Traveler\'s Prayer', icon: '🚗' },
            { id: 'birkat', title: 'Birkat Hamazon', hebrew: 'ברכת המזון', desc: 'Grace After Meals', icon: '🍞' },
            { id: 'meein', title: 'Meein Shalosh', hebrew: 'מעין שלוש', desc: 'Al Hamichya', icon: '🍇' },
            { id: 'parasha', title: 'Weekly Parasha', hebrew: 'פרשת השבוע', desc: 'Torah Portion', icon: '📜' },
            { id: 'zmanim', title: 'Zmanim', hebrew: 'זמנים', desc: 'Halachic Times', icon: '🕐' },
            { id: 'calendar', title: 'Calendar', hebrew: 'לוח שנה', desc: 'Holidays & Events', icon: '📅' },
            { id: 'tehillim', title: 'Tehillim', hebrew: 'תהילים', desc: 'Psalms', icon: '📖' },
            { id: 'omer', title: 'Sefirat HaOmer', hebrew: 'ספירת העומר', desc: 'Counting the Omer', icon: '🌾' },
            { id: 'resources', title: 'Resources', hebrew: 'משאבים', desc: 'Siddurim & More', icon: '📚' }
        ];

        window.toggleSearch = function () {
            const modal = document.getElementById('search-modal');
            const input = document.getElementById('search-input');

            if (modal.classList.contains('hidden')) {
                modal.classList.remove('hidden');
                input.value = '';
                renderSearchResults(searchIndex); // Show all initially
                input.focus();
            } else {
                modal.classList.add('hidden');
            }
        };

        // Filter Logic
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filtered = searchIndex.filter(item =>
                    item.title.toLowerCase().includes(term) ||
                    item.hebrew.includes(term) ||
                    item.desc.toLowerCase().includes(term)
                );
                renderSearchResults(filtered);
            });
        }

        // Render Results
        function renderSearchResults(items) {
            const container = document.getElementById('search-results');
            if (!container) return;

            container.innerHTML = '';

            if (items.length === 0) {
                container.style.display = 'block'; // Ensure container is visible
                container.innerHTML = '<p style="color:white; text-align:center; grid-column:1/-1;">No results found.</p>';
                return;
            }
            container.style.display = 'grid';

            items.forEach(item => {
                const div = document.createElement('div');
                div.className = 'search-result-card';
                div.onclick = () => {
                    window.toggleSearch(); // Close modal
                    window.setupView(item.id); // Navigate
                };

                div.innerHTML = `
                    <h4>${item.title}</h4>
                    <p style="font-family: 'Assistant', sans-serif; color: var(--gold); margin: 2px 0;">${item.hebrew}</p>
                    <p>${item.desc}</p>
                `;
                container.appendChild(div);
            });
        }

        // Close on click outside
        const searchModal = document.getElementById('search-modal');
        if (searchModal) {
            searchModal.addEventListener('click', (e) => {
                if (e.target.id === 'search-modal') {
                    window.toggleSearch();
                }
            });
        }

        // === PRAYER TEXT SEARCH (Find specific parts like Ashrei) ===
        window.togglePrayerSearch = function () {
            const modal = document.getElementById('prayer-search-modal');
            if (modal) {
                if (modal.classList.contains('active')) {
                    modal.classList.remove('active');
                } else {
                    modal.classList.add('active');
                    setTimeout(() => {
                        const input = document.getElementById('prayer-search-input');
                        if (input) input.focus();
                    }, 50);
                }
            }
        };

        window.searchPrayerText = function () {
            const input = document.getElementById('prayer-search-input');
            if (!input) return;

            const term = input.value;
            if (!term) return;

            // Simple find in page or highlighting
            if (window.find && window.find(term, false, false, true)) {
                // Found
            } else {
                alert("Text '" + term + "' not found.");
            }
        };

        // Allow Enter key
        const pInput = document.getElementById('prayer-search-input');
        if (pInput) {
            pInput.addEventListener('keypress', function (e) {
                if (e.key === 'Enter') {
                    window.searchPrayerText();
                }
            });
        }

    });

    // --- JUMP TO SECTION (Split Action Logic) ---
    window.openSectionModal = function (prayerType, event) {
        event.stopPropagation(); // Prevents opening the main prayer view immediately

        // Ensure data is loaded
        const rawText = window.PRAYER_TEXTS ? window.PRAYER_TEXTS[prayerType] : '';
        if (!rawText) {
            console.warn("Prayer text missing for TOC");
            return;
        }

        // Build Modal
        let modal = document.getElementById('toc-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'toc-modal';
            document.body.appendChild(modal);
        }

        // Parse sections from prayer text
        const result = window.formatPrayerText(rawText);
        const sections = result.sections; // { id: 'sec-0', title: '...' }

        let html = `<div class="modal-list">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                <h3 style="color:var(--gold); margin:0;">Jump to Section</h3>
                <button onclick="document.getElementById('toc-modal').remove()" style="padding:5px 10px; width:auto; background:none; border:none; color:white; font-size: 1.5rem; cursor:pointer;">✕</button>
            </div>`;

        if (sections.length === 0) {
            html += `<p style="color:white; text-align:center; padding: 20px;">No sections found in this prayer.</p>`;
        } else {
            sections.forEach(sec => {
                html += `<button onclick="window.jumpTo('${prayerType}', '${sec.id}')">${sec.title}</button>`;
            });
        }
        html += `</div>`;

        modal.innerHTML = html;
        // Close modal if clicking outside
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    };

    window.jumpTo = function (prayerType, sectionId) {
        // Close modal
        const modal = document.getElementById('toc-modal');
        if (modal) modal.remove();

        // Open View
        window.setupView(prayerType);

        // Scroll (Wait for render)
        setTimeout(() => {
            const el = document.getElementById(sectionId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Flash effect
                el.style.transition = 'color 0.5s, background 0.5s';
                el.style.background = 'rgba(251, 191, 36, 0.3)'; // Gold highlight
                setTimeout(() => { el.style.background = 'transparent'; }, 1500);
            }
        }, 400);
    };

    // --- IN-PRAYER SECTION NAVIGATION ---
    // Track current prayer type for the section nav FAB
    window.currentPrayerType = null;

    // Override setupView to track current prayer and show/hide section FAB
    const originalSetupView = window.setupView;
    window.setupView = function (viewId) {
        originalSetupView(viewId);

        // Track prayer type
        if (['shacharit', 'mincha', 'arvit', 'birkat', 'meein', 'haderech'].includes(viewId)) {
            window.currentPrayerType = viewId;
            // Show section nav FAB
            const fab = document.getElementById('section-nav-fab');
            if (fab) fab.style.display = 'flex';
        } else {
            window.currentPrayerType = null;
            // Hide section nav FAB
            const fab = document.getElementById('section-nav-fab');
            if (fab) fab.style.display = 'none';
        }
    };

    // Override goHome to hide section FAB
    const originalGoHome = window.goHome;
    window.goHome = function () {
        originalGoHome();
        window.currentPrayerType = null;
        const fab = document.getElementById('section-nav-fab');
        if (fab) fab.style.display = 'none';
    };

    // Open section modal for CURRENT prayer (used by in-prayer FAB)
    window.openCurrentPrayerSections = function () {
        if (!window.currentPrayerType) {
            console.warn('No prayer currently active');
            return;
        }

        const rawText = window.PRAYER_TEXTS ? window.PRAYER_TEXTS[window.currentPrayerType] : '';
        if (!rawText) {
            console.warn('Prayer text not found for:', window.currentPrayerType);
            return;
        }

        // Build Modal
        let modal = document.getElementById('toc-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'toc-modal';
            document.body.appendChild(modal);
        }

        // Parse sections
        const result = window.formatPrayerText(rawText);
        const sections = result.sections;

        let html = `<div class="modal-list">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px;">
                <h3 style="color:var(--gold); margin:0;">Jump to Section</h3>
                <button onclick="document.getElementById('toc-modal').remove()" style="padding:5px 10px; width:auto; background:none; border:none; color:white; font-size: 1.5rem; cursor:pointer;">✕</button>
            </div>`;

        if (sections.length === 0) {
            html += `<p style="color:white; text-align:center; padding: 20px;">No sections found.</p>`;
        } else {
            sections.forEach(sec => {
                // For in-prayer nav, we just scroll - don't need to re-open the view
                html += `<button onclick="window.scrollToSection('${sec.id}')">${sec.title}</button>`;
            });
        }
        html += `</div>`;

        modal.innerHTML = html;
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
    };

    // Simple scroll to section (for in-prayer navigation)
    window.scrollToSection = function (sectionId) {
        const modal = document.getElementById('toc-modal');
        if (modal) modal.remove();

        const el = document.getElementById(sectionId);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash effect
            el.style.transition = 'background 0.5s';
            el.style.background = 'rgba(251, 191, 36, 0.3)';
            setTimeout(() => { el.style.background = 'transparent'; }, 1500);
        }
    };

} catch (e) {
    alert('CRITICAL APP ERROR: ' + e.message);
}
