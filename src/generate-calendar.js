import { convertSolar2Lunar, getCanChi } from './lunar.js';
import fs from 'fs';
import https from 'https';

// --- CONFIG ---
const CONFIG = {
    lat: 35.6895, // Tokyo
    lon: 139.6917, // Tokyo
    units: 'metric',
    lang: 'vi',
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
        let now;
        try {
            console.log('🕒 Fetching current time from API...');
            const timeUrl = 'https://timeapi.io/api/Time/current/zone?timeZone=Asia/Tokyo';
            const timeData = await fetchData(timeUrl);
            now = new Date(timeData.dateTime);
            console.log('🕒 Time successfully fetched from API.');
        } catch (timeError) {
            console.warn('⚠️ Could not fetch time from API. Falling back to local system time.', timeError.message);
            now = new Date();
        }
        const todaySolar = new Intl.DateTimeFormat('vi-VN', { 
            dateStyle: 'full', 
            timeStyle: 'short', 
            timeZone: 'Asia/Tokyo' 
        }).format(now);
        
        const lunar = convertSolar2Lunar(now.getDate(), now.getMonth() + 1, now.getFullYear(), CONFIG.timezone);
        const lunarDateStr = `Âm lịch: ${lunar.day}/${lunar.month}${lunar.isLeapMonth ? ' (Nhuận)' : ''}`;
        const canChiStr = `Năm: ${getCanChi(lunar)}`;

        // 2. Fetch Weather Data from Free API
        console.log('🌦️ Fetching weather data from free API...');
        const weatherUrl = `https://wttr.in/Tokyo?format=j1&lang=vi`;
        
        let weatherData;
        try {
            weatherData = await fetchData(weatherUrl);
        } catch (apiError) {
            console.error('API Fetch Error (Weather):', apiError.message);
            weatherData = { 
                current_condition: [{ temp_C: 'N/A', humidity: 'N/A', lang_vi: [{value: 'Lỗi lấy dữ liệu'}] }],
                weather: [{ astronomy: [{ sunrise: 'N/A', sunset: 'N/A' }], hourly: [] }],
                nearest_area: [{ areaName: [{value: 'Tokyo'}] }]
            };
        }

        // 3. Process Weather Data
        const cityName = weatherData.nearest_area[0].areaName[0].value;
        const currentTemp = `${weatherData.current_condition[0].temp_C}°C`;
        const weatherDesc = weatherData.current_condition[0].lang_vi[0].value;
        const humidity = weatherData.current_condition[0].humidity;
        const sunrise = weatherData.weather[0].astronomy[0].sunrise;
        const sunset = weatherData.weather[0].astronomy[0].sunset;

        // 4. Generate Forecast HTML
        let forecastHtml = '';
        if (weatherData.weather[0].hourly && weatherData.weather[0].hourly.length > 0) {
            // wttr.in provides 8 hourly forecasts for the day (every 3 hours)
            // We'll take the next 4 available forecasts
            const nowHour = new Date().getHours();
            const hourlyForecasts = weatherData.weather[0].hourly;
            
            // Find the first forecast that is in the future
            let startIndex = hourlyForecasts.findIndex(f => parseInt(f.time) / 100 > nowHour);
            if (startIndex === -1) startIndex = 0; // if all are in the past, show from start

            const forecastsToShow = hourlyForecasts.slice(startIndex, startIndex + 4);

            forecastsToShow.forEach(item => {
                const time = parseInt(item.time) / 100;
                const temp = item.tempC;
                const desc = item.lang_vi[0].value;
                forecastHtml += `
                    <div class="forecast-item">
                        <div style="font-weight: bold;">${time}:00</div>
                        <div style="font-size: 24px; margin: 5px 0;">${Math.round(temp)}°C</div>
                        <div>${desc}</div>
                    </div>
                `;
            });
        } else {
            forecastHtml = '<p>Không có dữ liệu dự báo.</p>';
        }

        // 5. Get Quote
        console.log('📖 Selecting a quote from local file...');
        let quoteOfTheDay = 'Hãy biến mỗi ngày thành một kiệt tác.'; // Default quote
        try {
            const quotesData = fs.readFileSync('src/quotes.json', 'utf-8');
            const quotes = JSON.parse(quotesData).quotes;
            quoteOfTheDay = quotes[Math.floor(Math.random() * quotes.length)];
        } catch (quoteError) {
            console.warn('⚠️ Could not read or parse quotes.json. Using default quote.');
        }

        // 6. Read Template and Replace Placeholders
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
            .replace('{{QUOTE_OF_THE_DAY}}', quoteOfTheDay)
            .replace('{{LAST_UPDATE}}', new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short', timeZone: 'Asia/Tokyo' }).format(now));

        // 7. Write Final HTML
        if (!fs.existsSync('public')) {
            fs.mkdirSync('public', { recursive: true });
        }
        fs.writeFileSync('public/index.html', html);

        console.log('✅ Generated public/index.html successfully!');

    } catch (error) {
        console.error('❌ An error occurred during dashboard generation:', error);
    }
}

generateDashboard();
