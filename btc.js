#!/usr/bin/env node

const program = require('commander');
const bittrex = require('node-bittrex-api');
const { Observable, ReplaySubject } = require('rxjs');

const args = program
  .usage('[command] [options]')
  .option('-b, --btc <n>', 'Number of BTC to trade', Number)
  .option('-m, --market <str>', 'Name of the market to trade, for real only')
  .option('-M, --mock <list>', 'List of mock symbols to use, for mock only i.e.: +-+-', val => val.split(''))
  .option('-p, --price <n>', 'Initial BTC price, for mock and random only', Number)
  .option('-i, --iterations <n>', 'Number of events to randomly create, for random only', Number)
  .parse(process.argv);
  
program
  .command('real')
  .description('A simulation with real time data from Bittrex')
  .action(_ => emulate(getRealData()));
  
program
  .command('mock')
  .description('A simulation with mocked data provided by you')
  .action(_ => emulate(getMockedData()));

program
  .command('random')
  .description('A simulation with mocked data randomly created')
  .action(_ => emulate(getRandomData()));

// Bittrex fee 0.25%
const feeRate = 0.0025;
// Exchange rate 1%
const variance = 0.01;
// Precission to round the target values
const targetPrecision = 0;
// Number of decimals for btc amounts (reports only, calcs are made with the whole number)
const btcPrecision = 6;

// State variables
let btcBalance = args.btc;
let targetBalance = 0;
let fees = 0 ;
let hold = false;

function emulate(obs$) {
  obs$
    .do(delta => console.log('Bid', delta.bid, 'Ask', delta.ask))
    // scan is like reduce, but real time
    // The base param is the amount to compare agains the variance variable
    // The delta param is the new incomming value to compare against base
    .scan((base, delta) => {
      // If this is the first time, there will be no base
      // so we just return the given value to make it the new base
      if (!base) {
        return mean(delta.ask, delta.bid, targetPrecision);
      }
  
      // If the new Ask is greater than the base + variance...
      if (delta.ask > base * (variance + 1)) {
        console.log(`Increased ${variance * 100}% from`, base, 'to', delta.ask);
  
        // If we have some btc to trade and we're not holding
        // sell them and make this value the new base
        if (btcBalance && !hold) {
          ask(delta.ask);
          return delta.ask;
        } else if (!hold) {
          // If we no longer have btc and the price goes up for a second time
          // buy back and hold
          bid(delta.bid);
          hold = true;
        } else {
          console.log('Holding...');
        }
      }
  
      // If the new Bid is lower than the base - variance...
      if (delta.bid < base / (variance + 1)) {
        console.log(`Decreased ${variance * 100}% from`, base, 'to', delta.bid);
  
        // Stop the hold on the first decrease
        hold = false;
  
        // If we have any target to trade sell them and make this value the new base
        if (targetBalance) {
          bid(delta.bid);
          return delta.bid;
        } else {
          console.log('Holding...');
        }
      }
  
      // Always return the base if nothing happened
      return base;
    }, false)
    .distinctUntilChanged()
    .subscribe(mean => console.log('New mean base', mean));
}

function ask(amount) {
  const operation = btcBalance * amount;
  const fee = operation * feeRate / amount;

  targetBalance = operation - fee;
  fees += fee;
  
  console.log('\n--------');
  console.log('Trading', round(btcBalance, btcPrecision),
    'btc asking', round(amount, targetPrecision));
  console.log('Got', round(targetBalance, targetPrecision), 'paying a fee of',
    round(fee, btcPrecision), 'btc');
  report(amount);
  console.log('--------\n');
  
  btcBalance = 0;
}

function bid(amount) {
  const operation = targetBalance / amount;
  const fee = operation * feeRate;
  
  btcBalance = operation - fee;
  fees += fee;
  
  console.log('\n--------');
  console.log('Trading', round(targetBalance, targetPrecision),
    'bidding', round(amount, targetPrecision));
  console.log('Got', round(btcBalance, btcPrecision), 'btc paying a fee of',
    round(fee, btcPrecision), 'btc');
  report(amount);
  console.log('--------\n');
  
  targetBalance = 0;
}

function report(amount, final) {
  final && console.log('\n---------- Final Report ----------');

  const totalFees = round(fees, btcPrecision);
  const profit = round(btcBalance - args.btc, btcPrecision);
  console.log('Total fees paid', totalFees);
  console.log('Total Profit', profit);

  final && process.exit();
}

function round(amount, precision) {
  const factor = Math.pow(10, precision);
  return Math.round(amount * factor) / factor;
}

function mean(a, b, precision) {
  return round((a + b) / 2, precision);
}

function getRealData() {
  bittrex.options({
    apikey: process.env.BITTREX_API_KEY,
    apisecret: process.env.BITTREX_API_SECRET
  });
  
  return Observable
    // Convert event to observable
    .fromEventPattern(handler =>
      bittrex.websockets.client(() =>
        bittrex.websockets.subscribe([args.market], handler)))
    .filter(data => data.M === 'updateSummaryState')
    .concatMap(data => Observable.from(data.A))
    .concatMap(deltaFor => Observable.from(deltaFor.Deltas))
    // Filter updates for the target market only
    .filter(delta => delta.MarketName === args.market)
    .map(delta => ({
      bid: round(delta.Bid, targetPrecision),
      ask: round(delta.Ask, targetPrecision)
    }))
    .distinctUntilChanged((prev, next) =>
      prev.bid === next.bid && prev.ask === next.ask);
}

function getMockedData(mock = args.mock) {
  const percentage = variance * 1.5 + 1;
  let initialBtcPrice = args.price;

  return Observable
    .from(mock)
    .map(sign => sign === '+' ?
      initialBtcPrice *= percentage :
      initialBtcPrice /= percentage)
    .startWith(initialBtcPrice)
    .map(price => ({bid: price, ask: price}));
}

function getRandomData() {
  const scenarios = '+'
    .repeat(args.iterations)
    .split('')
    .map(() => Math.round(Math.random()) ? '+' : '-');

  return getMockedData(scenarios);
}

process.on('exit', report.bind(null, 0, true));
process.on('SIGINT', report.bind(null, 0, true));
process.on('uncaughtException', report.bind(null, 0, true));

program.parse(process.argv);
