const STORAGE_KEY = 'frostpunk-coal-hive-save-v1';
const SELL_RATE = 10;
const MINE_CAP = 30;
const WEATHER_FALLBACK = {
  city: {
    temp: -76,
    condition: 'СИЛЬНИЙ СНІГОПАД',
    wind: 18,
    feelsLike: -102,
    hourly: [-76, -78, -79, -80]
  },
  mars: {
    temp: -62,
    condition: 'ПИЛОВА БУРЯ',
    wind: 34,
    hourly: [-64, -63, -61, -60]
  },
  moon: {
    temp: -173,
    condition: 'ЯСНО',
    wind: 0,
    hourly: [-174, -173, -172, -173]
  }
};

const defaultState = {
  coal: 0,
  stamps: 0,
  miners: 0,
  minerUpgradeCost: 500,
  coalPerClick: 1,
  porridgeOwned: false,
  soundOn: true,
  equipment: {
    gloves: { owned: false, price: 500, bonus: 0.05 },
    shovel: { owned: false, price: 750, bonus: 0.1 },
    exoskeleton: { owned: false, price: 2500, bonus: 0.25 },
    suit: { owned: false, price: 1250, bonus: 0.15 }
  }
};

const equipList = [
  { key: 'gloves', name: 'РУКАВИЦІ', bonus: '+5% КЛІК', price: 500 },
  { key: 'shovel', name: 'МІЦНІ ІНСТРУМЕНТИ', bonus: '+10% КЛІК', price: 750 },
  { key: 'exoskeleton', name: 'БУР', bonus: '+25% КЛІК', price: 2500 },
  { key: 'suit', name: 'ТЕРМОКОСТЮМ', bonus: '+15% КЛІК', price: 1250 }
];

const els = {
  coalCount: document.getElementById('coalCount'),
  thermoCount: document.getElementById('thermoCount'),
  coalPerClickLabel: document.getElementById('coalPerClickLabel'),
  mineEfficiencyLabel: document.getElementById('mineEfficiencyLabel'),
  mineProgressBar: document.getElementById('mineProgressBar'),
  minersInfo: document.getElementById('minersInfo'),
  coalClicker: document.getElementById('coalClicker'),
  mineUpgradeBtn: document.getElementById('mineUpgradeBtn'),
  sellCoalBtn: document.getElementById('sellCoalBtn'),
  porridgeBtn: document.getElementById('porridgeBtn'),
  soundToggle: document.getElementById('soundToggle'),
  equipmentGrid: document.getElementById('equipmentGrid'),
  cityTemp: document.getElementById('cityTemp'),
  cityCondition: document.getElementById('cityCondition'),
  cityWind: document.getElementById('cityWind'),
  cityFeels: document.getElementById('cityFeels')
};

let state = loadState();
let audioCtx = null;

function cloneObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneObject(defaultState);

    const parsed = JSON.parse(saved);
    const savedEquipment = (parsed && parsed.equipment) || {};
    return {
      ...cloneObject(defaultState),
      ...parsed,
      equipment: {
        gloves: { ...cloneObject(defaultState.equipment.gloves), ...(savedEquipment.gloves || {}) },
        shovel: { ...cloneObject(defaultState.equipment.shovel), ...(savedEquipment.shovel || {}) },
        exoskeleton: { ...cloneObject(defaultState.equipment.exoskeleton), ...(savedEquipment.exoskeleton || {}) },
        suit: { ...cloneObject(defaultState.equipment.suit), ...(savedEquipment.suit || {}) }
      }
    };
  } catch (error) {
    return cloneObject(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatNumber(value) {
  return Math.floor(value).toLocaleString('uk-UA');
}

function getCoalPerClick() {
  const itemBonus = Object.values(state.equipment).reduce((sum, item) => sum + (item.owned ? item.bonus : 0), 0);
  const minerBoost = 1 + (state.miners / MINE_CAP) * 0.8;
  return state.coalPerClick * (1 + itemBonus) * minerBoost;
}

function getMineEfficiencyPercent() {
  return Math.min(100, Math.round((state.miners / MINE_CAP) * 100));
}

function getMineProgressWidth() {
  return `${Math.min(100, (state.miners / MINE_CAP) * 100)}%`;
}

function playTone(type = 'click') {
  if (!state.soundOn) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;

  if (!audioCtx) audioCtx = new AudioCtor();
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  if (type === 'click') {
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(110, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  } else {
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(60, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  }

  oscillator.start(now);
  oscillator.stop(now + 0.25);
}

function createFloatingText(x, y, value = '+1') {
  const pop = document.createElement('span');
  pop.className = 'floating-pop';
  pop.textContent = value;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 850);
}

function renderEquipment() {
  els.equipmentGrid.innerHTML = '';

  equipList.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'equipment-card';

    const owned = state.equipment[item.key].owned;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'equipment-button';
    button.textContent = owned ? 'КУПЛЕНО' : 'КУПИТИ';
    button.disabled = owned;
    button.addEventListener('click', () => buyEquipment(item.key));

    card.innerHTML = `
      <div class="equipment-icon" aria-hidden="true"></div>
      <h4>${item.name}</h4>
      <div class="bonus">${item.bonus}</div>
      <div class="price"><span>ЦІНА</span><strong>${formatNumber(item.price)}</strong></div>
    `;
    card.appendChild(button);
    els.equipmentGrid.appendChild(card);
  });
}

function updateHud() {
  els.coalCount.textContent = formatNumber(state.coal);
  els.thermoCount.textContent = formatNumber(state.stamps);
  const perClick = getCoalPerClick();
  els.coalPerClickLabel.textContent = `+${Math.max(1, Math.round(perClick))}`;
  els.mineEfficiencyLabel.textContent = `${getMineEfficiencyPercent()}%`;
  els.mineProgressBar.style.width = getMineProgressWidth();
  els.minersInfo.textContent = `${state.miners} / ${MINE_CAP}`;
  els.porridgeBtn.textContent = state.porridgeOwned ? 'КУПЛЕНО' : 'КУПИТИ';
  els.porridgeBtn.disabled = state.porridgeOwned;
  els.soundToggle.textContent = state.soundOn ? '🔊 ЗВУК' : '🔇 ЗВУК';
  els.mineUpgradeBtn.textContent = `ПОЛІПШИТИ (${formatNumber(state.minerUpgradeCost)})`;
  els.mineUpgradeBtn.disabled = state.coal < state.minerUpgradeCost;
}

function mineCoal(event) {
  const perClick = getCoalPerClick();
  state.coal += perClick;
  playTone('click');

  if (event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.width / 2;
    const y = rect.height / 2;
    createFloatingText(x, y, `+${Math.max(1, Math.round(perClick))}`);

    const clickBurst = document.createElement('span');
    clickBurst.className = 'click-burst';
    clickBurst.style.left = `${event.clientX - rect.left}px`;
    clickBurst.style.top = `${event.clientY - rect.top}px`;
    event.currentTarget.appendChild(clickBurst);
    setTimeout(() => clickBurst.remove(), 480);
  }

  saveState();
  updateHud();
}

function sellCoal() {
  const saleValue = Math.floor(state.coal / SELL_RATE);
  if (saleValue <= 0) return;

  state.coal -= saleValue * SELL_RATE;
  state.stamps += saleValue;
  playTone('sell');
  saveState();
  updateHud();
}

function buyMineUpgrade() {
  if (state.coal < state.minerUpgradeCost) return;

  state.coal -= state.minerUpgradeCost;
  state.miners += 1;
  state.minerUpgradeCost = Math.round(state.minerUpgradeCost * 1.42);
  state.coalPerClick += 0.3;
  playTone('upgrade');
  saveState();
  updateHud();
}

function buyPorridge() {
  if (state.porridgeOwned || state.stamps < 150) return;
  state.stamps -= 150;
  state.porridgeOwned = true;
  state.coalPerClick += 1;
  playTone('upgrade');
  saveState();
  updateHud();
}

function buyEquipment(key) {
  const item = state.equipment[key];
  if (!item || item.owned || state.stamps < item.price) return;

  state.stamps -= item.price;
  item.owned = true;
  playTone('upgrade');
  saveState();
  renderEquipment();
  updateHud();
}

function confirmReset() {
  const confirmed = window.confirm('Скинути весь прогрес?');
  if (!confirmed) return;

  state = cloneObject(defaultState);
  saveState();
  renderEquipment();
  updateHud();
}

function setupResetButton() {
  const gearSection = document.querySelector('.gear-section');
  if (!gearSection) return;

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'action-button ghost-button reset-button';
  resetButton.textContent = 'СКИНУТИ ПРОГРЕС';
  resetButton.addEventListener('click', confirmReset);
  gearSection.appendChild(resetButton);
}

function setupSoundToggle() {
  els.soundToggle.addEventListener('click', () => {
    state.soundOn = !state.soundOn;
    saveState();
    updateHud();
  });
}

function updatePlanetParallax() {
  document.querySelectorAll('.planet').forEach((planet) => {
    const distanceFromCenter = planet.getBoundingClientRect().top - window.innerHeight / 2;
    const shift = Math.max(-34, Math.min(34, distanceFromCenter * -0.08));
    planet.style.setProperty('--parallax-shift', `${shift}px`);
  });
}

async function fetchWeatherData() {
  const cityWeather = { ...WEATHER_FALLBACK.city };
  const marsWeather = { ...WEATHER_FALLBACK.mars };
  const moonWeather = { ...WEATHER_FALLBACK.moon };

  try {
    const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-77.85&longitude=166.66&current=temperature_2m,wind_speed_10m,apparent_temperature&hourly=temperature_2m&timezone=auto&forecast_days=1');
    if (!response.ok) throw new Error('Weather API unavailable');

    const data = await response.json();
    const current = data.current;
    const temp = Math.round(current.temperature_2m);
    const wind = Math.max(10, Math.round(current.wind_speed_10m));
    const feels = Math.round(current.apparent_temperature ?? temp - 26);
    const nextHours = data.hourly?.temperature_2m?.slice(0, 4) || cityWeather.hourly;

    cityWeather.temp = temp;
    cityWeather.wind = wind;
    cityWeather.feelsLike = feels;
    cityWeather.hourly = nextHours.map((hour) => Math.round(hour));
    cityWeather.condition = temp < -70 ? 'СИЛЬНИЙ СНІГОПАД' : 'КРИЖАНИЙ ВІТЕР';
  } catch (error) {
    // fallback values intentionally retained
  }

  return { city: cityWeather, mars: marsWeather, moon: moonWeather };
}

function initializeWeatherUi() {
  fetchWeatherData().then((weather) => {
    const city = weather.city;
    els.cityTemp.textContent = `${city.temp}°C`;
    els.cityCondition.textContent = city.condition;
    els.cityWind.textContent = `ВІТЕР: ${city.wind} м/с`;
    els.cityFeels.textContent = `ВІДЧУВАЄТЬСЯ ЯК: ${city.feelsLike}°C`;

    const forecastNodes = document.querySelectorAll('.forecast-item strong');
    city.hourly.forEach((value, index) => {
      if (forecastNodes[index]) {
        forecastNodes[index].textContent = `${value}°C`;
      }
    });
  });
}

function bindEvents() {
  els.coalClicker.addEventListener('click', mineCoal);
  els.sellCoalBtn.addEventListener('click', sellCoal);
  els.mineUpgradeBtn.addEventListener('click', buyMineUpgrade);
  els.porridgeBtn.addEventListener('click', buyPorridge);
  setupSoundToggle();
  setupResetButton();
}

function initialize() {
  bindEvents();
  renderEquipment();
  initializeWeatherUi();
  updateHud();
  updatePlanetParallax();
}

initialize();

window.addEventListener('scroll', updatePlanetParallax, { passive: true });

setInterval(() => {
  const passiveIncome = Math.max(1, Math.round(state.miners * 0.18 + (state.porridgeOwned ? 1 : 0)));
  state.coal += passiveIncome;
  saveState();
  updateHud();
}, 1500);

window.addEventListener('beforeunload', saveState);