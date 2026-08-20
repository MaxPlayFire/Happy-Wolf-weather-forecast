const STORAGE_KEY = 'frostpunk-coal-hive-save-v1';
const SELL_RATE = 10;
const WEATHER_FALLBACK = { temp: -76, condition: 'СИЛЬНИЙ СНІГОПАД', wind: 18, feelsLike: -102, hourly: [-76, -78, -79, -80] };
const defaultState = { coal: 0, stamps: 0, coalPerClick: 1, soundOn: true };

const els = {
  coalCount: document.getElementById('coalCount'),
  thermoCount: document.getElementById('thermoCount'),
  coalPerClickLabel: document.getElementById('coalPerClickLabel'),
  coalClicker: document.getElementById('coalClicker'),
  mineUpgradeBtn: document.getElementById('mineUpgradeBtn'),
  sellCoalBtn: document.getElementById('sellCoalBtn'),
  soundToggle: document.getElementById('soundToggle'),
  cityTemp: document.getElementById('cityTemp'),
  cityCondition: document.getElementById('cityCondition'),
  cityWind: document.getElementById('cityWind'),
  cityFeels: document.getElementById('cityFeels')
};

let state = loadState();
let audioCtx;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved ? { ...defaultState, ...saved } : { ...defaultState };
  } catch (error) {
    return { ...defaultState };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatNumber(value) {
  return Math.floor(value).toLocaleString('uk-UA');
}

function playTone() {
  if (!state.soundOn) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  audioCtx ||= new AudioCtor();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.frequency.value = 110;
  gain.gain.setValueAtTime(.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .12);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + .12);
}

function updateHud() {
  els.coalCount.textContent = formatNumber(state.coal);
  els.thermoCount.textContent = formatNumber(state.stamps);
  els.coalPerClickLabel.textContent = `+${formatNumber(state.coalPerClick)}`;
  els.mineUpgradeBtn.textContent = 'ЗБІЛЬШИТИ КЛІК (+1) — 50';
  els.mineUpgradeBtn.disabled = state.coal < 50;
  els.soundToggle.textContent = state.soundOn ? '🔊 ЗВУК' : '🔇 ЗВУК';
}

function mineCoal(event) {
  state.coal += state.coalPerClick;
  playTone();
  if (event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pop = document.createElement('span');
    pop.className = 'floating-pop';
    pop.textContent = `+${state.coalPerClick}`;
    pop.style.left = `${event.clientX - rect.left}px`;
    pop.style.top = `${event.clientY - rect.top}px`;
    event.currentTarget.appendChild(pop);
    setTimeout(() => pop.remove(), 700);
  }
  saveState();
  updateHud();
}

function sellCoal() {
  const saleValue = Math.floor(state.coal / SELL_RATE);
  if (!saleValue) return;
  state.coal -= saleValue * SELL_RATE;
  state.stamps += saleValue;
  saveState();
  updateHud();
}

function upgradeClick() {
  if (state.coal < 50) return;
  state.coal -= 50;
  state.coalPerClick += 1;
  saveState();
  updateHud();
}

async function fetchCityWeather() {
  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-77.85&longitude=166.66&current=temperature_2m,wind_speed_10m,apparent_temperature&hourly=temperature_2m&timezone=auto&forecast_days=1');
    if (!response.ok) throw new Error('Weather API unavailable');
    const data = await response.json();
    return {
      temp: Math.round(data.current.temperature_2m),
      wind: Math.max(10, Math.round(data.current.wind_speed_10m)),
      feelsLike: Math.round(data.current.apparent_temperature),
      condition: data.current.temperature_2m < -70 ? 'СИЛЬНИЙ СНІГОПАД' : 'КРИЖАНИЙ ВІТЕР',
      hourly: data.hourly?.temperature_2m?.slice(0, 4).map(Math.round) || WEATHER_FALLBACK.hourly
    };
  } catch (error) {
    return WEATHER_FALLBACK;
  }
}

function updateWeather() {
  fetchCityWeather().then((weather) => {
    els.cityTemp.textContent = `${weather.temp}°C`;
    els.cityCondition.textContent = weather.condition;
    els.cityWind.textContent = `ВІТЕР: ${weather.wind} м/с`;
    els.cityFeels.textContent = `ВІДЧУВАЄТЬСЯ ЯК: ${weather.feelsLike}°C`;
    document.querySelectorAll('.city-section .forecast-item strong').forEach((node, index) => {
      node.textContent = `${weather.hourly[index]}°C`;
    });
  });
}

els.coalClicker.addEventListener('click', mineCoal);
els.sellCoalBtn.addEventListener('click', sellCoal);
els.mineUpgradeBtn.addEventListener('click', upgradeClick);
els.soundToggle.addEventListener('click', () => {
  state.soundOn = !state.soundOn;
  saveState();
  updateHud();
});

updateHud();
updateWeather();
window.addEventListener('beforeunload', saveState);
