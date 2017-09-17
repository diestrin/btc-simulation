const { Observable } = require('rxjs');
const bittrex = require('node-bittrex-api');

const { market } = require('../config');

const getCandles$ = Observable.bindNodeCallback(bittrex.getcandles);

/**
 * Response Example
 *
 * O: 4526
 * H: 4549.999
 * L: 4501.689
 * C: 4510.9
 * V: 15.3127141
 * T: '2017-09-06T20:59:00'
 * BV: 69092.27651651
 */
getCandles$({ marketName: market, tickInterval: 'oneMin' })
  .map(data => data.result)
  .map(result => result
    .map(data => ({
      high: data.H,
      low: data.L,
      volumen: data.V,
      baseVolumen: data.BV,
      timestamp: data.T,
      close: data.C,
      open: data.O
    }))
    .map(({open, close}) => ({_: open < close ? '▲' : '▼', open, close}))
  )
  .subscribe(data => console.log(data));
