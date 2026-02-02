
// Custom Zmanim Component using Hebcal API
(function () {
    const CONTAINER_ID = 'zmanim-card-content';
    // Geoname ID for Cote St Luc / Montreal
    const GEONAME_ID = '6077243';

    async function fetchZmanim() {
        try {
            // Determine Date (Logic: If > 10PM, use tomorrow)
            const now = new Date();
            let targetDate = new Date();

            // "Tomorrow" Logic
            if (now.getHours() >= 22) {
                targetDate.setDate(now.getDate() + 1);
            }

            const dateStr = targetDate.toISOString().split('T')[0];

            // Fetch Zmanim + Hebrew Date
            const url = `https://www.hebcal.com/zmanim?cfg=json&geonameid=${GEONAME_ID}&date=${dateStr}`;
            const res = await fetch(url);
            const data = await res.json();

            // Expose globally for header clock logic (Bdi Avad)
            window.zmanData = data.times;

            renderZmanim(data, targetDate);

            // Trigger Header Clock Updates
            if (window.updateZmanCountdown) {
                window.updateZmanCountdown();
            }
        } catch (e) {
            console.error('Zmanim fetch error:', e);
            document.getElementById(CONTAINER_ID).innerHTML = '<p>Zmanim Unavailable</p>';
        }
    }

    function formatTime(isoStr) {
        if (!isoStr) return '--:--';
        const d = new Date(isoStr);
        let h = d.getHours();
        const m = String(d.getMinutes()).padStart(2, '0');
        //const ampm = h >= 12 ? 'PM' : 'AM';
        //h = h % 12 || 12;
        //return `${h}:${m}`; // 12-hour format without AM/PM to save space, or with?
        // User requested standard format. Let's start with 24h or strict 12h
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    function renderZmanim(data, dateObj) {
        const times = data.times;
        const dateDisplay = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

        // Define rows to show
        const rows = [
            { label: 'Dawn', time: times.alotHaShachar },
            { label: 'Earliest Talis', time: times.misheyakir },
            { label: 'Sunrise', time: times.sunrise },
            { label: 'Latest Shema', time: times.sofZmanShma },
            { label: 'Latest Shacharis', time: times.sofZmanTfila },
            { label: 'Midday', time: times.chatzot },
            { label: 'Earliest Mincha', time: times.minchaGedola },
            { label: 'Plag HaMincha', time: times.plagHaMincha },
            { label: 'Sunset', time: times.sunset },
            { label: 'Nightfall', time: times.tzeit7083 }
        ];

        let html = `
            <div style="text-align: center; margin-bottom: 15px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
                <h3 style="margin: 0; font-size: 1.1rem; color: #fbbf24;">${dateDisplay}</h3>
                <div style="font-size: 0.9rem; opacity: 0.8; direction: rtl; margin-top: 5px;">Loading Hebrew Date...</div>
            </div>
            <div class="zmanim-grid" style="display: grid; grid-template-columns: 1fr auto; gap: 8px; font-size: 0.95rem;">
        `;

        rows.forEach(row => {
            html += `
                <div style="opacity: 0.9;">${row.label}</div>
                <div style="font-weight: 600; text-align: right;">${formatTime(row.time)}</div>
            `;
        });

        html += `</div>`;

        // Bdi Avad Calculation (Sunset + 18m)
        if (times.sunset) {
            const sunsetDate = new Date(times.sunset);
            const bdiAvadDate = new Date(sunsetDate.getTime() + 18 * 60000);
            const bdiStr = bdiAvadDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

            html += `
                <div style="margin-top: 15px; padding: 10px; background: rgba(255, 215, 0, 0.15); border-radius: 6px; text-align: center; border: 1px solid rgba(255, 215, 0, 0.3);">
                    <strong style="color: #fbbf24; display: block; font-size: 0.85rem;">Bdi Avad (Sunset + 18m)</strong>
                    <span style="font-size: 1.2rem; font-weight: 700;">${bdiStr}</span>
                </div>
            `;
        }

        const container = document.getElementById(CONTAINER_ID);
        container.innerHTML = html;

        // Fetch Hebrew Date separately for accuracy
        fetchHebrewDate(dateObj, container);
    }

    function fetchHebrewDate(dateObj, container) {
        fetch(`https://www.hebcal.com/converter?cfg=json&gy=${dateObj.getFullYear()}&gm=${dateObj.getMonth() + 1}&gd=${dateObj.getDate()}&g2h=1`)
            .then(r => r.json())
            .then(d => {
                // Update the placeholder
                const el = container.querySelector('div[style*="direction: rtl"]');
                if (el) el.textContent = d.hebrew;
            });
    }

    // Init
    document.addEventListener('DOMContentLoaded', fetchZmanim);
})();
