const STORAGE_KEY = 'frostpunk-coal-hive-save-v3';
const SELL_RATE = 10;
const INITIAL_MINE_CAP = 5;

const WEATHER_FALLBACK = {
  city: { temp: -76, condition: 'СИЛЬНИЙ СНІГОПАД', wind: 18, feelsLike: -102, hourly: [-76, -78, -79, -80] },
  mars: { temp: -62, condition: 'ПИЛОВА БУРЯ', wind: 34, hourly: [-64, -63, -61, -60] },
  moon: { temp: -173, condition: 'ЯСНО', wind: 0, hourly: [-174, -173, -172, -173] }
};

const defaultState = {
  coal: 250,
  stamps: 0,
  miners: 5,
  minerHireCost: 25,
  mineCapacity: INITIAL_MINE_CAP,
  mineUpgradeCost: 150,
  coalPerClick: 1,
  porridgeOwned: false,
  automatonOwned: false,
  generatorOn: false,
  runSeconds: 0,
  cityLevel: 1,
  population: 80,
  populationCap: 80,
  runScore: 0,
  totalSold: 0,
  totalHired: 0,
  mineUpgrades: { compact: 0, reinforced: 0, industrial: 0 },
  completedRuns: 0,
  lastRun: null,
  sellPercent: 100,
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
  { key: 'porridge', name: 'КАША З ОПИЛКАМИ', bonus: '+1 ВУГІЛЛЯ ЗА КЛІК', price: 150, icon: '🥣', description: 'Гаряча порція, що додає сил для видобутку.' },
  { key: 'miner', name: 'ШАХТАР', bonus: '+1 АВТОДОХІД', price: 25, icon: '⛏', description: 'Новий працівник для вашої шахти. Купується без обмежень.' },
  { key: 'compact', name: 'КОМПАКТНА ШАХТА', bonus: '+5 МІСЦЬ', price: 150, icon: '▦', description: 'Розширює шахту та відкриває місця для працівників.' },
  { key: 'reinforced', name: 'ПОСИЛЕНА ШАХТА', bonus: '+10 МІСЦЬ', price: 450, icon: '▦', description: 'Міцні кріплення дозволяють заглибитися ще далі.' },
  { key: 'industrial', name: 'ПРОМИСЛОВА ШАХТА', bonus: '+25 МІСЦЬ', price: 1200, icon: '▦', description: 'Велике розширення для міста, що росте.' },
  { key: 'automaton', name: 'АВТОМАТОН', bonus: 'АВТОКЛІК 1 / С', price: 5000, icon: '⚙', description: 'Механічний працівник копає руду замість вас.' }
];

const els = {
  coalCount: document.getElementById('coalCount'),
  thermoCount: document.getElementById('thermoCount'),
  coalPerClickLabel: document.getElementById('coalPerClickLabel'),
  mineEfficiencyLabel: document.getElementById('mineEfficiencyLabel'),
  mineProgressBar: document.getElementById('mineProgressBar'),
  minersInfo: document.getElementById('minersInfo'),
  generatorStatus: document.getElementById('generatorStatus'),
  generatorToggleBtn: document.getElementById('generatorToggleBtn'),
  coalBurnLabel: document.getElementById('coalBurnLabel'),
  populationHud: document.getElementById('populationHud'),
  cityMap: document.getElementById('cityMap'),
  cityWindHud: document.getElementById('cityWindHud'),
  runTime: document.getElementById('runTime'),
  runScore: document.getElementById('runScore'),
  endRunBtn: document.getElementById('endRunBtn'),
  coalClicker: document.getElementById('coalClicker'),
  sellCoalBtn: document.getElementById('sellCoalBtn'),
  sellPercent: document.getElementById('sellPercent'),
  sellPercentValue: document.getElementById('sellPercentValue'),
  equipmentGrid: document.getElementById('equipmentGrid'),
  equipmentPrev: document.getElementById('equipmentPrev'),
  equipmentNext: document.getElementById('equipmentNext'),
  cityTemp: document.getElementById('cityTemp'),
  cityCondition: document.getElementById('cityCondition'),
  cityWind: document.getElementById('cityWind'),
  cityFeels: document.getElementById('cityFeels'),
  heroGeneratorStatus: document.getElementById('heroGeneratorStatus')
};

let state = loadState();
let scenes = [];
let navLinks = [];
let rafPending = false;
let reducedMotion = false;
let equipmentIndex = 0;
let offlineSeconds = 0;

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
      minerHireCost: parsed.minerHireCost || 25,
      mineCapacity: parsed.mineCapacity || INITIAL_MINE_CAP,
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
  const minerBoost = 1 + (state.miners / state.mineCapacity) * 0.8;
  return state.coalPerClick * (1 + itemBonus) * minerBoost;
}

function getMineEfficiencyPercent() {
  return Math.min(100, Math.round((state.miners / state.mineCapacity) * 100));
}

function getMineProgressWidth() {
  return Math.min(100, (state.miners / state.mineCapacity) * 100) + '%';
}

function getTargetMiners() {
  return Math.min(state.mineCapacity, Math.floor(state.population / 16));
}

function renderCityMap() {
  if (!els.cityMap) return;
  const population = Math.max(1, state.population);
  const mapRadius = Math.min(window.innerWidth * 0.86, 920) / 2;
  const homes = Math.min(72, 8 + Math.floor(population / 4));
  const industrial = Math.min(28, Math.max(2, Math.floor(population / 18)));
  const ringCount = Math.min(4, Math.max(1, Math.ceil(homes / 14)));
  const fragments = [];

  let remainingHomes = homes;
  for (let ring = 0; ring < ringCount; ring += 1) {
    const perRing = Math.min(18, Math.ceil(remainingHomes / (ringCount - ring)));
    const radius = 24 + ring * 14;
    for (let index = 0; index < perRing; index += 1) {
      const angle = index * (360 / perRing) + (ring % 2 ? 360 / perRing / 2 : 0);
      const distance = Math.round(mapRadius * radius / 100);
      const level = population >= 240 && ring < 2 ? 3 : population >= 150 && ring < 2 ? 2 : 1;
      fragments.push('<i class="city-building city-home level-' + level + '" style="--angle:' + angle + 'deg;--distance:' + distance + 'px"></i>');
    }
    remainingHomes -= perRing;
  }

  for (let index = 0; index < industrial; index += 1) {
    const angle = index * (360 / industrial) + 9;
    const radius = 75 + ((index * 5) % 10);
    const distance = Math.round(mapRadius * radius / 100);
    fragments.push('<i class="city-building city-industry" style="--angle:' + angle + 'deg;--distance:' + distance + 'px"></i>');
  }

  els.cityMap.innerHTML = fragments.join('');
  els.cityMap.dataset.population = population;
}

function getWeatherBurnRate() {
  const weather = window.currentWeather;
  if (!weather) return 1;
  return 1 + Math.max(0, (Math.abs(weather.temp) - 50) / 250) + Math.max(0, weather.wind - 10) / 100;
}

function formatRunTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
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
  if (!els.equipmentGrid) return;
  els.equipmentGrid.innerHTML = '';
  equipList.forEach(function (item) {
    const card = document.createElement('article');
    card.className = 'equipment-card';
    const repeatable = item.key === 'miner' || Boolean(state.mineUpgrades[item.key]);
    const count = item.key === 'miner' ? state.totalHired : item.key === 'compact' || item.key === 'reinforced' || item.key === 'industrial' ? state.mineUpgrades[item.key] : 0;
    const owned = item.key === 'porridge' ? state.porridgeOwned : item.key === 'automaton' ? state.automatonOwned : item.key in state.equipment ? state.equipment[item.key].owned : false;
    const price = item.key === 'miner' ? state.minerHireCost : repeatable ? Math.round(item.price * Math.pow(1.35, count)) : item.price;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'equipment-button';
    button.textContent = repeatable ? 'КУПИТИ' : owned ? 'КУПЛЕНО' : 'КУПИТИ';
    button.disabled = !repeatable && owned;
    button.addEventListener('click', function () { buyEquipment(item.key); });
    card.dataset.position = getEquipmentPosition(equipList.indexOf(item));
    card.innerHTML =
      '<div class="equipment-icon" aria-hidden="true"><span>' + item.icon + '</span></div>' +
      '<h4>' + item.name + '</h4>' +
      '<p class="equipment-description">' + item.description + '</p>' +
      '<div class="bonus">' + item.bonus + (repeatable && count ? ' · ' + count + '×' : '') + '</div>' +
      '<div class="price"><span>ЦІНА</span><strong>' + formatNumber(price) + '</strong></div>';
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
}

function updateHud() {
  const sellPercent = Math.min(100, Math.max(1, Number(state.sellPercent) || 100));
  if (els.sellPercent) els.sellPercent.value = String(sellPercent);
  if (els.sellPercentValue) els.sellPercentValue.textContent = sellPercent + '%';
  els.coalCount.textContent = formatNumber(state.coal);
  els.thermoCount.textContent = formatNumber(state.stamps);
  els.coalPerClickLabel.textContent = '+' + Math.max(1, Math.round(getCoalPerClick()));
  els.mineEfficiencyLabel.textContent = getMineEfficiencyPercent() + '%';
  els.mineProgressBar.style.width = getMineProgressWidth();
  els.minersInfo.textContent = state.miners + ' / ' + state.mineCapacity;
  els.generatorStatus.textContent = state.generatorOn ? 'ГЕНЕРАТОР ПРАЦЮЄ' : 'ГЕНЕРАТОР ВИМКНЕНО';
  els.generatorToggleBtn.classList.toggle('is-on', state.generatorOn);
  document.getElementById('generator').classList.toggle('generator-off', !state.generatorOn);
  if (els.heroGeneratorStatus) els.heroGeneratorStatus.textContent = state.generatorOn ? 'ГЕНЕРАТОР АКТИВНИЙ' : 'ГЕНЕРАТОР ВИМКНЕНО';
  els.generatorToggleBtn.disabled = !state.generatorOn && state.coal <= 0;
  els.coalBurnLabel.textContent = getWeatherBurnRate().toFixed(2) + ' / с';
  els.populationHud.textContent = state.population;
  renderCityMap();
  els.runTime.textContent = formatRunTime(state.runSeconds);
  els.runScore.textContent = formatNumber(state.runScore);
  els.endRunBtn.disabled = state.runSeconds === 0;
}

function mineCoal(event) {
  const perClick = getCoalPerClick();
  state.coal += perClick;
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
  const percent = Math.min(100, Math.max(0, Number(state.sellPercent) || 100));
  const coalToSell = Math.floor((state.coal * percent) / 100);
  const saleValue = Math.floor(coalToSell / SELL_RATE);
  if (saleValue <= 0) return;
  const actualCoalSold = saleValue * SELL_RATE;
  state.coal -= actualCoalSold;
  state.stamps += saleValue;
  state.totalSold += actualCoalSold;
  state.runScore += saleValue * 2;
  saveState();
  updateHud();
}

function hireMiner() {
  if (state.stamps < state.minerHireCost || state.miners >= state.mineCapacity || state.population <= state.miners) return;
  state.stamps -= state.minerHireCost;
  state.miners += 1;
  state.totalHired += 1;
  state.minerHireCost = Math.round(state.minerHireCost * 1.18);
  state.runScore += 25;
  saveState();
  updateHud();
}

function toggleGenerator() {
  if (!state.generatorOn && state.coal <= 0) return;
  state.generatorOn = !state.generatorOn;
  saveState();
  updateHud();
}

function endRun() {
  if (!state.runSeconds) return;
  const finalScore = state.runScore + state.population * 10 + state.totalSold + state.totalHired * 25;
  state.lastRun = {
    seconds: state.runSeconds,
    score: finalScore,
    population: state.population,
    miners: state.miners,
    sold: state.totalSold
  };
  state.completedRuns += 1;
  state.generatorOn = false;
  state.coal = 250;
  state.stamps = 0;
  state.miners = 0;
  state.minerHireCost = 25;
  state.mineCapacity = INITIAL_MINE_CAP;
  state.mineUpgradeCost = 150;
  state.runSeconds = 0;
  state.cityLevel = 1;
  state.population = 80;
  state.populationCap = 80;
  state.miners = 5;
  state.runScore = 0;
  state.totalSold = 0;
  state.totalHired = 0;
  saveState();
  updateHud();
  window.alert('Забіг завершено. Рахунок: ' + formatNumber(finalScore) + '. Час роботи: ' + formatRunTime(state.lastRun.seconds));
}

function gameTick() {
  if (!state.generatorOn) {
    offlineSeconds += 1;
    if (offlineSeconds % 12 === 0 && state.population > 0) {
      state.population -= 1;
      state.populationCap = Math.max(state.population, state.populationCap - 1);
      state.miners = Math.min(state.miners, state.population);
      saveState();
      updateHud();
    }
    return;
  }
  offlineSeconds = 0;
  const burn = getWeatherBurnRate();
  state.coal = Math.max(0, state.coal - burn);
  state.runSeconds += 1;
  state.runScore += 1;
  if (state.automatonOwned) state.coal += getCoalPerClick();
  if (state.miners > 0) state.coal += state.miners * 0.18;
  if (state.runSeconds % 20 === 0 && state.population < state.populationCap) {
    state.population += 1;
    const targetMiners = getTargetMiners();
    if (state.miners < targetMiners) state.miners = targetMiners;
  }
  if (state.runSeconds % 45 === 0) {
    state.cityLevel += 1;
    state.populationCap += 5;
    state.runScore += 100;
  }
  if (state.coal <= 0) state.generatorOn = false;
  saveState();
  updateHud();
}

function buyPorridge() {
  if (state.porridgeOwned || state.stamps < 150) return;
  state.stamps -= 150;
  state.porridgeOwned = true;
  state.coalPerClick += 1;
  saveState();
  renderEquipment();
  updateHud();
}

function buyEquipment(key) {
  if (key === 'miner') {
    hireMiner();
    return;
  }
  if (key === 'compact' || key === 'reinforced' || key === 'industrial') {
    const item = equipList.find(function (entry) { return entry.key === key; });
    const price = Math.round(item.price * Math.pow(1.35, state.mineUpgrades[key]));
    if (state.stamps < price) return;
    state.stamps -= price;
    state.mineUpgrades[key] += 1;
    const capacityBonus = key === 'compact' ? 5 : key === 'reinforced' ? 10 : 25;
    state.mineCapacity += capacityBonus;
    state.runScore += capacityBonus * 10;
    saveState();
    renderEquipment();
    updateHud();
    return;
  }
  if (key === 'porridge') {
    buyPorridge();
    return;
  }
  if (key === 'automaton') {
    if (state.automatonOwned || state.stamps < 5000) return;
    state.stamps -= 5000;
    state.automatonOwned = true;
    state.runScore += 500;
    saveState();
    renderEquipment();
    updateHud();
    return;
  }
  const item = state.equipment[key];
  if (!item || item.owned || state.stamps < item.price) return;
  state.stamps -= item.price;
  item.owned = true;
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
  const actionDock = document.createElement('div');
  actionDock.className = 'run-action-dock';
  const scoreDisplay = document.createElement('div');
  scoreDisplay.className = 'run-score';
  scoreDisplay.innerHTML = '<span>РАХУНОК ЗАБІГУ</span><strong id="runScore">0</strong>';
  els.runScore = scoreDisplay.querySelector('#runScore');
  const endRunButton = document.createElement('button');
  endRunButton.type = 'button';
  endRunButton.className = 'action-button ghost-button';
  endRunButton.textContent = 'ЗАВЕРШИТИ ЗАБІГ';
  endRunButton.addEventListener('click', endRun);
  els.endRunBtn = endRunButton;
  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'action-button ghost-button reset-button';
  resetButton.textContent = 'СКИНУТИ ПРОГРЕС';
  resetButton.addEventListener('click', confirmReset);
  actionDock.appendChild(scoreDisplay);
  actionDock.appendChild(endRunButton);
  actionDock.appendChild(resetButton);
  document.body.appendChild(actionDock);
}

function initCityVideo() {
  const video = document.querySelector('.city-video');
  if (!video) return;
  let direction = 1;
  let frameId = 0;

  video.removeAttribute('loop');
  video.addEventListener('ended', function () {
    direction = -1;
    video.pause();
    reverseVideo();
  });

  function reverseVideo() {
    if (direction !== -1 || video.currentTime <= 0.03) {
      video.currentTime = 0;
      direction = 1;
      video.play();
      return;
    }
    video.currentTime = Math.max(0, video.currentTime - 0.035);
    frameId = requestAnimationFrame(reverseVideo);
  }

  video.addEventListener('play', function () {
    if (direction === 1) cancelAnimationFrame(frameId);
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
    window.currentWeather = weather.city;
    var city = weather.city;
    els.cityTemp.textContent = city.temp + '°C';
    els.cityCondition.textContent = city.condition;
    els.cityWind.textContent = 'ВІТЕР: ' + city.wind + ' м/с';
    els.cityWindHud.textContent = city.wind + ' м/с';
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
  if (els.coalClicker) els.coalClicker.addEventListener('click', mineCoal);
  if (els.generatorToggleBtn) els.generatorToggleBtn.addEventListener('click', toggleGenerator);
  if (els.sellCoalBtn) els.sellCoalBtn.addEventListener('click', sellCoal);
  if (els.sellPercent) {
    els.sellPercent.addEventListener('input', function () {
      state.sellPercent = Number(els.sellPercent.value);
      saveState();
      updateHud();
    });
  }
  setupResetButton();
  if (els.equipmentPrev && els.equipmentNext) {
    els.equipmentPrev.addEventListener('click', function () { moveEquipment(-1); });
    els.equipmentNext.addEventListener('click', function () { moveEquipment(1); });
  }
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
  initCityVideo();
}

initialize();

window.addEventListener('scroll', onScrollOrResize, { passive: true });
window.addEventListener('resize', onScrollOrResize, { passive: true });

setInterval(gameTick, 1000);

window.addEventListener('beforeunload', saveState);