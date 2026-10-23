import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// A fake API response so tests never call the real service
const forecast = {
  current: {
    temperature_2m: 18.4,
    apparent_temperature: 17.2,
    relative_humidity_2m: 65,
    weather_code: 0,
    wind_speed_10m: 12.3,
  },
  daily: {
    time: [
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15',
      '2026-10-16', '2026-10-17', '2026-10-18',
    ],
    weather_code: [0, 1, 2, 3, 61, 0, 95],
    temperature_2m_max: [22, 21, 20, 19, 18, 23, 24],
    temperature_2m_min: [12, 11, 10, 9, 8, 13, 14],
    precipitation_probability_max: [0, 10, 20, 30, 80, 5, 60],
  },
};

function mockApi({ geo = { results: [] }, forecastOk = true } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url) => {
      if (String(url).includes('geocoding-api')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(geo) });
      }
      return Promise.resolve({ ok: forecastOk, json: () => Promise.resolve(forecast) });
    })
  );
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Weather app', () => {
  test('shows a loading message, then the forecast for the default city', async () => {
    mockApi();
    render(<App />);

    expect(screen.getByText(/loading forecast/i)).toBeInTheDocument();
    expect(
      await screen.findByText('Gqeberha, Eastern Cape, South Africa')
    ).toBeInTheDocument();
    expect(screen.getByText('18°C')).toBeInTheDocument();
    expect(screen.getByText('Clear sky')).toBeInTheDocument();
    expect(screen.getAllByText(/💧/)).toHaveLength(7);
  });

  test('searches for a city and shows its weather', async () => {
    const user = userEvent.setup();
    mockApi({
      geo: {
        results: [
          {
            id: 1,
            name: 'Cape Town',
            admin1: 'Western Cape',
            country: 'South Africa',
            latitude: -33.92,
            longitude: 18.42,
          },
        ],
      },
    });
    render(<App />);
    await screen.findByText(/Gqeberha/);

    await user.type(screen.getByLabelText(/search for a city/i), 'Cape Town');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(
      await screen.findByText('Cape Town, Western Cape, South Africa')
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('name=Cape+Town'));
  });

  test('shows a message when no city is found', async () => {
    const user = userEvent.setup();
    mockApi({ geo: {} });
    render(<App />);
    await screen.findByText(/Gqeberha/);

    await user.type(screen.getByLabelText(/search for a city/i), 'asdfghjkl');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(await screen.findByText(/No city found for "asdfghjkl"/)).toBeInTheDocument();
  });

  test('shows an error when the weather service fails', async () => {
    mockApi({ forecastOk: false });
    render(<App />);

    expect(
      await screen.findByText(/weather service is unavailable/i)
    ).toBeInTheDocument();
  });

  test('remembers the last city from a previous visit', async () => {
    localStorage.setItem(
      'weather:lastPlace',
      JSON.stringify({
        id: 2,
        name: 'London',
        admin1: 'England',
        country: 'United Kingdom',
        latitude: 51.5,
        longitude: -0.12,
      })
    );
    mockApi();
    render(<App />);

    expect(await screen.findByText('London, England, United Kingdom')).toBeInTheDocument();
  });
});