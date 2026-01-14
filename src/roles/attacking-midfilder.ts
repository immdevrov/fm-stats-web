import { getFilters } from "../filters";
import { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "./_filter";
import { Role, IRole } from "./_role";

interface IAttackingMidfilder extends IRole {
  progressivePassesPer90: number;
  passesPercent: number;
  posessionWonPer90: number;
  posessionLostPer90: number;
  keyPasses: number;
  dribbles: number;
  xA: number;
  conv: number;
  npXG: number;
  chancesCreated: number;
}

export class AttackingMidfilderProcessor {
  players: AttackingMidfilder[];
  private ARHETYPE_NAMES = {
    ADVANCED_PLAYMAKER: "advanced playmaker",
  };
  constructor(players: Player[]) {
    const pl = players.filter(AttackingMidfilder.isRole);

    this.players = pl.map((p) => new AttackingMidfilder(p));
  }

  get archetypes(): Record<string, KeyOfType<IAttackingMidfilder, number>[]> {
    return {
      [this.ARHETYPE_NAMES.ADVANCED_PLAYMAKER]: ["keyPasses", "chancesCreated", "npXG"],
    };
  }

  analize(players: AttackingMidfilder[]) {
    const playersWithArhetype = calculateArchetypes(players, this.archetypes);

    return playersWithArhetype;
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
      notEmptyFilter: (f: AttackingMidfilder) =>
        f.progressivePassesPer90 > 0 && f.conv > 0,
    });

    return filtered;
  }

  print(defenders: AttackingMidfilder[]) {
    const display = defenders.map((g) => {
      const {
        uid,
        name,
        nat,
        progressivePassesPer90: prPass,
        passesPercent,
        keyPasses,
        dribbles,
        xA,
        npXG,
        conv,
        contractExpires,
        wage,
      } = g;
      return {
        uid,
        name,
        nat,
        "pass%": passesPercent,
        prPass,
        keyPasses,
        dribbles,
        xA,
        npXG,
        conv,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} attacking midfilders to watch`);
    printTable(display);
  }
}

export class AttackingMidfilder extends Role implements IAttackingMidfilder {
  readonly progressivePassesPer90: number;
  readonly passesPercent: number;
  readonly posessionWonPer90: number;
  readonly posessionLostPer90: number;
  readonly keyPasses: number;
  readonly dribbles: number;
  readonly xA: number;
  readonly conv: number;
  readonly npXG: number;
  readonly chancesCreated: number;

  constructor(player: Player) {
    super(player);

    this.progressivePassesPer90 = player.PrPassesPer90;
    this.passesPercent = player.PasPercentage;
    this.posessionWonPer90 = player.PossWonPer90;
    this.posessionLostPer90 = player.PossLostPer90;
    this.keyPasses = player.OPKPPer90;
    this.dribbles = player.DrbPer90;
    this.xA = player.xAPer90;
    this.conv = player.ConvPercentage;
    this.npXG = player.NPxGPer90;
    this.chancesCreated = player.ChCPer90;
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
      (p) => (p.type === "M" || p.type === "AM") && p.side?.includes("C")
    );
  }
}
