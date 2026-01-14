import { getFilters } from "../filters";
import { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "./_filter";
import { Role, IRole } from "./_role";

interface ICentralMidfilder extends IRole {
  tackleRating: number;
  tacklesPer90: number;
  progressivePassesPer90: number;
  passesPercent: number;
  posessionWonPer90: number;
  posessionLostPer90: number;
  keyPasses: number;
  sprints: number;
  distance: number;
  dribbles: number;
  pressures: number;
  ballRetention: number;
  chancesCreated: number;
  npXG: number;
}

export class CentralMidfilderProcessor {
  players: CentralMidfilder[];

  private ARHETYPE_NAMES = {
    DESTROYER: "destroyer",
    DEEP_PLAYMAKER: "deep playmaker",
    ADVANCED_PLAYMAKER: "advanced playmaker",
  };

  constructor(players: Player[]) {
    const pl = players.filter(CentralMidfilder.isRole);

    this.players = pl.map((p) => new CentralMidfilder(p));
  }

  get archetypes(): Record<string, KeyOfType<ICentralMidfilder, number>[]> {
    return {
      [this.ARHETYPE_NAMES.DESTROYER]: ["pressures", "tackleRating", "posessionWonPer90"],
      [this.ARHETYPE_NAMES.DEEP_PLAYMAKER]: [
        "ballRetention",
        "progressivePassesPer90",
        "keyPasses",
      ],
      [this.ARHETYPE_NAMES.ADVANCED_PLAYMAKER]: ["keyPasses", "chancesCreated", "npXG"],
    };
  }

  analize(players: CentralMidfilder[]) {
    const playersWithArhetype = calculateArchetypes(players, this.archetypes);

    return playersWithArhetype;
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
      // notEmptyFilter: (f: CentralMidfilder) => f.posessionWonPer90 > 0,
      // wageFilter: (d: CentralMidfilder) => d.wage <= 100000,
      // ballRetention: (d: CentralMidfilder) =>
      //   d.posessionWonPer90 - d.posessionLostPer90 > 0,
      // distanse: (d: CentralMidfilder) => d.distance > 12.5,
      // tackles: (d: CentralMidfilder) => d.tackleRating > 70,
      // headers: (d: CentralMidfilder) => d.headersWonRatio > 40,
      // progressViaPassOrCarry: (d: CentralMidfilder) =>
      //   d.progressivePassesPer90 > 4.5 || d.dribbles > 1.2,
    });

    return filtered;
  }

  print(defenders: CentralMidfilder[]) {
    const display = defenders.map((g) => {
      const {
        uid,
        name,
        nat,
        progressivePassesPer90: prPass,
        passesPercent,
        tacklesPer90: tclks,
        tackleRating: tclsR,
        posessionLostPer90: posLost,
        posessionWonPer90: posWon,
        headersWonRatio,
        keyPasses,
        dribbles,
        sprints,
        pressures,
        distance,
        contractExpires,
        wage,
      } = g;
      return {
        uid,
        name,
        nat,
        "pass%": passesPercent,
        prPass,
        tclks,
        tclsR,
        posLost,
        posWon,
        hwr: headersWonRatio,
        keyPasses,
        dribbles,
        sprints,
        distance,
        pressures,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} central midfilders to watch`);
    printTable(display);
  }
}

export class CentralMidfilder extends Role implements ICentralMidfilder {
  readonly tackleRating: number;
  readonly progressivePassesPer90: number;
  readonly passesPercent: number;
  readonly tacklesPer90: number;
  readonly posessionWonPer90: number;
  readonly posessionLostPer90: number;
  readonly keyPasses: number;
  readonly dribbles: number;
  readonly sprints: number;
  readonly distance: number;
  readonly headersWonRatio: number;
  readonly pressures: number;
  readonly ballRetention: number;
  readonly npXG: number;
  readonly chancesCreated: number;

  constructor(player: Player) {
    super(player);

    this.tackleRating = player.TckR;
    this.progressivePassesPer90 = player.PrPassesPer90;
    this.passesPercent = player.PasPercentage;
    this.tacklesPer90 = player.TckPer90;
    this.posessionWonPer90 = player.PossWonPer90;
    this.posessionLostPer90 = player.PossLostPer90;
    this.keyPasses = player.OPKPPer90;
    this.dribbles = player.DrbPer90;
    this.sprints = player.SprintsPer90;
    this.distance = player.DistPer90;
    this.headersWonRatio = player.HdrPercentage;
    this.pressures = player.PresCPer90;
    this.ballRetention = player.PossWonPer90 - player.PossLostPer90;
    this.npXG = player.NPxGPer90;
    this.chancesCreated = player.ChCPer90;
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
      (p) => (p.type === "M" && p.side?.includes("C")) || p.type === "DM"
    );
  }
}
