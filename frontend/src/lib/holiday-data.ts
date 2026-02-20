export type HolidayItem = {
  no: number;
  year: number;
  month: string;
  day: string;
  name: string;
  type: string;
  date_key: string;
};

export const HOLIDAY_ROWS: HolidayItem[] = [
  { no: 1, year: 2026, month: "01월", day: "01일", name: "신정", type: "양력", date_key: "2026-01-01" },
  { no: 2, year: 2026, month: "03월", day: "01일", name: "삼일절", type: "양력", date_key: "2026-03-01" },
  { no: 3, year: 2026, month: "05월", day: "05일", name: "어린이날", type: "양력", date_key: "2026-05-05" },
  { no: 4, year: 2026, month: "06월", day: "06일", name: "현충일", type: "양력", date_key: "2026-06-06" },
  { no: 5, year: 2026, month: "08월", day: "15일", name: "광복절", type: "양력", date_key: "2026-08-15" },
  { no: 6, year: 2026, month: "10월", day: "03일", name: "개천절", type: "양력", date_key: "2026-10-03" },
  { no: 7, year: 2026, month: "10월", day: "09일", name: "한글날", type: "양력", date_key: "2026-10-09" },
  { no: 8, year: 2026, month: "12월", day: "25일", name: "크리스마스", type: "양력", date_key: "2026-12-25" },
];

export const HOLIDAY_DATE_KEYS = HOLIDAY_ROWS.map((row) => row.date_key);
