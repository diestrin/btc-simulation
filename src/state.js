const { ReplaySubject, BehaviorSubject } = require('rxjs');

const { transaction, log } = require('./reports');
const { feeRate, balance } = require('./config');

const initialState = {
  balance: {
    // base coin, in USDT-BTC, this is USDT
    base: balance[0],
    // target coin, in USDT-BTC, this is BTC
    target: balance[1]
  },
  fees: 0,
  baseLine: 0,
  mean: 0,
  hold: false
};

const actions = {
  hold(state) {
    return Object.assign({}, state, { hold: true });
  },
  release(state) {
    return Object.assign({}, state, { hold: false });
  },
  updateBase(state, action) {
    return Object.assign({}, state, { baseLine: action.payload });
  },
  updateMean(state, action) {
    return Object.assign({}, state, { mean: action.payload });
  },
  // action payload is the rate to trade at
  bid(state, action) {
    const tradeRate = action.payload;
    const operation = state.balance.base / tradeRate;
    const fee = operation * feeRate;
    const result = operation - fee;
    const feeInBase = fee * tradeRate;

    transaction({
      isBid: true,
      tradeRate, result, fee: feeInBase,
      balance: state.balance.target
    });

    return Object.assign({}, state, {
      fees: state.fees + fee,
      balance: { target: result, base: 0 }
    });
  },

  // action payload is the rate to trade at
  ask(state, action) {
    const tradeRate = action.payload;
    const operation = state.balance.target * tradeRate;
    const fee = operation * feeRate;
    const result = operation - fee;

    transaction({
      tradeRate, result, fee,
      balance: state.balance.target
    });

    return Object.assign({}, state, {
      fees: state.fees + fee,
      balance: { target: 0, base: result }
    });
  }
};

const dispatcher$ = new ReplaySubject();
const state$ = new BehaviorSubject(initialState);

dispatcher$
  .scan(scan, initialState)
  .subscribe(state => state$.next(state));

function dispatch(type, payload) {
  dispatcher$.next({type, payload});
}

function scan(state, action) {
  if (action.type in actions) {
    return actions[action.type](state, action);
  } else {
    return state;
  }
}

module.exports = {
  dispatch, state$,
  actions: Object
    .keys(actions)
    .reduce((obj, key) => {
      obj[key] = key;
      return obj;
    }, {})
};
