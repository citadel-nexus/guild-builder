import { describe, expect, it } from 'vitest';

import {
  LingoAdapter,
  renderLingoProfile,
} from '../../../src/agents/nexus-tamagotchi/lingo.js';

describe('LingoAdapter', () => {
  it('analyzes interaction text and evolves profile metrics', () => {
    const adapter = new LingoAdapter();

    const analysis = adapter.analyzeAndEvolve(
      'Yo fam I am curious how this cognitive routing works in production',
      'user-a',
    );

    expect(analysis.userId).toBe('user-a');
    expect(analysis.slangDetected).toContain('yo');
    expect(analysis.slangDetected).toContain('fam');
    expect(analysis.topics.length).toBeGreaterThan(0);

    const profile = adapter.getProfile('user-a');
    expect(profile).toBeDefined();
    expect(profile?.interactionCount).toBe(1);
    expect(profile?.slangFrequency.yo).toBe(1);
    expect(profile?.lastUpdated.length).toBeGreaterThan(0);
  });

  it('renders profile details and handles missing profiles', () => {
    const adapter = new LingoAdapter();
    adapter.analyzeAndEvolve('This is a clean intermediate status report', 'user-b');

    const rendered = renderLingoProfile('user-b', adapter.getProfile('user-b'));
    expect(rendered).toContain('LINGO PROFILE: user-b');
    expect(rendered).toContain('Interactions: 1');
    expect(rendered).toContain('Top Slang Terms:');

    const missing = renderLingoProfile('user-x', undefined);
    expect(missing).toContain('No profile found.');
  });
});