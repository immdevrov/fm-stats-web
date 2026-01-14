import { getFilters } from "../filters";
import { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "./_filter";
import { Role, IRole } from "./_role";

interface IDefensiveMidfilder extends IRole {
  tackleRating: number;
  tacklesPer90: number;
  progressivePassesPer90: number;
  passesPercent: number;
  headersWonRatio: number;
  arealAttempsPer90: number;
  posessionWonPer90: number;
  posessionLostPer90: number;
  keyPasses: number;
  pressures: number;
  ballRetention: number;
}

export class DefensiveMidfilderProcessor {
  players: DefensiveMidfilder[];

  private ARHETYPE_NAMES = {
    DESTROYER: "destroyer",
    DEEP_PLAYMAKER: "deep playmaker",
    ANCHOR: "anchor",
  };

  constructor(players: Player[]) {
    const pl = players.filter(DefensiveMidfilder.isRole);

    this.players = pl.map((p) => new DefensiveMidfilder(p));
  }

  get archetypes(): Record<string, KeyOfType<IDefensiveMidfilder, number>[]> {
    return {
      [this.ARHETYPE_NAMES.DESTROYER]: ["pressures", "tackleRating", "posessionWonPer90"],
      [this.ARHETYPE_NAMES.DEEP_PLAYMAKER]: [
        "ballRetention",
        "progressivePassesPer90",
        "keyPasses",
      ],
      [this.ARHETYPE_NAMES.ANCHOR]: [
        "passesPercent",
        "progressivePassesPer90",
        "ballRetention",
      ],
    };
  }

  analize(players: DefensiveMidfilder[]) {
    const playersWithArhetype = calculateArchetypes(players, this.archetypes);

    return playersWithArhetype;
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      timePlayed: getFilters().timePlayed,
      // headerRatioFilter: (d: DefensiveMidfilder) => d.headersWonRatio >= 70,
      // tacklesRationFilter: (d: DefensiveMidfilder) => d.tackleRating >= 80,
      // notEmptyFilter: (f: DefensiveMidfilder) => f.posessionWonPer90 > 0,
      // wageFilter: (d: DefensiveMidfilder) => d.wage <= 20_000_000,
      // doNotLostBall: (d: DefensiveMidfilder) => d.posessionLostPer90 < 10,
      // lotOfTackles: (d: DefensiveMidfilder) => d.tacklesPer90 > 1.95,
      // headers: (d: DefensiveMidfilder) => d.headersWonRatio > 40,
      // passes: (d: DefensiveMidfilder) => d.passesPercent >= 90,
      // prPasses: (d: DefensiveMidfilder) => d.progressivePassesPer90 >= 7,
    });

    return filtered;
  }

  print(defenders: DefensiveMidfilder[]) {
    const display = defenders.map((g) => {
      const {
        uid,
        name,
        nat,
        progressivePassesPer90: prPass,
        passesPercent,
        arealAttempsPer90: ArealAttps,
        headersWonRatio: hdrsWonRatio,
        tacklesPer90: tclks,
        tackleRating: tclsR,
        posessionLostPer90: posLost,
        posessionWonPer90: posWon,
        keyPasses,
        contractExpires,
        wage,
      } = g;
      return {
        uid,
        name,
        nat,
        ArealAttps,
        hwr: hdrsWonRatio,
        "pass%": passesPercent,
        prPass,
        tclks,
        tclsR,
        posLost,
        posWon,
        keyPasses,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} def midfilders to watch`);
    printTable(display);
  }
}

export class DefensiveMidfilder extends Role implements IDefensiveMidfilder {
  readonly tackleRating: number;
  readonly progressivePassesPer90: number;
  readonly passesPercent: number;
  readonly tacklesPer90: number;
  readonly headersWonRatio: number;
  readonly arealAttempsPer90: number;
  readonly posessionWonPer90: number;
  readonly posessionLostPer90: number;
  readonly keyPasses: number;
  readonly pressures: number;
  readonly ballRetention: number;

  constructor(player: Player) {
    super(player);
    this.tackleRating = player.TckR;
    this.progressivePassesPer90 = player.PrPassesPer90;
    this.passesPercent = player.PasPercentage;
    this.tacklesPer90 = player.TckPer90;
    this.headersWonRatio = player.HdrPercentage;
    this.arealAttempsPer90 = player.AerAPer90;
    this.posessionWonPer90 = player.PossWonPer90;
    this.posessionLostPer90 = player.PossLostPer90;
    this.keyPasses = player.OPKPPer90;
    this.pressures = player.PresCPer90;
    this.ballRetention = player.PossWonPer90 - player.PossLostPer90;
  }

  static isRole(player: Player): boolean {
    return player.Position.some(
      (p) => (p.type === "M" && p.side?.includes("C")) || p.type === "DM"
    );
  }
}
