const program = require('commander');

function list(type = String, separator = ',') {
  return val => val.split(separator).map(type);
}

const args = program
  .usage('[command] [options]')

  .option('-b, --balance <list>',
    'Number of initial coins to trade', list(Number))

  .option('-m, --market <str>',
    'Name of the market to trade')

  .option('-M, --mock <list>',
    'List of symbols to mock variations i.e.: +-+-. Used for *mock* mode', list(String, ''))

  .option('-p, --price <n>',
    'Initial target price in base coin. Ignored in *real* mode', Number)

  .option('-i, --iterations <n>',
    'Number of events to create randomly. Used for *random* mode', Number)

  .option('-c, --coin <str>',
    'Coin used to report the fees and profit', val => val.toLowercase())

  .option('-l, --logLevel <list>',
    'Comma separated list of logs to print into console. Available: all, operations, marketUpdates, debug', list(Number))

  .parse(process.argv);

module.exports = Object.assign({
  // Bittrex fee 0.25%
  feeRate: 0.0025,

  // Exchange rate 1%
  variance: 0.01,

  // Number of decimals for target coin
  targetPrecision: 6,

  // Number of decimals for base coin
  basePrecision: 0,

  logLevel: 'all'
}, args);
