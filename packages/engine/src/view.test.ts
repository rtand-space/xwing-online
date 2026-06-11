import { describe, expect, it } from 'vitest';
import { createGame, demoConfig, dispatch, projectView } from './index';
import type { PlayerView } from './index';
import { autoPlay, firstChoice } from './harness';

const ship = (v: PlayerView, id: string) => v.ships.find((x) => x.id === id)!;

describe('projectView', () => {
  it('hides an opponent unrevealed dial but shows it to its owner', () => {
    const { game } = dispatch(createGame(demoConfig()), {
      type: 'SetDial',
      playerId: 'rebel',
      shipId: 'x1',
      maneuver: { speed: 1, bearing: 'straight', difficulty: 'blue' },
    });

    expect(ship(projectView(game.state, 'rebel'), 'x1').dial).toBeDefined();
    expect(ship(projectView(game.state, 'imperial'), 'x1').dial).toBeUndefined();
  });

  it('reveals a dial to both players after it is executed', () => {
    let g = autoPlay(
      createGame(demoConfig()),
      firstChoice,
      (gg) => gg.state.phase === 'activation',
    );
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'imperial', shipId: 't2' }).game;

    const rebelView = projectView(g.state, 'rebel');
    expect(ship(rebelView, 't2').dial).toBeDefined();
    expect(ship(rebelView, 't2').dialRevealed).toBe(true);
  });

  it('shows only the viewer’s own pending decisions', () => {
    let g = autoPlay(
      createGame(demoConfig()),
      firstChoice,
      (gg) => gg.state.phase === 'activation',
    );
    g = dispatch(g, { type: 'ExecuteManeuver', playerId: 'imperial', shipId: 't2' }).game;
    // now t2 (imperial) owes an action; the rebel should see nothing pending
    expect(projectView(g.state, 'rebel').pending).toHaveLength(0);
    expect(projectView(g.state, 'imperial').pending).toHaveLength(1);
  });
});
