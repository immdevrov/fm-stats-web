import { getFilters } from "../filters";
import { KeyOfType, Player } from "../types";
import { calculateArchetypes, displayDate, formatWage, printTable } from "../utils";
import { applyFilters } from "./_filter";
import { Role, IRole } from "./_role";

interface ICentralDefender extends IRole {
  height: number;
  mistakes: number;
  tackleRating: number;
  tacklesPer90: number;
  progressivePassesPer90: number;
  passesPercent: number;
  headersWonRatio: number;
  arealAttempsPer90: number;
  posessionWonPer90: number;
  posessionLostPer90: number;
}

export class CentralDefenderProcessor {
  players: CentralDefender[];

  private ARHETYPE_NAMES = {
    AGGRESSOR: "aggressor",
    SPREADER: "spreader",
  };
  constructor(players: Player[]) {
    const pl = players.filter(CentralDefender.isRole);

    this.players = pl.map((p) => new CentralDefender(p));
  }
  get archetypes(): Record<string, KeyOfType<ICentralDefender, number>[]> {
    return {
      [this.ARHETYPE_NAMES.AGGRESSOR]: ["tackleRating", "headersWonRatio"],
      [this.ARHETYPE_NAMES.SPREADER]: ["progressivePassesPer90"],
    };
  }

  analize(players: CentralDefender[]) {
    const playersWithArhetype = calculateArchetypes(players, this.archetypes);

    return playersWithArhetype;
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
    });

    return filtered;
  }

  print(defenders: CentralDefender[]) {
    const display = defenders.map((g) => {
      const {
        uid,
        name,
        nat,
        mistakes,
        progressivePassesPer90: prPass,
        passesPercent,
        arealAttempsPer90: ArealAttps,
        headersWonRatio: hdrsWonRatio,
        tacklesPer90: tclks,
        tackleRating: tclsR,
        posessionLostPer90: posLost,
        posessionWonPer90: posWon,
        contractExpires,
        wage,
      } = g;
      return {
        uid,
        name,
        nat,
        mistakes,
        ArealAttps,
        hdrsWonRatio,
        "pass%": passesPercent,
        prPass,
        tclks,
        tclsR,
        posLost,
        posWon,
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} defenders to watch`);
    printTable(display);
  }
}
export class CentralDefender extends Role implements ICentralDefender {
  readonly height: number;
  readonly mistakes: number;
  readonly tackleRating: number;
  readonly progressivePassesPer90: number;
  readonly passesPercent: number;
  readonly tacklesPer90: number;
  readonly headersWonRatio: number;
  readonly arealAttempsPer90: number;
  readonly posessionWonPer90: number;
  readonly posessionLostPer90: number;

  constructor(player: Player) {
    super(player);

    this.height = player.Height;
    this.mistakes = player.GlMst;
    this.tackleRating = player.TckR;
    this.progressivePassesPer90 = player.PrPassesPer90;
    this.passesPercent = player.PasPercentage;
    this.tacklesPer90 = player.TckPer90;
    this.headersWonRatio = player.HdrPercentage;
    this.arealAttempsPer90 = player.AerAPer90;
    this.posessionWonPer90 = player.PossWonPer90;
    this.posessionLostPer90 = player.PossLostPer90;
  }

  static isRole(player: Player): boolean {
    return player.Position.some((p) => p.type === "D" && p.side?.includes("C"));
  }
}
