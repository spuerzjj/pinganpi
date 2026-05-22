import { describe, expect, it } from "vitest";
import { getDailyAttendance, type Scribe } from "./scribes.js";

const scribes: Scribe[] = [
  {
    id: "xu-guangzhou",
    name: "许先生",
    city: "广州",
    style: "street",
    feeFen: 3,
    attendanceRate: 1,
    specialties: ["daily", "longing"]
  },
  {
    id: "huang-guangzhou",
    name: "黄老先生",
    city: "广州",
    style: "old-scholar",
    feeFen: 8,
    attendanceRate: 0,
    specialties: ["formal"]
  },
  {
    id: "lin-shanghai",
    name: "林先生",
    city: "上海",
    style: "schoolmaster",
    feeFen: 5,
    attendanceRate: 1,
    specialties: ["safe-report"]
  }
];

describe("scribe attendance", () => {
  it("filters by city and attendance rate", () => {
    const today = new Date(Date.UTC(2026, 4, 23));

    const attendance = getDailyAttendance({
      city: "广州",
      date: today,
      scribes
    });

    expect(attendance.map((scribe) => scribe.id)).toEqual(["xu-guangzhou"]);
  });

  it("is deterministic for the same city and date", () => {
    const today = new Date(Date.UTC(2026, 4, 23));

    expect(getDailyAttendance({ city: "上海", date: today, scribes })).toEqual(
      getDailyAttendance({ city: "上海", date: today, scribes })
    );
  });

  it("uses the China local calendar day for deterministic attendance", () => {
    const boundaryScribes: Scribe[] = [
      {
        id: "xu",
        name: "许先生",
        city: "广州",
        style: "street",
        feeFen: 3,
        attendanceRate: 0.418,
        specialties: ["daily"]
      }
    ];

    const attendance = getDailyAttendance({
      city: "广州",
      date: new Date(Date.UTC(2026, 4, 22, 16, 30)),
      scribes: boundaryScribes
    });

    expect(attendance.map((scribe) => scribe.id)).toEqual(["xu"]);
  });
});
