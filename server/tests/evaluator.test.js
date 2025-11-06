// server/tests/evaluator.test.js
const evals = require('../evaluators');
const utils = require('../utils');

test('poker: four of a kind beats full house', () => {
  const handQuad = ['K♠','K♥','K♦','K♣','2♠'];
  const handFH = ['Q♠','Q♥','Q♦','3♠','3♥'];
  const a = evals.evaluatePokerHand(handQuad);
  const b = evals.evaluatePokerHand(handFH);
  expect(a.rank).toBeGreaterThan(b.rank);
});

test('qiuqiu: triple highest over qiuqiu', () => {
  const triple = ['5♠','5♥','5♦'];
  const qiuqiu = ['A♠','9♥','K♦']; // 1 + 9 + 10 = 20 -> score 0
  const a = evals.evaluateQiuQiuHand(triple);
  const b = evals.evaluateQiuQiuHand(qiuqiu);
  expect(a.rank).toBeGreaterThan(b.rank);
});

test('samgong: face beats score', () => {
  const face = ['J♠','Q♥','K♦'];
  const score = ['A♠','2♥','3♦'];
  const a = evals.evaluateSamgongHand(face);
  const b = evals.evaluateSamgongHand(score);
  expect(a.rank).toBeGreaterThan(b.rank);
});

test('shuffleWithSeed is deterministic', () => {
  const suits = ['♠','♥','♦','♣'];
  const ranks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
  const deck = [];
  for (const s of suits) for (const r of ranks) deck.push(r + s);

  const seed = 'deadbeef0123456789abcdef';
  const s1 = utils.shuffleWithSeed(deck, seed);
  const s2 = utils.shuffleWithSeed(deck, seed);
  expect(s1).toEqual(s2);
});

test('evaluatePokerHand tie-breaker by high card', () => {
  // two high-card hands where top ranks differ
  const h1 = ['A♠','K♣','8♦','7♥','6♠']; // top A
  const h2 = ['K♠','Q♣','J♦','10♥','9♠']; // top K
  const e1 = evals.evaluatePokerHand(h1);
  const e2 = evals.evaluatePokerHand(h2);
  expect(e1.rank).toEqual(e2.rank);
  // e1 tiebreakers should be > e2
  const cmp = evals.compareEval(e1, e2);
  expect(cmp).toBeGreaterThan(0);
});