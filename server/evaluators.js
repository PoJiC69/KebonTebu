// server/evaluators.js - poker/qiuqiu/samgong evaluators (unit-testable)
const rankOrder = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

function parseCard(card) {
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  return { rank, suit, value: rankOrder[rank] };
}

function evaluatePokerHand(hand) {
  const parsed = hand.map(parseCard);
  const values = parsed.map(p => p.value).sort((a,b)=>a-b);
  const suits = parsed.map(p => p.suit);
  const counts = {};
  for (const v of values) counts[v] = (counts[v] || 0) + 1;
  const entries = Object.entries(counts).map(([v,c]) => ({ v: parseInt(v), c }))
    .sort((a,b) => {
      if (b.c !== a.c) return b.c - a.c;
      return b.v - a.v;
    });
  const isFlush = new Set(suits).size === 1;
  let isStraight = false;
  let highStraight = Math.max(...values);
  let normal = true;
  for (let i=0;i<4;i++){
    if (values[i+1] !== values[i]+1) { normal = false; break; }
  }
  let wheel = false;
  if (!normal) {
    const s = values;
    if (s[0] === 2 && s[1] === 3 && s[2] === 4 && s[3] === 5 && s[4] === 14) {
      wheel = true;
      highStraight = 5;
    }
  }
  isStraight = normal || wheel;

  if (isStraight && isFlush) {
    return { rank: 8, tiebreakers: [highStraight], label: 'Straight Flush' };
  }
  if (entries[0].c === 4) {
    const quad = entries[0].v;
    const kicker = entries.find(e=>e.c===1).v;
    return { rank: 7, tiebreakers: [quad, kicker], label: 'Four of a Kind' };
  }
  if (entries[0].c === 3 && entries.length > 1 && entries[1].c === 2) {
    return { rank: 6, tiebreakers: [entries[0].v, entries[1].v], label: 'Full House' };
  }
  if (isFlush) {
    const sortedDesc = values.slice().sort((a,b)=>b-a);
    return { rank: 5, tiebreakers: sortedDesc, label: 'Flush' };
  }
  if (isStraight) {
    return { rank: 4, tiebreakers: [highStraight], label: 'Straight' };
  }
  if (entries[0].c === 3) {
    const trio = entries[0].v;
    const kickers = entries.filter(e=>e.c===1).map(e=>e.v).sort((a,b)=>b-a);
    return { rank: 3, tiebreakers: [trio, ...kickers], label: 'Three of a Kind' };
  }
  if (entries[0].c === 2 && entries.length > 1 && entries[1].c === 2) {
    const pairs = entries.filter(e=>e.c===2).map(e=>e.v).sort((a,b)=>b-a);
    const kicker = entries.find(e=>e.c===1).v;
    return { rank: 2, tiebreakers: [...pairs, kicker], label: 'Two Pair' };
  }
  if (entries[0].c === 2) {
    const pair = entries[0].v;
    const kickers = entries.filter(e=>e.c===1).map(e=>e.v).sort((a,b)=>b-a);
    return { rank: 1, tiebreakers: [pair, ...kickers], label: 'Pair' };
  }
  const sortedDesc = values.slice().sort((a,b)=>b-a);
  return { rank: 0, tiebreakers: sortedDesc, label: 'High Card' };
}

// QiuQiu helpers
function rankIndex(card) {
  const rank = card.slice(0, -1);
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  return ranks.indexOf(rank);
}
function valueForNiu(card) {
  const idx = rankIndex(card);
  if (idx === 0) return 1;
  if (idx >= 10) return 10;
  return idx + 1;
}
function evaluateQiuQiuHand(hand) {
  const ranks = hand.map(rankIndex);
  const values = hand.map(valueForNiu);
  const isTriple = (ranks[0] === ranks[1] && ranks[1] === ranks[2]);
  if (isTriple) {
    return { rank: 4, label: 'Triple', tiebreakers: [ranks[0]] };
  }
  const allFace = ranks.every(r => r >= 10);
  if (allFace) {
    const sorted = ranks.slice().sort((a,b)=>b-a);
    return { rank: 3, label: 'Three-face', tiebreakers: sorted };
  }
  const sum = values.reduce((a,b)=>a+b, 0);
  const score = sum % 10;
  if (score === 0) {
    const sorted = ranks.slice().sort((a,b)=>b-a);
    return { rank: 2, label: 'Qiu Qiu (0)', tiebreakers: sorted };
  }
  const sorted = ranks.slice().sort((a,b)=>b-a);
  return { rank: 1, label: `Score: ${score}`, tiebreakers: [score, ...sorted] };
}
function compareNiuEval(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const n = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i=0;i<n;i++){
    const av = a.tiebreakers[i] || 0;
    const bv = b.tiebreakers[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

// Samgong helpers
function valueForSamgongRank(card) {
  const idx = rankIndex(card);
  return (idx === 0) ? 1 : (idx + 1);
}
function evaluateSamgongHand(hand) {
  const ranks = hand.map(rankIndex);
  if (ranks[0] === ranks[1] && ranks[1] === ranks[2]) {
    return { rank: 4, label: 'Samgong (Triple)', tiebreakers: [ranks[0]] };
  }
  const allFace = ranks.every(r => r >= 10);
  if (allFace) {
    const sorted = ranks.slice().sort((a,b)=>b-a);
    return { rank: 3, label: 'Samgong (Face)', tiebreakers: sorted };
  }
  const vals = hand.map(valueForSamgongRank);
  const sum = vals.reduce((a,b)=>a+b, 0);
  const score = sum % 10;
  const sorted = ranks.slice().sort((a,b)=>b-a);
  return { rank: 1, label: `Score: ${score}`, tiebreakers: [score, ...sorted] };
}
function compareSamgongEval(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const n = Math.max(a.tiebreakers.length, b.tiebreakers.length);
  for (let i=0;i<n;i++){
    const av = a.tiebreakers[i] || 0;
    const bv = b.tiebreakers[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

module.exports = {
  parseCard,
  evaluatePokerHand,
  compareEval: (a,b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    const n = Math.max(a.tiebreakers.length, b.tiebreakers.length);
    for (let i=0;i<n;i++){
      const av = a.tiebreakers[i] || 0;
      const bv = b.tiebreakers[i] || 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  },
  evaluateQiuQiuHand,
  compareNiuEval,
  evaluateSamgongHand,
  compareSamgongEval,
  rankIndex,
  valueForNiu,
  valueForSamgongRank
};