// Script to test real ESPN API connection and display actual live/scheduled match data
import { EspnProvider } from '../providers/espn.ts';

async function testConnection() {
  console.log('[ESPN] Requesting scoreboard from real ESPN endpoints...');
  const provider = new EspnProvider();

  const leaguesToTest = [
    'fra.1',
    'eng.1',
    'esp.1',
    'ita.1',
    'ger.1',
    'bra.1',
    'mex.1',
    'usa.1',
  ];

  let totalGamesFound = 0;
  let liveGamesFound = 0;
  let firstRealMatch: any = null;

  for (const leagueId of leaguesToTest) {
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueId}/scoreboard`;
      console.log(`[ESPN] Checking league ${leagueId} -> ${url}`);
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      console.log(`[ESPN] HTTP ${res.status}`);
      if (!res.ok) continue;

      const data = await res.json();
      const events = data.events || [];
      totalGamesFound += events.length;

      const liveEvents = events.filter((e: any) => e.status?.type?.state === 'in');
      liveGamesFound += liveEvents.length;

      if (events.length > 0 && !firstRealMatch) {
        // Pick the first live event or first event to inspect
        const targetEvent = liveEvents[0] || events[0];
        console.log(`[ESPN] Parsing game statistics for match ID ${targetEvent.id}...`);
        const detail = await provider.getMatchDetail(targetEvent.id, leagueId, targetEvent);
        if (detail) {
          firstRealMatch = detail;
        }
      }
    } catch (err: any) {
      console.log(`[ESPN] Request failed for ${leagueId}:`, err.message);
      console.log('[ESPN] No mock fallback enabled');
    }
  }

  console.log('\n========================================');
  console.log('ESPN CONNECTION: OK');
  console.log(`LIVE GAMES FOUND: ${liveGamesFound}`);
  console.log(`TOTAL SCHEDULED/FINISHED GAMES FOUND: ${totalGamesFound}`);

  if (firstRealMatch) {
    console.log('\nGAME:');
    console.log(`home: ${firstRealMatch.homeTeam.name}`);
    console.log(`away: ${firstRealMatch.awayTeam.name}`);
    console.log(`score: ${firstRealMatch.homeTeam.score} - ${firstRealMatch.awayTeam.score}`);
    console.log(`clock: ${firstRealMatch.displayClock} (state: ${firstRealMatch.state})`);

    console.log('\nAVAILABLE STATISTICS:');
    console.log(`totalXg: ${firstRealMatch.totalXg !== null ? firstRealMatch.totalXg : 'N/D'}`);
    console.log(`homeXg: ${firstRealMatch.homeXg !== null ? firstRealMatch.homeXg : 'N/D'}`);
    console.log(`awayXg: ${firstRealMatch.awayXg !== null ? firstRealMatch.awayXg : 'N/D'}`);
    console.log(`boxscore.home.statistics:`, JSON.stringify(firstRealMatch.boxscoreStats.home));
    console.log(`boxscore.away.statistics:`, JSON.stringify(firstRealMatch.boxscoreStats.away));
    console.log(`commentaryPlays count: ${firstRealMatch.commentaryPlays?.length || 0}`);

    console.log('\nAVAILABLE ODDS:');
    if (firstRealMatch.oddsList && firstRealMatch.oddsList.length > 0) {
      firstRealMatch.oddsList.forEach((odd: any) => {
        console.log(`provider: ${odd.providerName} | overLine: ${odd.overLine} | overOdds: ${odd.overOdds} | underOdds: ${odd.underOdds}`);
      });
    } else {
      console.log('No live odds returned in this event: N/D');
    }
  } else {
    console.log('\nNo games found on ESPN for tested leagues right now.');
  }
  console.log('========================================\n');
}

testConnection();
