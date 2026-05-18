import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import { confidenceVoteMachine } from '../confidenceVoteMachine';

describe('Confidence Vote Machine', () => {
  it('transitions from NOT_STARTED to OPEN on START_VOTING', () => {
    const actor = createActor(confidenceVoteMachine).start();
    expect(actor.getSnapshot().value).toBe('NOT_STARTED');

    actor.send({ type: 'START_VOTING' });
    expect(actor.getSnapshot().value).toBe('OPEN');
  });

  it('records votes during OPEN state', () => {
    const actor = createActor(confidenceVoteMachine).start();
    actor.send({ type: 'START_VOTING' });
    
    actor.send({ type: 'SUBMIT_VOTE', vote: 5 });
    actor.send({ type: 'SUBMIT_VOTE', vote: 4 });
    
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.totalVotes).toBe(2);
    expect(snapshot.context.votes).toEqual([5, 4]);
  });

  it('ignores votes when not in OPEN state', () => {
    const actor = createActor(confidenceVoteMachine).start();
    
    actor.send({ type: 'SUBMIT_VOTE', vote: 5 }); // Still NOT_STARTED
    
    const snapshot = actor.getSnapshot();
    expect(snapshot.context.totalVotes).toBe(0);
  });

  it('progresses through the full valid lifecycle', () => {
    const actor = createActor(confidenceVoteMachine).start();
    
    actor.send({ type: 'START_VOTING' }); // -> OPEN
    actor.send({ type: 'CLOSE_VOTING' }); // -> TALLYING
    expect(actor.getSnapshot().value).toBe('TALLYING');
    
    actor.send({ type: 'APPROVE_PI' }); // -> APPROVED
    expect(actor.getSnapshot().value).toBe('APPROVED');
    expect(actor.getSnapshot().status).toBe('done');
  });
});
