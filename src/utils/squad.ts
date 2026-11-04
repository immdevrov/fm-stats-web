import type { Player } from '../types/types';
import type { PlayerAnnotation, TransferMark } from '../types/annotations';

export interface MarkedSquad {
  imported: Player[];
  incoming: Player[];
  outgoing: Player[];
  squad: Player[];
}

export function markedSquad(
  roster: Player[],
  myClub: string,
  annotations: Map<number, PlayerAnnotation>
): MarkedSquad {
  const imported = roster.filter((player) => player.Club === myClub);
  const incoming = roster.filter(
    (player) => player.Club !== myClub && annotations.get(player.UID)?.transfer === 'in'
  );
  const outgoing = imported.filter((player) => annotations.get(player.UID)?.transfer === 'out');
  const outUids = new Set(outgoing.map((player) => player.UID));
  const squad = [...imported.filter((player) => !outUids.has(player.UID)), ...incoming];
  return { imported, incoming, outgoing, squad };
}

export function isTransferDone(
  transfer: TransferMark,
  club: string | undefined,
  myClub: string
): boolean {
  return transfer === 'in' ? club === myClub : club !== myClub;
}
