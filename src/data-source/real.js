const bittrex = require('node-bittrex-api');
const { Observable } = require('rxjs');

const { market } = require('../config');
const { marketUpdate } = require('../reports');

bittrex.options({
  apikey: process.env.BITTREX_API_KEY,
  apisecret: process.env.BITTREX_API_SECRET
});

/**
 * EXAMPLE VALUES FROM OPERATION
 *
 * MarketName: 'USDT-BTC'
 * High: 3980.719
 * Low: 3411
 * Volume: 19536.02636726
 * Last: 3551
 * BaseVolume: 72038566.49604551
 * TimeStamp: '2017-09-14T15:07:35.46'
 * Bid: 3542.51000001
 * Ask: 3551
 * OpenBuyOrders: 4202
 * OpenSellOrders: 3500
 * PrevDay: 3766.293
 * Created: '2015-12-11T06:31:40.633'
 */
function mineData(operation) {
  return {
    id: new Date(operation.TimeStamp).getTime(),
    bid: operation.Bid,
    ask: operation.Ask
  };
}

const socket$ = Observable
  .fromEventPattern(handler =>
    bittrex.websockets.client(() =>
      bittrex.websockets.subscribe([market], handler)));

const marketUpdates$ = socket$
  .filter(data => data.M === 'updateSummaryState')
  .concatMap(data => Observable.from(data.A))
  .concatMap(deltaFor => Observable.from(deltaFor.Deltas))
  .filter(delta => delta.MarketName === market)
  .do(marketUpdate);

const real$ = marketUpdates$
  .map(mineData)
  .distinctUntilChanged((prev, next) => prev.id === next.id);

module.exports = { socket$, real$ };
