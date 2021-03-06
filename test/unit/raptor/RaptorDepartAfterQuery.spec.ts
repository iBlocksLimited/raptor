import * as chai from "chai";
import {RaptorQueryFactory} from "../../../src/raptor/RaptorQueryFactory";
import {JourneyFactory} from "../../../src/results/JourneyFactory";
import {allDays, calendars, j, setDefaultTrip, st, t, tf, tfi, via} from "../util";

describe("RaptorDepartAfterQuery", () => {
  const journeyFactory = new JourneyFactory();

  it("finds journeys with direct connections", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      )
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ])
    ]);
  });

  it("finds route not going through B", () => {
    const trips = [
      t(st("A", null, 1000),
        st("B", 1025, 1028),
        st("C", 1100, null)),
      t(st("A", null, 1010),
        st("D", 1030, 1035),
        st("C", 1110, null))
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900, ["B"]);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1010),
        st("D", 1030, 1035),
        st("C", 1110, null)
      ])
    ]);
  });

  it("check not via allows reboarding of a route exclude due to not via", () => {
      /*
      * Checks that raptor can still plan a journey that goes from A - D but not via B where the
      * only train that goes to D goes through B.
      *
      *      E
      *    /  \
      *   /    \
      *  /      \
      * A - B - C - D
      *
      */
    const trips = [
      t(st("A", null, 1000),
        st("B", 1025, 1028),
        st("C", 1100, 1108),
        st("D", 1135, null)),
      t(st("A", null, 1000),
        st("E", 1035, 1040),
        st("C", 1050, null)
        )
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "D", new Date("2018-10-16"), 900, ["B"]);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("E", 1035, 1040),
        st("C", 1050, null)
      ],
      [
        st("C", 1100, 1108),
        st("D", 1135, null)
      ])
    ]);
  });

  it("finds correct not via ignoring transfers", () => {
      const trips = [
          t(st("A", null, 1000),
              st("B", 1025, 1028, ),
              st("C", 1100, 1108),
              st("D", 1135, null)),
          t(st("A", null, 1000),
              st("E", 1018, 1025),
              st("C", 1050, null)),
          t(st("B", 1021, 1025),
              st("C", 1028, 1030),
              st("D", 1035, null))
      ];

      const transfers = {
          "E": [
              tf("E", "B", 1)
          ]};

      const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, transfers, {}, calendars, journeyFactory);
      const result = raptor.plan("A", "D", new Date("2018-10-16"), 900, ["B"]);

      setDefaultTrip(result);

      chai.expect(result).to.deep.equal([
          j([
                  st("A", null, 1000),
                  st("E", 1018, 1025),
                  st("C", 1050, null)
              ],
              [
                  st("C", 1100, 1108),
                  st("D", 1135, null)
              ])
      ]);

  });

  it("finds slower route not through multiple vias", () => {
      const trips = [
          t(
              st("A", null, 1100),
              st("B", 1130, 1132),
              st("C", 1200, null)
          ),
          t(
              st("A", null, 1100),
              st("D", 1110, 1112),
              st("C", 1120, null)
          ),
          t(
              st("A", null, 1100),
              st("E", 1105, 1108),
              st("C", 1115, 1120)
          )
      ];
      const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
      const result = raptor.plan("A", "C", new Date("2018-10-16"), 900, ["D", "E"]);

      setDefaultTrip(result);

      chai.expect(result).to.deep.equal([
          j([
              st("A", null, 1100),
              st("B", 1130, 1132),
              st("C", 1200, null)
              ])
      ]);

  });

  it("finds route not via station that has no pick up or drop off", () => {
     const trips = [
         t(
             st("A", null, 1100),
             st("B", 1130, 1140),
             st("C", 1150, null)
         ),
         t(
             st("A", null, 1100),
             via("D", 1115, 1115, false, false),
             st( "C", 1130, null)
         )
     ];

     const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
     const result = raptor.plan("A", "C", new Date("2018-10-16"), 900, ["D"]);

     setDefaultTrip(result);

     chai.expect(result).to.deep.equal([
          j([
              st("A", null, 1100),
              st("B", 1130, 1140),
              st("C", 1150, null)
          ])
      ]);

  });

  it("finds the earliest calendars", () => {
    const trips = [
      t(
        st("A", null, 1400),
        st("B", 1430, 1435),
        st("C", 1500, null)
      ),
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      )
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ])
    ]);
  });

  it("finds journeys with a single connection", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ),
      t(
        st("D", null, 1000),
        st("B", 1030, 1035),
        st("E", 1100, null)
      )
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "E", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
      ], [
        st("B", 1030, 1035),
        st("E", 1100, null)
      ])
    ]);
  });

  it("does not return journeys that cannot be made", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1035, 1035),
        st("C", 1100, null)
      ),
      t(
        st("D", null, 1000),
        st("B", 1030, 1030),
        st("E", 1100, null)
      )
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "E", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([]);
  });

  it("returns the fastest and the least changes", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1200, null)
      ),
      t(
        st("B", null, 1030),
        st("C", 1100, null)
      )
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const direct = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
      st("C", 1200, null)
    ]);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
    ], [
      st("B", null, 1030),
      st("C", 1100, null)
    ]);

    chai.expect(result).to.deep.equal([
      direct,
      change
    ]);
  });

  it("chooses the fastest journey where the number of journeys is the same", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      ),
      t(
        st("C", null, 1200),
        st("D", 1230, 1230),
        st("E", 1300, null)
      ),
      t(
        st("A", null, 1100),
        st("F", 1130, 1130),
        st("G", 1200, null)
      ),
      t(
        st("G", null, 1200),
        st("H", 1230, 1230),
        st("E", 1255, null)
      ),
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "E", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const fastest = j([
      st("A", null, 1100),
      st("F", 1130, 1130),
      st("G", 1200, null)
    ], [
      st("G", null, 1200),
      st("H", 1230, 1230),
      st("E", 1255, null)
    ]);

    chai.expect(result).to.deep.equal([
      fastest
    ]);
  });

  it("chooses an arbitrary journey when they are the same", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      ),
      t(
        st("C", null, 1200),
        st("D", 1230, 1230),
        st("E", 1300, null)
      ),
      t(
        st("A", null, 1100),
        st("F", 1130, 1130),
        st("G", 1200, null)
      ),
      t(
        st("G", null, 1200),
        st("H", 1230, 1230),
        st("E", 1300, null)
      ),
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "E", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const journey1 = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
      st("C", 1100, null)
    ], [
      st("C", null, 1200),
      st("D", 1230, 1230),
      st("E", 1300, null)
    ]);

    chai.expect(result).to.deep.equal([
      journey1
    ]);
  });

  it("chooses the correct change point", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      t(
        st("A", null, 1030),
        st("C", 1200, null)
      ),
      t(
        st("C", null, 1000),
        st("B", 1030, 1030),
        st("E", 1100, null)
      ),
      t(
        st("C", null, 1200),
        st("B", 1230, 1230),
        st("E", 1300, null)
      ),
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "E", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null)
    ], [
      st("B", 1030, 1030),
      st("E", 1100, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("finds journeys with a transfer", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ),
      t(
        st("D", null, 1200),
        st("E", 1300, null)
      )
    ];

    const transfers = {
      "C": [
        tf("C", "D", 10)
      ]
    };

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, transfers, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "E", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    chai.expect(result).to.deep.equal([
      j([
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1100, null)
      ],
      tfi("C", "D", 10, 0, 0)
      , [
        st("D", null, 1200),
        st("E", 1300, null)
      ])
    ]);
  });

  it("uses a transfer if it is faster", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      ),
      t(
        st("C", null, 1130),
        st("D", 1200, null)
      )
    ];

    const transfers = {
      "C": [
        tf("C", "D", 10)
      ]
    };

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, transfers, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "D", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const transfer = j(
      [
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      ],
      tfi("C", "D", 10, 0, 0)
    );

    chai.expect(result).to.deep.equal([
      transfer
    ]);
  });

  it("doesn't allow pick up from locations without pickup specified", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1200, null)
      ),
      t(
        st("E", null, 1000),
        st("B", 1030, null),
        st("C", 1100, null)
      )
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const direct = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
      st("C", 1200, null)
    ]);

    chai.expect(result).to.deep.equal([
      direct
    ]);
  });

  it("doesn't allow drop off at non-drop off locations", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", null, 1030),
        st("C", 1200, null)
      ),
      t(
        st("E", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, null)
      )
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const direct = j([
      st("A", null, 1000),
      st("B", null, 1030),
      st("C", 1200, null)
    ]);

    chai.expect(result).to.deep.equal([
      direct
    ]);
  });

  it("applies interchange times", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1200, null)
      ),
      t(
        st("B", null, 1030),
        st("C", 1100, null)
      ),
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = { B: 10 };

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, transfers, interchange, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const direct = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
      st("C", 1200, null)
    ]);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, 1030),
    ], [
      st("B", null, 1040),
      st("C", 1110, null)
    ]);

    chai.expect(result).to.deep.equal([
      direct,
      change
    ]);
  });

  it("applies interchange times to transfers", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      t(
        st("C", null, 1030),
        st("D", 1100, null)
      ),
      t(
        st("C", null, 1042), // No interchanges applied
        st("D", 1142, null)
      ),
      t(
        st("C", null, 1047), // Origin (B) interchange applied
        st("D", 1147, null)
      ),
      t(
        st("C", null, 1049), // Destination (C) interchange applied
        st("D", 1149, null)
      ),
      t(
        st("C", null, 1052), // Origin (B) interchange applied twice
        st("D", 1152, null)
      ),
      t(
        st("C", null, 1054), // Origin (B) and destination (C) interchanges applied once each ✓
        st("D", 1154, null)
      ),
      t(
        st("C", null, 1056), // Destination (C) interchange applied twice
        st("D", 1156, null)
      ),
      t(
        st("C", null, 1200), // Other
        st("D", 1300, null)
      )
    ];

    const transfers = {
      "B": [
        tf("B", "C", 11)
      ]
    };

    const interchange = { B: 5, C: 7 };

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, transfers, interchange, calendars, journeyFactory);
    const result = raptor.plan("A", "D", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const lastPossible = j(
      [
        st("A", null, 1000),
        st("B", 1030, null),
      ],
      tfi("B", "C", 11, 5, 7),
      [
        st("C", null, 1054), // Origin (B) and destination (C) interchanges applied once each ✓
        st("D", 1154, null)
      ]
    );

    chai.expect(result).to.deep.equal([
      lastPossible
    ]);
  });

  it("omits calendars not running that day", () => {
    const trip = t(
      st("B", null, 1030),
      st("C", 1100, null)
    );

    trip.serviceId = "2";

    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      trip,
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = {};
    const calendar = { serviceId: "2", startDate: 20181001, endDate: 20181015, days: allDays, include: {}, exclude: {}};

    const raptor = RaptorQueryFactory.createDepartAfterQuery(
      trips,
      transfers,
      interchange,
      Object.assign({}, calendars, { [calendar.serviceId]: calendar }),
      journeyFactory
    );
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null),
    ], [
      st("B", null, 1040),
      st("C", 1110, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("omits calendars not running that day of the week", () => {
    const trip = t(
      st("B", null, 1030),
      st("C", 1100, null)
    );

    trip.serviceId = "2";

    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      trip,
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = {};
    const days = Object.assign({}, allDays, { 1: false });
    const calendar = { serviceId: "2", startDate: 20181001, endDate: 20991231, days: days, include: {}, exclude: {} };

    const raptor = RaptorQueryFactory.createDepartAfterQuery(
      trips,
      transfers,
      interchange,
      Object.assign({}, calendars, { [calendar.serviceId]: calendar }),
      journeyFactory
    );

    const result = raptor.plan("A", "C", new Date("2018-10-22"), 900);

    setDefaultTrip(result);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null),
    ], [
      st("B", null, 1040),
      st("C", 1110, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("includes calendars with an include day", () => {
    const trip = t(
      st("B", null, 1030),
      st("C", 1100, null)
    );

    trip.serviceId = "2";

    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      trip,
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = {};
    const calendar = {
      serviceId: "2",
      startDate: 20991231,
      endDate: 20991231,
      days: allDays,
      include: { 20181022: true },
      exclude: {}
    };

    const raptor = RaptorQueryFactory.createDepartAfterQuery(
      trips,
      transfers,
      interchange,
      Object.assign({}, calendars, { [calendar.serviceId]: calendar }),
      journeyFactory
    );

    const result = raptor.plan("A", "C", new Date("2018-10-22"), 900);

    setDefaultTrip(result);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null),
    ], [
      st("B", null, 1030),
      st("C", 1100, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("omits calendars with an exclude day", () => {
    const trip = t(
      st("B", null, 1030),
      st("C", 1100, null)
    );

    trip.serviceId = "2";

    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, null)
      ),
      trip,
      t(
        st("B", null, 1040),
        st("C", 1110, null)
      )
    ];

    const transfers = {};
    const interchange = {};
    const calendar = {
      serviceId: "2",
      startDate: 20181001,
      endDate: 20991231,
      days: allDays,
      include: {},
      exclude: { 20181022: true }
    };

    const raptor = RaptorQueryFactory.createDepartAfterQuery(
      trips,
      transfers,
      interchange,
      Object.assign({}, calendars, { [calendar.serviceId]: calendar }),
      journeyFactory
    );

    const result = raptor.plan("A", "C", new Date("2018-10-22"), 900);

    setDefaultTrip(result);

    const change = j([
      st("A", null, 1000),
      st("B", 1030, null),
    ], [
      st("B", null, 1040),
      st("C", 1110, null)
    ]);

    chai.expect(result).to.deep.equal([
      change
    ]);
  });

  it("finds journeys after gaps in rounds", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1035),
        st("C", 1400, null)
      ),
      t(
        st("B", null, 1035),
        st("D", 1100, null)
      ),
      t(
        st("D", null, 1100),
        st("E", 1130, null)
      ),
      t(
        st("E", null, 1130),
        st("C", 1200, null)
      ),
      t(
        st("A", null, 1000),
        st("E", 1135, null)
      ),
      t(
        st("E", null, 1135),
        st("C", 1330, null)
      ),
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "C", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const direct = j([
      st("A", null, 1000),
      st("B", 1030, 1035),
      st("C", 1400, null)
    ]);

    const slowChange = j(
      [
        st("A", null, 1000),
        st("E", 1135, null)
      ],
      [
        st("E", null, 1135),
        st("C", 1330, null)
      ],
    );

    const change = j(
      [
        st("A", null, 1000),
        st("B", 1030, 1035)
      ],
      [
        st("B", null, 1035),
        st("D", 1100, null)
      ],
      [
        st("D", null, 1100),
        st("E", 1130, null)
      ],
      [
        st("E", null, 1130),
        st("C", 1200, null)
      ]
    );

    chai.expect(result).to.deep.equal([
      direct,
      slowChange,
      change
    ]);
  });

  it("puts overtaken trains in different routes", () => {
    const trips = [
      t(
        st("A", null, 1000),
        st("B", 1030, 1030),
        st("C", 1100, 1110),
        st("D", 1130, 1130),
        st("E", 1200, null)
      ),
      t(
        st("A", null, 1010),
        st("B", 1040, 1040),
        st("C", 1050, 1100),
        st("D", 1120, 1120),
        st("E", 1150, null)
      ),
    ];

    const raptor = RaptorQueryFactory.createDepartAfterQuery(trips, {}, {}, calendars, journeyFactory);
    const result = raptor.plan("A", "E", new Date("2018-10-16"), 900);

    setDefaultTrip(result);

    const faster = j(
      [
        st("A", null, 1010),
        st("B", 1040, 1040),
        st("C", 1050, 1100),
        st("D", 1120, 1120),
        st("E", 1150, null)
      ]
    );

    chai.expect(result).to.deep.equal([
      faster
    ]);
  });

});
