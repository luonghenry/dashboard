import { convertSolar2Lunar, getCanChi } from './lunar.js';
import fs from 'fs';
import https from 'https';

// --- CONFIG ---
const CONFIG = {
    weatherApiKey: process.env.OPENWEATHER_API_KEY || 'YOUR_API_KEY_HERE',
    lat: 35.6895, // Tokyo
    lon: 139.6917, // Tokyo
    units: 'metric',
    lang: 'ja',
    timezone: 9, // JST
};

// --- Helper Functions ---

// Function to fetch data from a URL
function fetchData(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (error) {
                    reject(new Error('Failed to parse JSON response.'));
                }
            });
        }).on('error', (err) => {
            reject(new Error(`Fetch error: ${err.message}`));
        });
    });
}

// Format time from timestamp
function formatTime(timestamp, timezoneOffset) {
    const date = new Date((timestamp + timezoneOffset) * 1000);
    return date.getUTCHours().toString().padStart(2, '0') + ':' + 
           date.getUTCMinutes().toString().padStart(2, '0');
}

// --- Main Generation Logic ---

async function generateDashboard() {
    try {
        console.log('🚀 Starting dashboard generation...');

        // 1. Get Date and Lunar Info
        const now = new Date();
        const todaySolar = new Intl.DateTimeFormat('ja-JP', { 
            dateStyle: 'full', 
            timeStyle: 'short', 
            timeZone: 'Asia/Tokyo' 
        }).format(now);
        
        const lunar = convertSolar2Lunar(now.getDate(), now.getMonth() + 1, now.getFullYear(), CONFIG.timezone);
        const lunarDateStr = `旧暦: ${lunar.day}/${lunar.month}${lunar.isLeapMonth ? ' (閏)' : ''}`;
        const canChiStr = `年: ${getCanChi(lunar)}`;

        // 2. Fetch Weather Data
        console.log('🌦️ Fetching weather data for Tokyo...');
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${CONFIG.lat}&lon=${CONFIG.lon}&appid=${CONFIG.weatherApiKey}&units=${CONFIG.units}&lang=${CONFIG.lang}`;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${CONFIG.lat}&lon=${CONFIG.lon}&appid=${CONFIG.weatherApiKey}&units=${CONFIG.units}&lang=${CONFIG.lang}`;

        let weatherData, forecastData;
        try {
            [weatherData, forecastData] = await Promise.all([
                fetchData(currentUrl),
                fetchData(forecastUrl)
            ]);
        } catch (apiError) {
            console.error('API Fetch Error:', apiError.message);
            // Use dummy data on API failure to still generate a page
            weatherData = { name: 'Tokyo', main: { temp: 'N/A', humidity: 'N/A' }, weather: [{ description: 'データ取得エラー' }], sys: { sunrise: 0, sunset: 0 } };
            forecastData = { list: [] };
        }


        // 3. Process Weather Data
        const cityName = weatherData.name;
        const currentTemp = weatherData.main ? `${Math.round(weatherData.main.temp)}°C` : 'N/A';
        const weatherDesc = weatherData.weather && weatherData.weather[0] ? weatherData.weather[0].description : 'N/A';
        const humidity = weatherData.main ? weatherData.main.humidity : 'N/A';
        const sunrise = weatherData.sys ? formatTime(weatherData.sys.sunrise, weatherData.timezone) : 'N/A';
        const sunset = weatherData.sys ? formatTime(weatherData.sys.sunset, weatherData.timezone) : 'N/A';

        // 4. Generate Forecast HTML
        let forecastHtml = '';
        if (forecastData.list && forecastData.list.length > 0) {
            forecastData.list.slice(0, 4).forEach(item => {
                const time = new Date(item.dt * 1000);
                forecastHtml += `
                    <div class="forecast-item">
                        <div style="font-weight: bold;">${time.getHours()}:00</div>
                        <div style="font-size: 24px; margin: 5px 0;">${Math.round(item.main.temp)}°C</div>
                        <div>${item.weather[0].description}</div>
                    </div>
                `;
            });
        } else {
            forecastHtml = '<p>予報データがありません。</p>';
        }

        // 5. Read Template and Replace Placeholders
        console.log('📝 Reading template and inserting data...');
        const template = fs.readFileSync('src/template.html', 'utf-8');

        const html = template
            .replace('{{SOLAR_DATE}}', todaySolar)
            .replace('{{LUNAR_DATE}}', lunarDateStr)
            .replace('{{CAN_CHI}}', canChiStr)
            .replace('{{CITY_NAME}}', cityName)
            .replace('{{CURRENT_TEMP}}', currentTemp)
            .replace('{{WEATHER_DESC}}', weatherDesc)
            .replace('{{HUMIDITY}}', humidity)
            .replace('{{SUNRISE}}', sunrise)
            .replace('{{SUNSET}}', sunset)
            .replace('{{FORECAST_ITEMS}}', forecastHtml)
            .replace('{{LAST_UPDATE}}', new Intl.DateTimeFormat('ja-JP', { timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(now));

        // 6. Write Final HTML
        if (!fs.existsSync('public')) {
            fs.mkdirSync('public', { recursive: true });
        }
        fs.writeFileSync('public/index.html', html);

        console.log('✅ Generated public/index.html successfully!');
        if (CONFIG.weatherApiKey === 'YOUR_API_KEY_HERE') {
            console.warn('⚠️ WARNING: OpenWeatherMap API key is not set. Weather data will fail to load.');
            console.warn('Please set the OPENWEATHER_API_KEY environment variable or replace the placeholder in generate-calendar.js.');
        }

    } catch (error) {
        console.error('❌ An error occurred during dashboard generation:', error);
    }
}

generateDashboard();
