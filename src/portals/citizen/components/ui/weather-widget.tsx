'use client';

import { useEffect, useState } from 'react';

const LUCENA_LAT = 13.9314;
const LUCENA_LON = 121.6169;

type DailyForecast = {
  date: string;
  code: number;
  tempMax: number;
  tempMin: number;
};

type WeatherData = {
  currentTemp: number;
  currentCode: number;
  humidity: number;
  windSpeed: number;
  daily: DailyForecast[];
};

// WMO weather codes -> label + emoji
const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌦️' },
  61: { label: 'Light rain', icon: '🌧️' },
  63: { label: 'Rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Snow', icon: '🌨️' },
  75: { label: 'Heavy snow', icon: '🌨️' },
  80: { label: 'Rain showers', icon: '🌦️' },
  81: { label: 'Rain showers', icon: '🌦️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm w/ hail', icon: '⛈️' },
  99: { label: 'Thunderstorm w/ hail', icon: '⛈️' },
};

function describe(code: number) {
  return WEATHER_CODES[code] || { label: 'Unknown', icon: '🌡️' };
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LUCENA_LAT}&longitude=${LUCENA_LON}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FManila&forecast_days=5`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (!res.ok) throw new Error('Weather request failed');
        return res.json();
      })
      .then((data) => {
        const daily: DailyForecast[] = data.daily.time.map((date: string, i: number) => ({
          date,
          code: data.daily.weather_code[i],
          tempMax: Math.round(data.daily.temperature_2m_max[i]),
          tempMin: Math.round(data.daily.temperature_2m_min[i]),
        }));
        setWeather({
          currentTemp: Math.round(data.current.temperature_2m),
          currentCode: data.current.weather_code,
          humidity: data.current.relative_humidity_2m,
          windSpeed: Math.round(data.current.wind_speed_10m),
          daily,
        });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(true);
      });

    return () => controller.abort();
  }, []);

  if (error) {
    return (
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-6 shadow-sm">
        <p style={{ fontSize: 13, color: '#666666' }}>Weather unavailable right now.</p>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-white border border-[#DDDDDD] rounded-xl p-6 shadow-sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ width: '60%', height: 12, borderRadius: 6, background: '#EEEEEE' }} />
          <div style={{ width: '40%', height: 32, borderRadius: 6, background: '#EEEEEE' }} />
          <div style={{ width: '80%', height: 12, borderRadius: 6, background: '#EEEEEE' }} />
        </div>
      </div>
    );
  }

  const current = describe(weather.currentCode);

  return (
    <div
      style={{
        background: 'linear-gradient(160deg, #0047C4 0%, #003DA5 55%, #002E7E 100%)',
        borderRadius: 16,
        padding: 24,
        color: '#FFFFFF',
        boxShadow: '0 8px 24px rgba(0, 61, 165, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.85 }}>
          <circle cx="12" cy="10" r="3" />
          <path d="M12 21c4-4.5 7-8 7-11a7 7 0 0 0-14 0c0 3 3 6.5 7 11z" />
        </svg>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.75 }}>
          Lucena City
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <span role="img" aria-label={current.label} style={{ fontSize: 52, lineHeight: 1 }}>{current.icon}</span>
        <div>
          <p style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>{weather.currentTemp}°</p>
          <p style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{current.label}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, fontSize: 12, opacity: 0.85, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.18)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span role="img" aria-label="Humidity">💧</span> {weather.humidity}%</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span role="img" aria-label="Wind">💨</span> {weather.windSpeed} km/h</span>
      </div>

      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', opacity: 0.55, marginBottom: 10 }}>
        4-Day Forecast
      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {weather.daily.slice(1).map((day, i, arr) => {
          const info = describe(day.code);
          // `day.date` is a bare Manila calendar day, which parses as UTC
          // midnight, so read its weekday in UTC, not the visitor's zone.
          const label = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
          return (
            <div
              key={day.date}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 13,
                padding: '10px 0',
                borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
              }}
            >
              <span style={{ width: 38, fontWeight: 600, opacity: 0.9 }}>{label}</span>
              <span role="img" aria-label={info.label} style={{ fontSize: 19 }}>{info.icon}</span>
              <span style={{ minWidth: 66, textAlign: 'right' }}>
                <strong>{day.tempMax}°</strong> <span style={{ opacity: 0.6 }}>/ {day.tempMin}°</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
