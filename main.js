const STORAGE_KEY = 'frostpunk-coal-hive-save-v1';
const SELL_RATE = 10;
const MINE_CAP = 30;

const WEATHER_FALLBACK = {
  city: { temp: -76, condition: 'СИЛЬНИЙ СНІГОПАД', wind: 18, feelsLike: -102, hourly: [-76, -78, -79, -80] },
  mars: { temp: -62, condition: 'ПИЛОВА БУРЯ', wind: 34, hourly: [-64, -63, -61, -60] },
  moon: { temp: -173, condition: 'ЯСНО', wind: 0, hourly: [-174, -173, -172, -173] }
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
  { key: 'gloves', name: 'РУКАВИЦІ', bonus: '+5% КЛІК', price: 500, icon: '🧤', description: 'Захищають руки від крижаного металу.' },
  { key: 'shovel', name: 'МІЦНІ ІНСТРУМЕНТИ', bonus: '+10% КЛІК', price: 750, icon: '⛏', description: 'Надійний інструмент для важкої зміни.' },
  { key: 'exoskeleton', name: 'БУР', bonus: '+25% КЛІК', price: 2500, icon: '⚙', description: 'Механічна сила для швидкого видобутку.' },
  { key: 'suit', name: 'ТЕРМОКОСТЮМ', bonus: '+15% КЛІК', price: 1250, icon: '🧥', description: 'Зберігає тепло під час виходу на мороз.' },
  { key: 'porridge', name: 'КАША З ОПИЛКАМИ', bonus: '+1 ВУГІЛЛЯ ЗА КЛІК', price: 150, icon: '🥣', description: 'Гаряча порція, що додає сил для видобутку.' }
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
  soundToggle: document.getElementById('soundToggle'),
  equipmentGrid: document.getElementById('equipmentGrid'),
  equipmentPrev: document.getElementById('equipmentPrev'),
  equipmentNext: document.getElementById('equipmentNext'),
  cityTemp: document.getElementById('cityTemp'),
  cityCondition: document.getElementById('cityCondition'),
  cityWind: document.getElementById('cityWind'),
  cityFeels: document.getElementById('cityFeels')
};

let state = loadState();
let audioCtx = null;
let scenes = [];
let navLinks = [];
let rafPending = false;
let reducedMotion = false;
let equipmentIndex = 0;

function cloneObject(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return cloneObject(defaultState);
    const parsed = JSON.parse(saved);
    const se = (parsed && parsed.equipment) || {};
    return {
      ...cloneObject(defaultState),
      ...parsed,
      equipment: {
        gloves: { ...cloneObject(defaultState.equipment.gloves), ...(se.gloves || {}) },
        shovel: { ...cloneObject(defaultState.equipment.shovel), ...(se.shovel || {}) },
        exoskeleton: { ...cloneObject(defaultState.equipment.exoskeleton), ...(se.exoskeleton || {}) },
        suit: { ...cloneObject(defaultState.equipment.suit), ...(se.suit || {}) }
      }
    };
  } catch (e) {
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
  const itemBonus = Object.values(state.equipment).reduce(function (sum, item) {
    return sum + (item.owned ? item.bonus : 0);
  }, 0);
  const minerBoost = 1 + (state.miners / MINE_CAP) * 0.8;
  return state.coalPerClick * (1 + itemBonus) * minerBoost;
}

function getMineEfficiencyPercent() {
  return Math.min(100, Math.round((state.miners / MINE_CAP) * 100));
}

function getMineProgressWidth() {
  return Math.min(100, (state.miners / MINE_CAP) * 100) + '%';
}

function playTone(type) {
  if (!state.soundOn) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  if (!audioCtx) audioCtx = new AudioCtor();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const now = audioCtx.currentTime;
  if (type === 'click') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  } else {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  }
  osc.start(now);
  osc.stop(now + 0.25);
}

function createFloatingText(x, y, value) {
  const pop = document.createElement('span');
  pop.className = 'floating-pop';
  pop.textContent = value;
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';
  document.body.appendChild(pop);
  setTimeout(function () { pop.remove(); }, 850);
}

function renderEquipment() {
  els.equipmentGrid.innerHTML = '';
  equipList.forEach(function (item) {
    const card = document.createElement('article');
    card.className = 'equipment-card';
    const owned = item.key === 'porridge' ? state.porridgeOwned : state.equipment[item.key].owned;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'equipment-button';
    button.textContent = owned ? 'КУПЛЕНО' : 'КУПИТИ';
    button.disabled = owned;
    button.addEventListener('click', function () { buyEquipment(item.key); });
    card.dataset.position = getEquipmentPosition(equipList.indexOf(item));
    card.innerHTML =
      '<div class="equipment-icon" aria-hidden="true"><span>' + item.icon + '</span></div>' +
      '<h4>' + item.name + '</h4>' +
      '<p class="equipment-description">' + item.description + '</p>' +
      '<div class="bonus">' + item.bonus + '</div>' +
      '<div class="price"><span>ЦІНА</span><strong>' + formatNumber(item.price) + '</strong></div>';
    card.appendChild(button);
    els.equipmentGrid.appendChild(card);
  });
}

function getEquipmentPosition(index) {
  const total = equipList.length;
  const offset = (index - equipmentIndex + total) % total;
  if (offset === 0) return 'active';
  if (offset === 1) return 'next';
  if (offset === total - 1) return 'previous';
  return 'hidden';
}

function moveEquipment(step) {
  equipmentIndex = (equipmentIndex + step + equipList.length) % equipList.length;
  Array.from(els.equipmentGrid.children).forEach(function (card, index) {
    card.dataset.position = getEquipmentPosition(index);
  });
  playTone('click');
}

function updateHud() {
  els.coalCount.textContent = formatNumber(state.coal);
  els.thermoCount.textContent = formatNumber(state.stamps);
  els.coalPerClickLabel.textContent = '+' + Math.max(1, Math.round(getCoalPerClick()));
  els.mineEfficiencyLabel.textContent = getMineEfficiencyPercent() + '%';
  els.mineProgressBar.style.width = getMineProgressWidth();
  els.minersInfo.textContent = state.miners + ' / ' + MINE_CAP;
  els.soundToggle.textContent = state.soundOn ? '🔊 ЗВУК' : '🔇 ЗВУК';
  els.mineUpgradeBtn.textContent = 'ПОЛІПШИТИ (' + formatNumber(state.minerUpgradeCost) + ')';
  els.mineUpgradeBtn.disabled = state.coal < state.minerUpgradeCost;
}

function mineCoal(event) {
  const perClick = getCoalPerClick();
  state.coal += perClick;
  playTone('click');
  if (event) {
    const rect = event.currentTarget.getBoundingClientRect();
    createFloatingText(rect.left + rect.width / 2, rect.top + rect.height / 2, '+' + Math.max(1, Math.round(perClick)));
    const burst = document.createElement('span');
    burst.className = 'click-burst';
    burst.style.left = (event.clientX - rect.left) + 'px';
    burst.style.top = (event.clientY - rect.top) + 'px';
    event.currentTarget.appendChild(burst);
    setTimeout(function () { burst.remove(); }, 480);
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
  renderEquipment();
  updateHud();
}

function buyEquipment(key) {
  if (key === 'porridge') {
    buyPorridge();
    return;
  }
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
  if (!window.confirm('Скинути весь прогрес?')) return;
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
  document.body.appendChild(resetButton);
}

function setupSoundToggle() {
  els.soundToggle.addEventListener('click', function () {
    state.soundOn = !state.soundOn;
    saveState();
    updateHud();
  });
}

function updatePlanetParallax() {
  document.querySelectorAll('.planet').forEach(function (planet) {
    const distanceFromCenter = planet.getBoundingClientRect().top - window.innerHeight / 2;
    const shift = Math.max(-34, Math.min(34, distanceFromCenter * -0.08));
    planet.style.setProperty('--parallax-shift', shift + 'px');
  });
}

function initScenes() {
  scenes = Array.from(document.querySelectorAll('.scene'));
  navLinks = Array.from(document.querySelectorAll('.top-nav a'));
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const id = link.getAttribute('href');
      if (!id) return;
      const target = document.getElementById(id.slice(1));
      if (target) {
        target.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'center'
        });
      }
    });
  });
}

function updateSceneTransitions() {
  if (!scenes.length) return;
  const vh = window.innerHeight;
  const centerY = vh / 2;
  let activeIndex = 0;
  let maxProgress = -Infinity;

  scenes.forEach(function (scene, index) {
    const rect = scene.getBoundingClientRect();
    const sceneCenter = rect.top + rect.height / 2;
    const distance = sceneCenter - centerY;
    const halfRange = vh * 0.85;
    const absDist = Math.abs(distance);
    const t = Math.min(1, absDist / halfRange);
    let progress = Math.max(0, 1 - t);

    var opacity, scale, yOffset, blur, brightness;
    if (reducedMotion) {
      opacity = progress > 0.3 ? 1 : 0.4;
      scale = 1;
      yOffset = 0;
      blur = 0;
      brightness = 1;
    } else {
      var ease = t * t * (3 - 2 * t);
      opacity = 1 - ease * 0.65;
      scale = 1 - ease * 0.04;
      blur = ease * 3.5;
      brightness = 1 - ease * 0.45;
      yOffset = distance < 0 ? -ease * 28 : ease * 40;
    }

    var bgY = reducedMotion ? 0 : distance * 0.28;

    scene.style.setProperty('--scene-opacity', opacity.toFixed(3));
    scene.style.setProperty('--scene-scale', scale.toFixed(4));
    scene.style.setProperty('--scene-y', yOffset.toFixed(1) + 'px');
    scene.style.setProperty('--scene-blur', blur.toFixed(2) + 'px');
    scene.style.setProperty('--scene-brightness', brightness.toFixed(3));
    scene.style.setProperty('--bg-parallax', bgY.toFixed(1) + 'px');
    scene.style.setProperty('--scene-progress', progress.toFixed(3));

    if (progress > maxProgress) {
      maxProgress = progress;
      activeIndex = index;
    }
  });

  var activeId = scenes[activeIndex] ? scenes[activeIndex].id : '';
  navLinks.forEach(function (link) {
    var href = link.getAttribute('href') || '';
    link.classList.toggle('active', href.slice(1) === activeId);
  });
}

function onScrollOrResize() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(function () {
    updateSceneTransitions();
    updatePlanetParallax();
    rafPending = false;
  });
}

async function fetchWeatherData() {
  var cityWeather = Object.assign({}, WEATHER_FALLBACK.city);
  var marsWeather = Object.assign({}, WEATHER_FALLBACK.mars);
  var moonWeather = Object.assign({}, WEATHER_FALLBACK.moon);
  try {
    var response = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-77.85&longitude=166.66&current=temperature_2m,wind_speed_10m,apparent_temperature&hourly=temperature_2m&timezone=auto&forecast_days=1'
    );
    if (!response.ok) throw new Error('Weather API unavailable');
    var data = await response.json();
    var current = data.current;
    var temp = Math.round(current.temperature_2m);
    var wind = Math.max(10, Math.round(current.wind_speed_10m));
    var feels = Math.round(current.apparent_temperature != null ? current.apparent_temperature : temp - 26);
    var nextHours = (data.hourly && data.hourly.temperature_2m)
      ? data.hourly.temperature_2m.slice(0, 4)
      : cityWeather.hourly;
    cityWeather.temp = temp;
    cityWeather.wind = wind;
    cityWeather.feelsLike = feels;
    cityWeather.hourly = nextHours.map(function (h) { return Math.round(h); });
    cityWeather.condition = temp < -70 ? 'СИЛЬНИЙ СНІГОПАД' : 'КРИЖАНИЙ ВІТЕР';
  } catch (e) {
    // keep fallback
  }

  try {
    var marsResponse = await fetch('https://mars.nasa.gov/rss/api/?feed=weather&category=msl&feedtype=json');
    if (!marsResponse.ok) throw new Error('Mars API unavailable');
    var marsData = await marsResponse.json();
    var latestSol = marsData.soles && marsData.soles[0];
    if (latestSol) {
      var minTemp = Number(latestSol.min_temp);
      var maxTemp = Number(latestSol.max_temp);
      marsWeather.temp = Math.round((minTemp + maxTemp) / 2);
      marsWeather.condition = latestSol.atmo_opacity === 'Sunny' ? 'ЯСНО' : 'АТМОСФЕРНІ УМОВИ';
      marsWeather.wind = latestSol.wind_speed === '--' ? null : Math.round(Number(latestSol.wind_speed));
      marsWeather.hourly = [minTemp, marsWeather.temp, maxTemp, marsWeather.temp];
      marsWeather.sol = latestSol.sol;
      marsWeather.date = latestSol.terrestrial_date;
    }
  } catch (e) {
    // keep fallback
  }

  try {
    var today = new Date().toISOString().slice(0, 10);
    var moonController = new AbortController();
    var moonTimeout = setTimeout(function () { moonController.abort(); }, 4000);
    var moonResponse = await fetch('https://aa.usno.navy.mil/api/moon/phases/date?date=' + today + '&nump=1', {
      signal: moonController.signal
    });
    clearTimeout(moonTimeout);
    if (!moonResponse.ok) throw new Error('Moon API unavailable');
    var moonData = await moonResponse.json();
    var phase = moonData.phasedata && moonData.phasedata[0];
    if (phase) {
      moonWeather.condition = phase.phase;
      moonWeather.phaseDate = phase.date;
    }
  } catch (e) {
    // keep fallback
  }

  return {
    city: cityWeather,
    mars: marsWeather,
    moon: moonWeather
  };
}

function initializeWeatherUi() {
  fetchWeatherData().then(function (weather) {
    var city = weather.city;
    els.cityTemp.textContent = city.temp + '°C';
    els.cityCondition.textContent = city.condition;
    els.cityWind.textContent = 'ВІТЕР: ' + city.wind + ' м/с';
    els.cityFeels.textContent = 'ВІДЧУВАЄТЬСЯ ЯК: ' + city.feelsLike + '°C';
    var nodes = document.querySelectorAll('.weather-panel-city .forecast-item strong');
    city.hourly.forEach(function (value, index) {
      if (nodes[index]) nodes[index].textContent = value + '°C';
    });

    var planetCards = document.querySelectorAll('.planet-card');
    var mars = weather.mars;
    var moon = weather.moon;
    var marsCard = planetCards[0];
    var moonCard = planetCards[1];
    if (marsCard) {
      var marsTemp = marsCard.querySelector('.temp-large');
      var marsCondition = marsCard.querySelector('.weather-copy strong');
      var marsWind = marsCard.querySelector('.weather-copy span');
      var marsNodes = marsCard.querySelectorAll('.forecast-item strong');
      marsTemp.textContent = mars.temp + '°C';
      marsCondition.textContent = mars.condition;
      marsWind.textContent = mars.wind == null ? 'ВІТЕР: немає даних' : 'ВІТЕР: ' + mars.wind + ' м/с';
      mars.hourly.forEach(function (value, index) {
        if (marsNodes[index]) marsNodes[index].textContent = Math.round(value) + '°C';
      });
      marsCard.querySelector('header').textContent = 'NASA MSL: SOL ' + (mars.sol || 'невідомо');
    }
    if (moonCard) {
      var moonCondition = moonCard.querySelector('.weather-copy strong');
      var moonWind = moonCard.querySelector('.weather-copy span');
      moonCondition.textContent = moon.condition;
      moonWind.textContent = 'АТМОСФЕРА: відсутня';
      moonCard.querySelector('header').textContent = 'МІСЯЦЬ: NASA/USNO';
    }
  });
}

function initSnow() {
  var canvas = document.getElementById('snowCanvas');
  if (!canvas || reducedMotion) return;
  var ctx = canvas.getContext('2d');
  var flakes = [];
  var w = 0;
  var h = 0;
  var running = true;

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    var count = Math.min(100, Math.floor((w * h) / 16000));
    flakes = [];
    for (var i = 0; i < count; i++) {
      flakes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 0.4,
        s: Math.random() * 0.7 + 0.25,
        a: Math.random() * 0.5 + 0.15,
        drift: Math.random() * 0.5 - 0.25
      });
    }
  }

  function draw() {
    if (!running) return;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#d0e4f0';
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += f.s;
      f.x += f.drift + Math.sin(f.y * 0.012) * 0.2;
      if (f.y > h) { f.y = -5; f.x = Math.random() * w; }
      if (f.x > w) f.x = 0;
      if (f.x < 0) f.x = w;
      ctx.globalAlpha = f.a;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(draw);
  }

  resize();
  draw();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', function () {
    running = !document.hidden;
    if (running) draw();
  });
}

function initLiveClock() {
  var el = document.getElementById('liveClock');
  if (!el) return;
  function tick() {
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    el.textContent = hh + ':' + mm;
  }
  tick();
  setInterval(tick, 15000);
}

function bindEvents() {
  els.coalClicker.addEventListener('click', mineCoal);
  els.sellCoalBtn.addEventListener('click', sellCoal);
  els.mineUpgradeBtn.addEventListener('click', buyMineUpgrade);
  setupSoundToggle();
  setupResetButton();
  els.equipmentPrev.addEventListener('click', function () { moveEquipment(-1); });
  els.equipmentNext.addEventListener('click', function () { moveEquipment(1); });
}

function initialize() {
  initScenes();
  bindEvents();
  renderEquipment();
  initializeWeatherUi();
  updateHud();
  updateSceneTransitions();
  updatePlanetParallax();
  initSnow();
  initLiveClock();
}

initialize();

window.addEventListener('scroll', onScrollOrResize, { passive: true });
window.addEventListener('resize', onScrollOrResize, { passive: true });

setInterval(function () {
  var passiveIncome = Math.max(1, Math.round(state.miners * 0.18 + (state.porridgeOwned ? 1 : 0)));
  state.coal += passiveIncome;
  saveState();
  updateHud();
}, 1500);

window.addEventListener('beforeunload', saveState);