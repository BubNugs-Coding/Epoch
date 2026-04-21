import type { Agent, SimEvent } from '../types/simTypes';

export function createDeathEvents(day: number, before: Agent[], after: Agent[]): SimEvent[] {
  const beforeAlive = new Set(before.filter((a) => a.alive).map((a) => a.id));
  const events: SimEvent[] = [];

  for (const agent of after) {
    if (beforeAlive.has(agent.id) && !agent.alive) {
      events.push({
        id: 0,
        day,
        type: 'agent_died',
        summary: `${agent.name} died at day ${day}.`,
        importance: 3,
        agentIds: [agent.id],
        x: agent.x,
        y: agent.y,
      });
    }
  }

  return events;
}

export function createDayEvents(day: number): SimEvent[] {
  return [
    {
      id: 0,
      day,
      type: 'day_started',
      summary: `Day ${day} begins.`,
      importance: 1,
    },
  ];
}

export function assignEventIds(existing: SimEvent[], incoming: SimEvent[]): SimEvent[] {
  let nextId = existing.length > 0 ? existing[existing.length - 1].id + 1 : 1;
  return incoming.map((event) => {
    const withId = { ...event, id: nextId };
    nextId += 1;
    return withId;
  });
}
