
// Custom Weather Component using Open-Meteo API
(function () {
    const CONTAINER_ID = 'weather-card-content';

    // Coordinates for Cote St. Luc / Montreal
    const LAT = 45.4687;
    const LON = -73.6662;

    async function fetchWeather() {
        try {
            // Get Current + Daily Forecast
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=America%2FNew_York`;
            const res = await fetch(url);
            const data = await res.json();

            renderWeather(data);
        } catch (e) {
            console.error('Weather fetch error:', e);
            document.getElementById(CONTAINER_ID).innerHTML = '<p>Weather Unavailable</p>';
        }
    }

    function getWeatherIcon(code) {
        // Simple mapping for Open-Meteo WMO codes
        if (code <= 3) return '☀️'; // Clear/Cloudy
        if (code <= 48) return '🌫️'; // Fog
        if (code <= 67) return '🌧️'; // Rain
        if (code <= 77) return '❄️'; // Snow
        if (code <= 82) return '🌦️'; // Showers
        if (code <= 99) return '⛈️'; // Thunderstorm
        return '☁️';
    }

    function getDayName(dateStr) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[new Date(dateStr + 'T12:00:00').getDay()];
    }

    function renderWeather(data) {
        const current = data.current;
        const daily = data.daily;

        // Main Display
        const icon = getWeatherIcon(current.weather_code);
        const temp = Math.round(current.temperature_2m);

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <div style="text-align: center;">
                    <div style="font-size: 3.5rem;">${icon}</div>
                    <div style="font-size: 2.5rem; font-weight: 700; line-height: 1;">${temp}°C</div>
                </div>
                <div style="text-align: right;">
                    <h2 style="margin: 0; font-size: 1.2rem; font-weight: 600;">Montreal</h2>
                    <p style="margin: 5px 0 0; opacity: 0.7;">Côte Saint-Luc</p>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; margin-top: 15px;">
        `;

        // 3-Day Forecast
        for (let i = 0; i < 3; i++) {
            const dayName = i === 0 ? 'Today' : getDayName(daily.time[i]);
            const dayIcon = getWeatherIcon(daily.weather_code[i]);
            const max = Math.round(daily.temperature_2m_max[i]);
            const min = Math.round(daily.temperature_2m_min[i]);

            html += `
                <div style="text-align: center; flex: 1; ${i < 2 ? 'border-right: 1px solid rgba(255,255,255,0.1);' : ''}">
                    <div style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 5px;">${dayName}</div>
                    <div style="font-size: 1.5rem; margin-bottom: 5px;">${dayIcon}</div>
                    <div style="font-size: 0.9rem; font-weight: 600;">${max}° <span style="font-weight: 400; opacity: 0.7;">${min}°</span></div>
                </div>
            `;
        }

        html += `</div>`;
        document.getElementById(CONTAINER_ID).innerHTML = html;
    }

    // Init
    document.addEventListener('DOMContentLoaded', fetchWeather);
})();
