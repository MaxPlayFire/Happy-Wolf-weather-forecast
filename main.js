const state = {
  coal: 0,
  thermostamps: 0,
  clickPower: 1,
  autoCoal: 0,
  upgrades: {
    drill: { level: 0, cost: 25, bonus: 1 },
    lamp: { level: 0, cost: 50, bonus: 2 },
    dust: { level: 0, cost: 80, bonus: 4 }
  }
};

const els = {
  coalCount: document.getElementById('coalCount'),
  thermoCount: document.getElementById('thermoCount'),
  mineRate: document.getElementById('mineRate'),
  coalClicker: document.getElementById('coalClicker')
};

function formatNumber(value) {
  return Math.floor(value).toLocaleString('en-US');
}

function updateHud() {
  els.coalCount.textContent = formatNumber(state.coal);
  els.thermoCount.textContent = formatNumber(state.thermostamps);
  const rate = state.clickPower + state.autoCoal;
  els.mineRate.textContent = `${rate} / click`;
}

function mineCoal() {
  const mined = state.clickPower + (state.upgrades.drill.level * 0.5) + (state.upgrades.lamp.level * 1.5);
  state.coal += mined;
  state.thermostamps += Math.floor(mined / 2);
  updateHud();
}

function buyUpgrade(kind) {
  const upgrade = state.upgrades[kind];
  if (!upgrade || state.coal < upgrade.cost) return;

  state.coal -= upgrade.cost;
  upgrade.level += 1;
  upgrade.cost = Math.round(upgrade.cost * 1.7);

  if (kind === 'drill') state.clickPower += upgrade.bonus;
  if (kind === 'lamp') state.autoCoal += upgrade.bonus;
  if (kind === 'dust') state.clickPower += upgrade.bonus * 1.5;

  updateHud();
  document.querySelectorAll('.upgrade-btn').forEach((button) => {
    const key = button.dataset.upgrade;
    const current = state.upgrades[key];
    if (!current) return;
    button.innerHTML = `<span>${button.querySelector('span').textContent.split(' ')[0] === 'Steam' ? 'Steam drill' : button.querySelector('span').textContent}</span><small>cost: ${current.cost}</small>`;
  });
}

function buyShopItem(type) {
  const priceMap = {
    porridge: 15,
    boots: 35,
    gloves: 60
  };

  const price = priceMap[type];
  if (!price || state.thermostamps < price) return;

  state.thermostamps -= price;
  if (type === 'porridge') state.autoCoal += 1;
  if (type === 'boots') state.clickPower += 2;
  if (type === 'gloves') state.clickPower += 3;

  updateHud();
}

els.coalClicker.addEventListener('click', mineCoal);
document.querySelectorAll('.upgrade-btn').forEach((button) => {
  button.addEventListener('click', () => buyUpgrade(button.dataset.upgrade));
});
document.querySelectorAll('.shop-item').forEach((item) => {
  item.addEventListener('click', () => buyShopItem(item.dataset.shop));
});

setInterval(() => {
  state.coal += state.autoCoal;
  state.thermostamps += Math.max(0, Math.floor(state.autoCoal / 2));
  updateHud();
}, 1000);

updateHud();
