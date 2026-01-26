import type { Player } from "../types";

export const DATE_OPTIONS = {
  ONE_MONTH: "ONE_MONTH",
  THREE_MONTHS: "THREE_MONTHS",
  SIX_MONTHS: "SIX_MONTHS",
} as const;

type Options = (typeof DATE_OPTIONS)[keyof typeof DATE_OPTIONS];

export function expiresIn(currentDate: Date, options: Options) {
  return (date: Date) => {
    const expirationDate = new Date(currentDate);

    if (options === "ONE_MONTH") {
      expirationDate.setMonth(currentDate.getMonth() + 1);
    } else if (options === "THREE_MONTHS") {
      expirationDate.setMonth(currentDate.getMonth() + 4);
    } else if (options === "SIX_MONTHS") {
      expirationDate.setMonth(currentDate.getMonth() + 7);
    }

    return date <= expirationDate;
  };
}

export function filterByContractExpiryDate(params: {
  currentDate: Date;
  players: Player[];
  options: Options;
}) {
  const { currentDate, players, options } = params;
  const dateFn = expiresIn(currentDate, options);
  return players.filter((p) => {
    if (!p.Expires) {
      return true;
    }
    return dateFn(p.Expires);
  });
}
