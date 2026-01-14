import { type Player } from "../types";

export interface IRole {
  uid: number;
  name: string;
  minutes: number;
  injuries: boolean;
  nat: string;
  wage: number;
  division: string;
  club: string;
  contractExpires: Date | null;
}

export abstract class Role implements IRole {
  declare ["constructor"]: typeof Role;
  protected player: Player;

  constructor(player: Player) {
    if (!this.constructor.isRole(player)) {
      throw new Error(
        `player ${player.Name}:${player.UID} is not ${this.constructor.name}`
      );
    }
    this.player = player;
  }

  static isRole(_p: Player): boolean {
    return true;
  }

  get uid() {
    return this.player.UID;
  }

  get minutes() {
    return this.player.Mins;
  }

  get name() {
    return this.player.Name;
  }

  get division() {
    return this.player.Division;
  }

  get contractExpires() {
    return this.player.Expires;
  }

  get injuries() {
    return this.player.RcInjury;
  }

  get wage() {
    return this.player.Wage;
  }

  get nat() {
    return this.player.Nat;
  }

  get club() {
    return this.player.Club;
  }
}
