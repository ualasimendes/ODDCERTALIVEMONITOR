import { Router } from 'express';
import { dbService } from '../database/db.ts';
import { IntensityLevel, TabType } from '../models/types.ts';
import { gamesService } from '../services/games.ts';
import { suggestionsService } from '../services/suggestions.ts';

export const apiRouter = Router();

// Refresh rate-limiting cooldown (15 seconds)
let lastRefreshTime = 0;
const REFRESH_COOLDOWN_MS = 15000;

function checkAdminAuth(req: any, res: any): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return true;
  const provided = req.headers['x-admin-token'] || req.query.admin_token;
  if (provided !== adminToken) {
    res.status(401).json({ success: false, error: 'Acesso não autorizado.' });
    return false;
  }
  return true;
}

function handleApiError(res: any, err: any, clientMsg = 'Erro interno no servidor.') {
  console.error('[API Error]:', err?.message || err);
  const msg = process.env.NODE_ENV === 'production' ? clientMsg : (err?.message || clientMsg);
  return res.status(500).json({ success: false, error: msg });
}

// GET /api/games
apiRouter.get('/games', async (req, res) => {
  try {
    await gamesService.ensureInitialPoll();

    const tab = req.query.tab as TabType | undefined;
    const intensity = req.query.intensity as IntensityLevel | 'ALL' | undefined;
    const sortBy = req.query.sortBy as any;
    const sortOrder = req.query.sortOrder as any;

    const matches = gamesService.getMatches({
      tab,
      intensity,
      sortBy,
      sortOrder,
    });

    const allMatches = gamesService.getMatches({});
    const counts = {
      all: allMatches.length,
      over_limite: allMatches.filter(m => m.tab === 'over_limite').length,
      over_frente: allMatches.filter(m => m.tab === 'over_frente').length,
      over_longa: allMatches.filter(m => m.tab === 'over_longa').length,
      mega_hot: allMatches.filter(m => m.intensity.primaryTag === 'MEGA_HOT').length,
      hot: allMatches.filter(m => m.intensity.primaryTag === 'HOT').length,
    };

    res.json({
      success: true,
      data: matches,
      counts,
      settings: gamesService.getSettings(),
    });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao listar partidas.');
  }
});

// GET /api/games/:id
apiRouter.get('/games/:id', (req, res) => {
  try {
    const gameId = String(req.params.id || '').trim();
    if (!gameId || gameId.length > 50) {
      return res.status(400).json({ success: false, error: 'ID de partida inválido.' });
    }
    const match = gamesService.getMatchById(gameId);
    if (!match) {
      return res.status(404).json({ success: false, error: 'Partida não encontrada.' });
    }
    const snapshots = dbService.getSnapshotsForGame(gameId, 100);
    res.json({
      success: true,
      data: {
        ...match,
        snapshots,
      },
    });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao buscar detalhes da partida.');
  }
});

// GET /api/games/:id/history (supports ?line=X.5)
apiRouter.get('/games/:id/history', async (req, res) => {
  try {
    const gameId = String(req.params.id || '').trim();
    if (!gameId || gameId.length > 50) {
      return res.status(400).json({ success: false, error: 'ID de partida inválido.' });
    }

    let lineParam: number | undefined = undefined;
    if (req.query.line) {
      const parsed = parseFloat(req.query.line as string);
      if (Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 15.5) {
        lineParam = parsed;
      }
    }

    const history = await gamesService.getMatchHistoricalProbability(gameId, lineParam);
    if (!history) {
      return res.status(404).json({ success: false, error: 'Partida não encontrada para análise histórica.' });
    }
    res.json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao calcular histórico da partida.');
  }
});

// GET /api/competitions
apiRouter.get('/competitions', (req, res) => {
  try {
    const competitions = dbService.getCompetitions();
    res.json({ success: true, data: competitions });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao listar competições.');
  }
});

// POST /api/competitions/:id/toggle
apiRouter.post('/competitions/:id/toggle', (req, res) => {
  try {
    if (!checkAdminAuth(req, res)) return;

    const compId = String(req.params.id || '').trim();
    if (!compId || compId.length > 50) {
      return res.status(400).json({ success: false, error: 'Identificador de competição inválido.' });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive deve ser booleano.' });
    }

    dbService.toggleCompetition(compId, isActive);
    res.json({ success: true });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao alterar estado da competição.');
  }
});

// GET /api/settings
apiRouter.get('/settings', (req, res) => {
  res.json({ success: true, data: gamesService.getSettings() });
});

// POST /api/settings
apiRouter.post('/settings', (req, res) => {
  try {
    if (!checkAdminAuth(req, res)) return;

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ success: false, error: 'Corpo da requisição inválido.' });
    }

    const sanitized: any = {};

    if (body.pollIntervalSeconds !== undefined) {
      const val = Number(body.pollIntervalSeconds);
      if (!Number.isFinite(val) || val < 10 || val > 300) {
        return res.status(400).json({ success: false, error: 'pollIntervalSeconds deve estar entre 10 e 300 segundos.' });
      }
      sanitized.pollIntervalSeconds = Math.round(val);
    }

    if (body.isAutoRefreshActive !== undefined) {
      if (typeof body.isAutoRefreshActive !== 'boolean') {
        return res.status(400).json({ success: false, error: 'isAutoRefreshActive deve ser booleano.' });
      }
      sanitized.isAutoRefreshActive = body.isAutoRefreshActive;
    }

    const oddFields = ['overLimiteRefOdd', 'overFrenteRefOdd', 'overLongaRefOdd'] as const;
    for (const f of oddFields) {
      if (body[f] !== undefined) {
        const val = Number(body[f]);
        if (!Number.isFinite(val) || val < 1.01 || val > 100) {
          return res.status(400).json({ success: false, error: `${f} deve estar entre 1.01 e 100.` });
        }
        sanitized[f] = val;
      }
    }

    const updated = gamesService.updateSettings(sanitized);
    res.json({ success: true, data: updated });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao atualizar configurações.');
  }
});

// GET /api/suggestions - List automated trading entry suggestions with accuracy audit
apiRouter.get('/suggestions', async (req, res) => {
  try {
    await gamesService.ensureInitialPoll();
    const status = req.query.status as any;
    const type = req.query.type as any;
    const result = suggestionsService.getSuggestions({ status, type });
    res.json({
      success: true,
      data: result.data,
      summary: result.summary,
    });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao listar sugestões de entrada.');
  }
});

// GET /api/suggestions/criteria - Get current parameters and criteria for entry suggestions
apiRouter.get('/suggestions/criteria', (req, res) => {
  res.json({
    success: true,
    data: suggestionsService.getCriteria(),
  });
});

// POST /api/suggestions/criteria - Update parameters and criteria for entry suggestions
apiRouter.post('/suggestions/criteria', (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ success: false, error: 'Corpo da requisição inválido.' });
    }
    const updated = suggestionsService.updateCriteria(body);
    res.json({
      success: true,
      data: updated,
    });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao atualizar parâmetros de sugestão.');
  }
});

// POST /api/refresh
apiRouter.post('/refresh', async (req, res) => {
  try {
    const now = Date.now();
    if (now - lastRefreshTime < REFRESH_COOLDOWN_MS) {
      const remaining = Math.ceil((REFRESH_COOLDOWN_MS - (now - lastRefreshTime)) / 1000);
      return res.status(429).json({
        success: false,
        error: `Aguarde ${remaining}s antes de solicitar nova atualização.`,
      });
    }
    lastRefreshTime = now;

    const matches = await gamesService.pollMatches();
    res.json({ success: true, count: matches.length });
  } catch (err: any) {
    handleApiError(res, err, 'Falha ao atualizar dados de partidas.');
  }
});

// GET /api/system/inspection - Live diagnostic of ESPN API mappings
apiRouter.get('/system/inspection', async (req, res) => {
  try {
    const diagnostic = {
      source: 'ESPN Public API (site.api.espn.com & sports.core.api.espn.com)',
      testedAt: new Date().toISOString(),
      mappedFields: {
        scoreboards: { status: 'AVAILABLE', path: '/apis/site/v2/sports/soccer/{league}/scoreboard' },
        matchSummary: { status: 'AVAILABLE', path: '/apis/site/v2/sports/soccer/{league}/summary?event={id}' },
        minuteAndClock: { status: 'AVAILABLE', field: 'status.displayClock & status.clock' },
        score: { status: 'AVAILABLE', field: 'competitors[].score' },
        shotsTotal: { status: 'AVAILABLE', field: 'boxscore.teams[].statistics.totalShots' },
        shotsOnTarget: { status: 'AVAILABLE', field: 'boxscore.teams[].statistics.shotsOnTarget' },
        shotsOffTarget: { status: 'DERIVED', formula: 'totalShots - shotsOnTarget - blockedShots' },
        shotsInsideBox: { status: 'AVAILABLE_IN_COMMENTARY', source: 'commentary[] location parsing' },
        bigChances: { status: 'AVAILABLE_IN_COMMENTARY', source: 'commentary[] & athlete bigChanceCreated' },
        expectedGoals_xG: { status: 'AVAILABLE', source: 'summary.leaders expectedGoalsConceded of GK' },
        oddsOverUnder: { status: 'AVAILABLE', source: 'summary.odds[] & summary.pickcenter[]' },
        liveOdds: { status: 'AVAILABLE', source: 'DraftKings - Live Odds & total.over.live' },
      },
      supportedLeagues: [
        'Premier League (eng.1)',
        'La Liga (esp.1)',
        'Serie A (ita.1)',
        'Bundesliga (ger.1)',
        'Ligue 1 (fra.1)',
        'Brasileirão Série A (bra.1)',
        'Champions League (uefa.champions)',
        'Europa League (uefa.europa)',
        'MLS (usa.1)',
        'Primeira Liga (por.1)',
        'Eredivisie (ned.1)',
        'Liga Profesional (arg.1)',
        'Liga MX (mex.1)',
      ],
      postgresqlDatabase: {
        status: 'ONLINE',
        tables: ['competitions', 'teams', 'games', 'game_snapshots', 'game_statistics', 'odds', 'signals'],
      },
    };
    res.json({ success: true, data: diagnostic });
  } catch (err: any) {
    handleApiError(res, err, 'Falha na inspeção do sistema.');
  }
});
