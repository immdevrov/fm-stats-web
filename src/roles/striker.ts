import { getFilters } from "../filters";
import { Player, KeyOfType } from "../types";
import {
  calculateArchetypes,
  displayDate,
  formatWage,
  getCohort,
  getColumn,
  printTable,
  sortIntoCohorts,
} from "../utils";
import { applyFilters } from "./_filter";
import { Role, IRole } from "./_role";

interface IStriker extends IRole {
  headersWonRatio: number;
  arealAttempsPer90: number;
  xA: number;
  xgOP: number;
  npXG: number;
  shots90: number;
  goals90: number;
  conv: number;
  drbls: number;
  pressures: number;
  tackles90: number;
  posWon90: number;
  keyPasses: number;
  chancesCreated90: number;
  keyHeaders: number;
  ballRetention: number;
}

export class StrikersProcessor {
  players: Striker[];
  private ARHETYPE_NAMES = {
    GOALSCORER: "goalscorer",
    PRESSING_FORWARD: "pressing forward",
    CREATOR: "creator",
    TARGET_FORWARD: "target forward",
    ADVANCED_FORWARD: "adwanced forward",
  };

  constructor(players: Player[]) {
    const pl = players.filter(Striker.isRole);

    this.players = pl.map((p) => new Striker(p));
  }

  get archetypes(): Record<string, KeyOfType<IStriker, number>[]> {
    return {
      [this.ARHETYPE_NAMES.GOALSCORER]: ["conv", "shots90", "goals90"],
      [this.ARHETYPE_NAMES.PRESSING_FORWARD]: ["pressures", "tackles90"],
      [this.ARHETYPE_NAMES.CREATOR]: ["xA", "chancesCreated90"],
      [this.ARHETYPE_NAMES.TARGET_FORWARD]: [
        "headersWonRatio",
        "keyHeaders",
        "ballRetention",
      ],
      [this.ARHETYPE_NAMES.ADVANCED_FORWARD]: ["drbls", "keyPasses"],
    };
  }

  filter() {
    const filtered = applyFilters(this.players, {
      noInjuriesFilter: getFilters().noInjuriesFilter,
      minutes: getFilters().timePlayed,
      nonEmpty: (d: Striker) => d.arealAttempsPer90 > 0,
      // wage: (d) => d.wage <= 100000,
      // doesntWasteMoments: (d) => d.xgOP > 0,
      // conv: (d) => d.conv > 20,
    });

    return filtered;
  }

  analize(strikers: Striker[]) {
    const playersWithArhetype = calculateArchetypes(strikers, this.archetypes);

    return playersWithArhetype;
  }

  print(strikers: Striker[]) {
    const xACohorts = sortIntoCohorts(getColumn(strikers, "xA"));
    const hdrsCohorts = sortIntoCohorts(getColumn(strikers, "headersWonRatio"));
    const dribblesCohorts = sortIntoCohorts(getColumn(strikers, "drbls"));
    const display = strikers.map((g) => {
      const {
        uid,
        name,
        nat,
        xgOP,
        npXG,
        conv,
        shots90,
        xA,
        keyPasses,
        drbls,
        pressures,
        arealAttempsPer90: ArealAttPer90,
        headersWonRatio: hdrsWonRatio,
        contractExpires,
        wage,
        goals90,
      } = g;
      return {
        uid,
        name,
        nat,
        xgOP,
        npXG,
        conv,
        keyPasses,
        shots90,
        xA: getCohort(xA, xACohorts),
        drbls: getCohort(drbls, dribblesCohorts),
        pressures,
        ArealAttPer90,
        goals90,
        hdrsWonRatio: getCohort(hdrsWonRatio, hdrsCohorts),
        wage: wage ? formatWage(wage) : null,
        contractExpires: contractExpires ? displayDate(contractExpires) : null,
      };
    });
    console.log(`There is ${display.length} strikers to watch`);
    printTable(display);
  }
}

export class Striker extends Role implements IStriker {
  readonly goals90: number;
  readonly headersWonRatio: number;
  readonly arealAttempsPer90: number;
  readonly xA: number;
  readonly xgOP: number;
  readonly npXG: number;
  readonly shots90: number;
  readonly conv: number;
  readonly drbls: number;
  readonly pressures: number;
  readonly tackles90: number;
  readonly posWon90: number;
  readonly keyPasses: number;
  readonly chancesCreated90: number;
  readonly keyHeaders: number;
  readonly ballRetention: number;

  constructor(player: Player) {
    super(player);
    this.goals90 = this.player.goals90;
    this.headersWonRatio = this.player.HdrPercentage;
    this.arealAttempsPer90 = this.player.AerAPer90;
    this.xA = this.player.xAPer90;
    this.xgOP = this.player.xGOP;
    this.npXG = this.player.NPxGPer90;
    this.shots90 = this.player.ShTPer90;
    this.conv = this.player.ConvPercentage;
    this.drbls = this.player.DrbPer90;
    this.pressures = this.player.PresCPer90;
    this.tackles90 = this.player.TckR;
    this.posWon90 = this.player.PossWonPer90;
    this.keyPasses = this.player.OPKPPer90;
    this.chancesCreated90 = this.player.ChCPer90;
    this.keyHeaders = this.player.KHdrsPer90;
    this.ballRetention = this.posWon90 - this.player.PossLostPer90;
  }

  static isRole(player: Player): boolean {
    return player.Position.some((p) => p.type === "ST");
  }
}
