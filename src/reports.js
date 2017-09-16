const { join } = require('path');
const { Observable } = require('rxjs');
const { open, writeFile, readFile, ftruncate } = require('fs');

const { round, pickCoin } = require('./utils');
const { logLevel, market, targetPrecision, basePrecision, balance } = require('./config');

const open$ = Observable.bindNodeCallback(open);
const readFile$ = Observable.bindNodeCallback(readFile);
const writeFile$ = Observable.bindNodeCallback(writeFile);
const ftruncate$ = Observable.bindNodeCallback(ftruncate);

const files = {
  marketUpdates: open$(join(__dirname,
    `../reports/market-updates.${Date.now()}.json`), 'w+').toPromise()
};

const logLevels = {
  all: [1, 2],
  operations: 1,
  marketUpdates: 2,
  debug: 3
};

function log(level, ...msg) {
  const _logLevel = [].concat(logLevels[logLevel] || logLevels.all);

  if (_logLevel.includes(level)) {
    console.log(`[${Date.now()}]`, ...msg);
  }
}

function marketUpdate(data) {
  files.marketUpdates.then(fd => combineFileContents(fd, content => [...content, data]));

  log(logLevels.marketUpdates,
    'Bid', round(data.Bid, basePrecision),
    'Ask', round(data.Ask, basePrecision));
}

function marketVariation(base, actual) {
  const variation = (actual - base) / base * 100;

  log(logLevels.marketUpdates,
    variation > 0 ? 'Increased' : 'Decreased',
    `${round(variation, 2)}%`, 'from', $`>${base}`, 'to', $`>${actual}`);
}

function transaction({isBid, balance, tradeRate, result, fee}) {
  log(logLevels.operations);
  log(logLevels.operations, '-----------');

  if (isBid) {
    log(logLevels.operations,
      'Trading', $`<${round(balance, basePrecision)}`,
      'Bidding', $`>${round(tradeRate, basePrecision)}`);
  } else {
    log(logLevels.operations,
      'Trading', $`<${round(balance, targetPrecision)}`,
      'Asking', $`>${round(tradeRate, basePrecision)}`);
  }

  log(logLevels.operations,
    'Got', isBid ?
      $`<${round(result, targetPrecision)}` :
      $`>${round(result, basePrecision)}`,
    'paying a fee of', pickCoin(
      $`>${round(fee, basePrecision)}`,
      $`<${round(fee / tradeRate, targetPrecision)}`));

  log(logLevels.operations, '-----------');
}

function summary() {
  const state = state$.getValue();
  const [initialBaseBalance, initialTargetBalance] = balance;

  const totalFees = pickCoin(
    $`>${round(state.fees, basePrecision)}`,
    $`<${round(state.fees / state.mean, targetPrecision)}`);

  const baseProfit = round(state.balance.base - initialBaseBalance, basePrecision);
  const targetProfit = round(state.balance.target - initialTargetBalance, targetPrecision);

  log(logLevels.operations, '===========');

  log(logLevels.operations, 'Total fees paid', totalFees);
  log(logLevels.operations, 'Total Base Profit', $`>${baseProfit}`);
  log(logLevels.operations, 'Total Target Profit', $`<${targetProfit}`);

  log(logLevels.operations, '===========');
  log(logLevels.operations);
}

function combineFileContents(fd, combiner) {
  return readFile$(fd, 'utf8')
    .concatMap(content => ftruncate$(fd).mapTo(content))
    .map(content => JSON.parse(content))
    .catch(() => Observable.of([]))
    .map(combiner)
    .concatMap(data => writeFile$(fd, JSON.stringify(data)))
    .toPromise();
}

function $([coin], value) {
  const [base, target] = market.toLowerCase().split('-');

  if (coin === '>') {
    return round(value, basePrecision) + ' ' + base;
  }

  if (coin === '<') {
    return round(value, targetPrecision) + ' ' + target;
  }

  return value;
}

module.exports = {
  log, logLevels, marketUpdate, marketVariation, transaction, summary
};

const { state$ } = require('./state');

state$
  .map(state => state.hold)
  .distinctUntilChanged()
  .skip(1)
  .subscribe(val => val ?
    log(logLevels.operations, 'Holding from this point') :
    log(logLevels.operations, 'Releasing, back to work'));

state$
  .map(state => state.baseLine)
  .distinctUntilChanged()
  .skip(1)
  .subscribe(val =>
    log(logLevels.operations, 'Base operation line updated to', $`>${val}`));

state$
  .map(state => state.fees)
  .distinctUntilChanged()
  .skip(1)
  .subscribe(summary)
