const { Observable, ReplaySubject } = require('rxjs');
const bittrex = require('node.bittrex.api');

// Bittrex fee 0.25%
const feeRate = 0.0025;
// Exchange rate 1%
const variance = 0.01;
// Initial amount of BTC
const btcToUse = parseFloat(process.argv[2]);
// Target Market
const market = process.argv[3];

bittrex.options({
  apikey: process.env.BITTREX_API_KEY,
  apisecret: process.env.BITTREX_API_SECRET,
  verbose: true
});

const updates$ = Observable
  //*
  .empty();
  /*/
  // Convert event to observable
  .fromEventPattern(handler =>
    bittrex.websockets.client(() =>
      bittrex.websockets.subscribe([market], handler)))
  .filter(data => data.M === 'updateSummaryState')
  .concatMap(data => Observable.from(data.A))
  .concatMap(deltaFor => Observable.from(deltaFor.Deltas))
  // Filter updates for the target market only
  .filter(delta => delta.MarketName === market)
  .distinctUntilChanged((prev, next) =>
    prev.Bid === next.Bid && prev.Ask === next.Ask)
  .do(delta => console.log('Bid', delta.Bid, 'Ask', delta.Ask));
  //*/

// State variables
let btcBalance = btcToUse;
let targetBalance = 0;
let fees = 0 ;
let hold = false;

updates$
  // scan is like reduce, but real time
  // The base param is the amount to compare agains the variance variable
  // The delta param is the new incomming value to compare against base
  .scan((base, delta) => {
    // If this is the first time, there will be no base
    // so we just return the given value to make it the new base
    if (!base) {
      return delta;
    }

    // If the new Ask is greater than the base + variance...
    if (delta.Ask > base.Bid * (variance + 1)) {
      console.log(`Increased ${variance * 100}% from`, base.Bid, 'to', delta.Ask);

      // If we have some btc to trade and we're not holding
      // sell them and make this value the new base
      if (btcBalance && !hold) {
        ask(delta.Ask);
        return delta;
      } else {
        // If we no longer have btc and the price goes up for a second time
        // buy back and hold
        bid(delta.Bid);
        hold = true;
      }
    }

    // If the new Bid is lower than the base - variance...
    if (delta.Bid < base.Ask / (variance + 1)) {
      console.log(`Decreased ${variance * 100}% from`, base.Ask, 'to', delta.Bid);

      // Stop the hold on the first decrease
      hold = false;

      // If we have any target to trade sell them and make this value the new base
      if (targetBalance) {
        bid(delta.Bid);
        return delta;
      }
    }

    // Always return the base if nothing happened
    return base;
  }, false)
  .distinctUntilChanged((prev, next) => prev.TimeStamp === next.TimeStamp)
  .subscribe(delta =>
    console.log('New mean base', Math.round((delta.Bid + delta.Ask) / 2)));

function ask(amount) {
  const operation = btcBalance / amount;
  const fee = operation / feeRate;

  targetBalance = operation - fee;
  
  console.log('Trading', btcBalance, 'btc asking', amount);
  console.log('Got', targetBalance, 'paying a fee of', fee);
  
  fees += fee;
  btcBalance = 0;
}

function bid(amount) {
  const operation = targetBalance / amount;
  const fee = operation / feeRate;
  
  btcBalance = operation - fee;
  
  console.log('Trading', targetBalance, 'bidding', amount);
  console.log('Got', btcBalance, 'btc paying a fee of', fee);

  fees += fee;
  targetBalance = 0;
}
