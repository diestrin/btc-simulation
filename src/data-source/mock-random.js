const { Observable } = require('rxjs');

const { random } = require('../utils');
const { price, mock, variance, iterations } = require('../config');

const percentage = variance * 0.5 + 1;
let initialPrice = price;

const mock$ = Observable
  .from(mock || []);

const random$ = Observable
  .range(1, iterations || 0)
  .map(() => Math.round(Math.random()) ? '+' : '-');

function generate(source$) {
  return source$
    .map(sign => sign === '+' ?
      initialPrice *= percentage :
      initialPrice /= percentage)
    .startWith(initialPrice)
    .map(price => ({
      id: random(),
      bid: price,
      ask: price
    }));
}

module.exports = {
  mock$: generate(mock$),
  random$: generate(random$),
};
