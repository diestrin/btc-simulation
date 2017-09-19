const { mean } = require('../utils');
const { marketVariation, hold } = require('../reports');
const { variance, basePrecision } = require('../config');
const { state$, dispatch, actions } = require('../state');

function assertVariation(base, actual, variation) {
  if (variation > 0) {
    return actual >= base * (variance + 1);
  }

  if (variation < 0) {
    return actual <= base / Math.abs(variance + 1);
  }

  return false;
}

module.exports = function emulate(obs$) {
  obs$
    .do(data => dispatch(actions.updateMean, mean(data.bid, data.ask, basePrecision)))
    // scan is like reduce, but real time
    // The base param is the amount to compare agains the variance variable
    // The delta param is the new incomming value to compare against base
    .scan((base, operation) => {
      const { ask, bid } = operation;

      // If this is the first time, there will be no base
      // so we just return the given value to make it the new base
      if (!base) {
        return mean(ask, bid, basePrecision);
      }

      // Get the current state value
      const state = state$.getValue();

      // If the new Ask is greater than the base + variance...
      if (assertVariation(base, ask, variance)) {
        marketVariation(base, ask);

        // If we have some btc to trade and we're not holding
        // sell them and make this value the new base
        if (state.balance.target && !state.hold) {
          dispatch(actions.ask, ask);
        } else if (!state.hold) {
          // If we no longer have btc and the price goes up for a second time
          // buy back and hold
          dispatch(actions.bid, bid);
          dispatch(actions.hold);
        }

        return ask;
      }

      // If the new Bid is lower than the base - variance...
      if (assertVariation(base, bid, -variance)) {
        marketVariation(base, bid);

        // Stop the hold on the first decrease
        if (state.hold) {
          dispatch(actions.release);
        }

        // If we have any target to trade sell them and make this value the new base
        if (state.balance.base) {
          dispatch(actions.bid, bid);
          return bid;
        }
      }

      // Always return the base if nothing happened
      return base;
    }, false)
    .distinctUntilChanged()
    .subscribe(mean => dispatch(actions.updateBase, mean));
}
