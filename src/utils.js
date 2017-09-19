const { coin, market } = require('./config');

function round(amount, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(amount * factor) / factor;
}

function mean(a, b, precision) {
  return round((a + b) / 2, precision);
}

function random(precision = 0) {
  return round((Math.random() + Math.random() * 10) * (Math.random() * 3000), precision);
}

function pickCoin(base, target) {
  const preferBase = market.toLowerCase().startsWith(coin);

  if (preferBase) {
    return base;
  }

  return target;
}

module.exports = { round, mean, pickCoin, random };
