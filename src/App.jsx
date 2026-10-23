import { useState, useEffect } from 'react';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

const DEFAULT_PLACE = {
  id: 1000000,
  name: 'Gqeberha',
  admin1: 'Eastern Cape',
  country: 'South Africa',
  latitude: -33.9608,
  longitude: 25.6022,
};

// WMO weather codes returned by the API -> description + emoji
const WEATHER_CODES = {
  0: ['Clear sky', '☀️'],
  1: ['Mainly clear', '🌤️'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Fog', '🌫️'],
  48: ['Freezing fog', '🌫️'],
  51: ['Light drizzle', '🌦️'],
  53: ['Drizzle', '🌦️'],
  55: ['Heavy drizzle', '🌦️'],
  56: ['Freezing drizzle', '🌧️'],
  57: ['Heavy freezing drizzle', '🌧️'],
  61: ['Light rain', '🌧️'],
  63: ['Rain', '🌧️'],
  65: ['Heavy rain', '🌧️'],
  66: ['Freezing rain', '🌧️'],
  67: ['Heavy freezing rain', '🌧️'],
  71: ['Light snow', '❄️'],
  73: ['Snow', '❄️'],
  75: ['Heavy snow', '❄️'],
  77: ['Snow grains', '❄️'],
  80: ['Light showers', '🌦️'],
  81: ['Showers', '🌧️'],
  82: ['Heavy showers', '⛈️'],
  85: ['Snow showers', '🌨️'],
  86: ['Heavy snow showers', '🌨️'],
  95: ['Thunderstorm', '⛈️'],
  96: ['Thunderstorm with hail', '⛈️'],
  99: ['Severe thunderstorm with hail', '⛈️'],
};

const describe = (code) => WEATHER_CODES[code] || ['Unknown', '🌡️'];

const placeLabel = (p) => [p.name, p.admin1, p.country].filter(Boolean).join(', ');

function loadSavedPlace() {
  try {
    const saved = localStorage.getItem('weather:lastPlace');
    return saved ? JSON.parse(saved) : DEFAULT_PLACE;
  } catch {
    return DEFAULT_PLACE;
  }
}

function dayName(dateString, index) {
  if (index === 0) return 'Today';
  // Noon avoids the date shifting because of time zones
  return new Date(`${dateString}T12:00:00`).toLocaleDateString('en-ZA', { weekday: 'short' });
}

export default function App() {
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState(loadSavedPlace);
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  // Fetch the forecast whenever the selected place changes
  useEffect(() => {
    const controller = new AbortController();

    async function fetchWeather() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          latitude: place.latitude,
          longitude: place.longitude,
          current:
            'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
          daily:
            'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
          timezone: 'auto',
        });
        const res = await fetch(`${WEATHER_URL}?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error('The weather service is unavailable right now');
        setWeather(await res.json());
      } catch (err) {
        if (err.name !== 'AbortError') {
          setWeather(null);
          setError(err.message || 'Something went wrong');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    fetchWeather();
    return () => controller.abort(); // cancel stale requests
  }, [place]);

  const selectPlace = (p, others = []) => {
    setPlace(p);
    setSuggestions(others);
    try {
      localStorage.setItem('weather:lastPlace', JSON.stringify(p));
    } catch {
      /* storage unavailable, ignore */
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const name = query.trim();
    if (!name) return;

    setSearching(true);
    setError('');
    try {
      const params = new URLSearchParams({ name, count: 5, language: 'en', format: 'json' });
      const res = await fetch(`${GEO_URL}?${params}`);
      if (!res.ok) throw new Error('Search failed, please try again');
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        setSuggestions([]);
        setError(`No city found for "${name}". Check the spelling and try again.`);
        return;
      }
      selectPlace(data.results[0], data.results.slice(1));
      setQuery('');
    } catch (err) {
      setError(err.message || 'Search failed, please try again');
    } finally {
      setSearching(false);
    }
  };

  const [conditionText, conditionIcon] = weather ? describe(weather.current.weather_code) : [];

  return (
    <div className="app">
      <h1 className="title">Weather</h1>

      <form className="search" onSubmit={handleSearch}>
        <input
          type="text"
          aria-label="Search for a city"
          placeholder="Search for a city..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="suggestions">
          <span>Other matches:</span>
          {suggestions.map((s) => (
            <button
              key={s.id}
              className="chip"
              onClick={() => selectPlace(s, suggestions.filter((x) => x.id !== s.id))}
            >
              {placeLabel(s)}
            </button>
          ))}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {loading && !weather && <p className="muted">Loading forecast...</p>}

      {weather && (
        <>
          <div className={`card current ${loading ? 'dim' : ''}`}>
            <p className="place">{placeLabel(place)}</p>
            <div className="current-main">
              <span className="big-icon">{conditionIcon}</span>
              <span className="temp">{Math.round(weather.current.temperature_2m)}°C</span>
            </div>
            <p className="condition">{conditionText}</p>
            <div className="stats">
              <div>
                <span className="stat-label">Feels like</span>
                <span>{Math.round(weather.current.apparent_temperature)}°C</span>
              </div>
              <div>
                <span className="stat-label">Humidity</span>
                <span>{weather.current.relative_humidity_2m}%</span>
              </div>
              <div>
                <span className="stat-label">Wind</span>
                <span>{Math.round(weather.current.wind_speed_10m)} km/h</span>
              </div>
            </div>
          </div>

          <div className={`card ${loading ? 'dim' : ''}`}>
            <h2>7-day forecast</h2>
            <div className="forecast">
              {weather.daily.time.map((date, i) => {
                const [text, icon] = describe(weather.daily.weather_code[i]);
                return (
                  <div key={date} className="day">
                    <span className="day-name">{dayName(date, i)}</span>
                    <span className="day-icon" title={text}>{icon}</span>
                    <span className="day-temps">
                      {Math.round(weather.daily.temperature_2m_max[i])}°
                      <span className="low"> / {Math.round(weather.daily.temperature_2m_min[i])}°</span>
                    </span>
                    <span className="rain">
                      💧 {weather.daily.precipitation_probability_max[i] ?? 0}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <p className="footer">
        Weather data by{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo.com
        </a>
      </p>
    </div>
  );
}