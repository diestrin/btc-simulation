#!/usr/bin/env node
const program = require('commander');
const { Observable } = require('rxjs');
const bittrex = require('node-bittrex-api');

const { summary } = require('./reports');
const { real$ } = require('./data-source/real');
const emulate = require('./emulations/percent-variance');
const { mock$, random$ } = require('./data-source/mock-random');

bittrex.options({
  apikey: process.env.BITTREX_API_KEY,
  apisecret: process.env.BITTREX_API_SECRET,
  inverse_callback_arguments: true
});

program
  .command('real')
  .description('A simulation with real time data from Bittrex')
  .action(() => emulate(real$));

program
  .command('mock')
  .description('A simulation with mocked data provided by you')
  .action(() => emulate(mock$));

program
  .command('random')
  .description('A simulation with mocked data randomly created')
  .action(() => emulate(random$));

Observable.merge(
  Observable.fromEvent(process, 'exit'),
  Observable.fromEvent(process, 'SIGINT'),
  Observable.fromEvent(process, 'uncaughtException')
)
  .first()
  .subscribe(() => {
    summary();
    process.exit(0);
  });

program.parse(process.argv);
