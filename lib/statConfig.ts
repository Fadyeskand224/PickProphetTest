import { StatConfig, Sport } from '@/types';

// Soccer stat tabs (SofaScore keys)
export const SOCCER_STAT_TABS: Record<string, StatConfig> = {
  shooting: {
    label: 'Shooting',
    primaryStat: 'totalShots',
    primaryLabel: 'Total Shots',
    avgStats: [
      { key: 'totalShots', label: 'Total Shots' },
      { key: 'onTargetScoringAttempt', label: 'On Target' },
      { key: 'shotOffTarget', label: 'Off Target' },
      { key: 'expectedGoals', label: 'xG' },
    ],
    tableStats: [
      { key: 'totalShots', label: 'Shots' },
      { key: 'onTargetScoringAttempt', label: 'On Target' },
      { key: 'shotOffTarget', label: 'Off Target' },
      { key: 'blockedScoringAttempt', label: 'Blocked' },
      { key: 'expectedGoals', label: 'xG', dec: 2 },
    ],
  },
  passing: {
    label: 'Passing',
    primaryStat: 'totalPass',
    primaryLabel: 'Passes',
    avgStats: [
      { key: 'totalPass', label: 'Passes' },
      { key: 'accuratePass', label: 'Accurate' },
      { key: 'keyPass', label: 'Key Passes' },
      { key: 'goalAssist', label: 'Assists' },
    ],
    tableStats: [
      { key: 'totalPass', label: 'Passes' },
      { key: 'accuratePass', label: 'Accurate' },
      { key: 'keyPass', label: 'Key Pass' },
      { key: 'goalAssist', label: 'Assist' },
      { key: 'totalCross', label: 'Crosses' },
      { key: 'expectedAssists', label: 'xA', dec: 2 },
    ],
  },
  dribbling: {
    label: 'Dribbling & Duels',
    primaryStat: 'wonContest',
    primaryLabel: 'Dribbles Won',
    avgStats: [
      { key: 'wonContest', label: 'Dribbles Won' },
      { key: 'totalContest', label: 'Dribbles Att.' },
      { key: 'duelWon', label: 'Duels Won' },
      { key: 'aerialWon', label: 'Aerial Won' },
    ],
    tableStats: [
      { key: 'wonContest', label: 'Drib. Won' },
      { key: 'totalContest', label: 'Drib. Att.' },
      { key: 'duelWon', label: 'Duel Won' },
      { key: 'duelLost', label: 'Duel Lost' },
      { key: 'aerialWon', label: 'Aerial Won' },
    ],
  },
  defensive: {
    label: 'Defensive',
    primaryStat: 'ballRecovery',
    primaryLabel: 'Ball Recoveries',
    avgStats: [
      { key: 'ballRecovery', label: 'Ball Rec.' },
      { key: 'totalTackle', label: 'Tackles' },
      { key: 'interceptionWon', label: 'Interceptions' },
      { key: 'wonTackle', label: 'Tackles Won' },
    ],
    tableStats: [
      { key: 'totalTackle', label: 'Tackles' },
      { key: 'wonTackle', label: 'Won Tackle' },
      { key: 'interceptionWon', label: 'Interceptions' },
      { key: 'ballRecovery', label: 'Ball Rec.' },
    ],
  },
  discipline: {
    label: 'Discipline',
    primaryStat: 'minutesPlayed',
    primaryLabel: 'Minutes',
    avgStats: [
      { key: 'minutesPlayed', label: 'Minutes' },
      { key: 'wasFouled', label: 'Fouled' },
      { key: 'fouls', label: 'Fouls Comm.' },
      { key: 'yellowCard', label: 'Yellow Cards' },
    ],
    tableStats: [
      { key: 'minutesPlayed', label: 'Mins' },
      { key: 'wasFouled', label: 'Fouled' },
      { key: 'fouls', label: 'Fouls' },
      { key: 'totalOffside', label: 'Offside' },
      { key: 'yellowCard', label: 'Yellow' },
    ],
  },
};

// NBA stat tabs (BallDontLie keys)
export const NBA_STAT_TABS: Record<string, StatConfig> = {
  scoring: {
    label: 'Scoring',
    primaryStat: 'pts',
    primaryLabel: 'Points',
    avgStats: [
      { key: 'pts', label: 'Points' },
      { key: 'fg3m', label: '3-Pointers' },
      { key: 'fg_pct', label: 'FG%' },
      { key: 'ft_pct', label: 'FT%' },
    ],
    tableStats: [
      { key: 'pts', label: 'PTS' },
      { key: 'fg3m', label: '3PM' },
      { key: 'fgm', label: 'FGM' },
      { key: 'fga', label: 'FGA' },
      { key: 'fg_pct', label: 'FG%', dec: 3 },
    ],
  },
  rebounding: {
    label: 'Rebounding',
    primaryStat: 'reb',
    primaryLabel: 'Rebounds',
    avgStats: [
      { key: 'reb', label: 'Rebounds' },
      { key: 'dreb', label: 'Defensive' },
      { key: 'oreb', label: 'Offensive' },
      { key: 'blk', label: 'Blocks' },
    ],
    tableStats: [
      { key: 'reb', label: 'REB' },
      { key: 'dreb', label: 'DREB' },
      { key: 'oreb', label: 'OREB' },
      { key: 'blk', label: 'BLK' },
    ],
  },
  playmaking: {
    label: 'Playmaking',
    primaryStat: 'ast',
    primaryLabel: 'Assists',
    avgStats: [
      { key: 'ast', label: 'Assists' },
      { key: 'stl', label: 'Steals' },
      { key: 'turnover', label: 'Turnovers' },
      { key: 'min', label: 'Minutes' },
    ],
    tableStats: [
      { key: 'ast', label: 'AST' },
      { key: 'stl', label: 'STL' },
      { key: 'turnover', label: 'TO' },
      { key: 'min', label: 'MIN' },
    ],
  },
};

// NFL stat tabs
export const NFL_STAT_TABS: Record<string, StatConfig> = {
  passing: {
    label: 'Passing',
    primaryStat: 'passingYards',
    primaryLabel: 'Pass Yards',
    avgStats: [
      { key: 'passingYards', label: 'Pass Yards' },
      { key: 'passingTouchdowns', label: 'Pass TDs' },
      { key: 'completions', label: 'Completions' },
      { key: 'interceptions', label: 'Interceptions' },
    ],
    tableStats: [
      { key: 'passingYards', label: 'Pass Yds' },
      { key: 'passingTouchdowns', label: 'Pass TDs' },
      { key: 'completions', label: 'CMP' },
      { key: 'attempts', label: 'ATT' },
      { key: 'interceptions', label: 'INT' },
    ],
  },
  rushing: {
    label: 'Rushing',
    primaryStat: 'rushingYards',
    primaryLabel: 'Rush Yards',
    avgStats: [
      { key: 'rushingYards', label: 'Rush Yards' },
      { key: 'rushingTouchdowns', label: 'Rush TDs' },
      { key: 'carries', label: 'Carries' },
      { key: 'rushingYardsPerCarry', label: 'YPC', dec: 2 },
    ],
    tableStats: [
      { key: 'rushingYards', label: 'Rush Yds' },
      { key: 'rushingTouchdowns', label: 'Rush TDs' },
      { key: 'carries', label: 'CAR' },
    ],
  },
  receiving: {
    label: 'Receiving',
    primaryStat: 'receivingYards',
    primaryLabel: 'Rec Yards',
    avgStats: [
      { key: 'receivingYards', label: 'Rec Yards' },
      { key: 'receptions', label: 'Receptions' },
      { key: 'receivingTouchdowns', label: 'Rec TDs' },
      { key: 'targets', label: 'Targets' },
    ],
    tableStats: [
      { key: 'receivingYards', label: 'Rec Yds' },
      { key: 'receptions', label: 'REC' },
      { key: 'targets', label: 'TGT' },
      { key: 'receivingTouchdowns', label: 'Rec TDs' },
    ],
  },
};

export function getStatTabs(sport: Sport): Record<string, StatConfig> {
  switch (sport) {
    case 'NBA': return NBA_STAT_TABS;
    case 'NFL': return NFL_STAT_TABS;
    default: return SOCCER_STAT_TABS;
  }
}

export function getDefaultStatTab(sport: Sport): string {
  switch (sport) {
    case 'NBA': return 'scoring';
    case 'NFL': return 'passing';
    default: return 'shooting';
  }
}

// Soccer prop types for dropdowns
export const SOCCER_PROPS = [
  { group: '⚽ Scoring', options: ['Anytime Goal Scorer','First Goal Scorer','Goals Scored','To Score or Assist','Goal Involvements','Hat Trick'] },
  { group: '🎯 Shots', options: ['Shots on Target','Total Shots','Blocked Shots'] },
  { group: '🎁 Assists & Chances', options: ['Assists','Key Passes','Chances Created','Big Chances Created'] },
  { group: '⚙️ Passing', options: ['Passes Attempted','Passes Completed','Pass Completion %','Crosses Attempted','Crosses Completed','Progressive Passes'] },
  { group: '🛡️ Defensive', options: ['Tackles','Tackles Won','Interceptions','Clearances','Blocks','Ball Recoveries','Saves','Goals Conceded','Clean Sheet'] },
  { group: '🏃 Dribbles & Duels', options: ['Dribbles Attempted','Dribbles Completed','Duels Won','Aerial Duels Won','Ground Duels Won','Ball Carries'] },
  { group: '⚠️ Discipline', options: ['Fouls Committed','Fouls Drawn','Yellow Card','Red Card'] },
  { group: '⏱️ Other', options: ['Minutes Played','Touches','Offsides','Expected Goals','Expected Assists'] },
];

export const NBA_PROPS = [
  { group: '🏀 Scoring', options: ['Points','3-Pointers Made','Free Throws Made'] },
  { group: '📋 Playmaking', options: ['Assists','Steals','Turnovers'] },
  { group: '💪 Rebounding', options: ['Rebounds','Offensive Rebounds','Defensive Rebounds','Blocks'] },
  { group: '📊 Combos', options: ['Points + Rebounds','Points + Assists','Points + Rebounds + Assists','Rebounds + Assists'] },
  { group: '⏱️ Other', options: ['Minutes Played','Fantasy Points'] },
];

export const NFL_PROPS = [
  { group: '🏈 Passing', options: ['Passing Yards','Passing TDs','Completions','Attempts','Interceptions'] },
  { group: '🏃 Rushing', options: ['Rushing Yards','Rushing TDs','Carries'] },
  { group: '🙌 Receiving', options: ['Receiving Yards','Receptions','Receiving TDs','Targets'] },
  { group: '🛡️ Defense', options: ['Tackles','Sacks','Interceptions (DEF)'] },
  { group: '⏱️ Other', options: ['Kicking Points','Fantasy Points'] },
];

export function getPropsForSport(sport: Sport) {
  switch (sport) {
    case 'NBA': return NBA_PROPS;
    case 'NFL': return NFL_PROPS;
    default: return SOCCER_PROPS;
  }
}

export const SOCCER_LEAGUES = [
  'Premier League','La Liga','Bundesliga','Serie A','Ligue 1',
  'Champions League','Europa League','MLS','World Cup','International',
];

export const NBA_LEAGUES = ['NBA'];
export const NFL_LEAGUES = ['NFL'];

export function getLeaguesForSport(sport: Sport) {
  switch (sport) {
    case 'NBA': return NBA_LEAGUES;
    case 'NFL': return NFL_LEAGUES;
    default: return SOCCER_LEAGUES;
  }
}
