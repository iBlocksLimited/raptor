import * as raptor from "./index";
import * as allRuns from "./transfer-patterns";
import {JourneyFactory, RaptorQueryFactory} from "./index";
import { IbJourneyFactory } from "./results/IbJourneyFactory";
const express = require("express");
let loadingNetwork = raptor.loadGTFS(process.argv[2]);

// if (process.argv[2]) {
//     allRuns.run(process.argv[2]).then((x) => console.log(x));
// } else {
//   console.log("Please specify a GTFS file.");
// }
let app = express();

let hcApp = express();

const port = 3000;
const hcPort = 3001;
hcApp.get("", (req, res) => res.send("ok"));

loadingNetwork.then(([trips, transfers, interchange, calendars]) => {
  const resultsFactory = new IbJourneyFactory();
  const detailedResultsFactory = new JourneyFactory();
  console.log(new Date());
  const query = RaptorQueryFactory.createTimeRangeQuery(
    trips,
    transfers,
    interchange,
    calendars,
    resultsFactory
  );

  const singleLookup = RaptorQueryFactory.createDepartAfterQuery(
    trips,
    transfers,
    interchange,
    calendars,
    detailedResultsFactory
  );

  const detailedQuery = RaptorQueryFactory.createTimeRangeQuery(
    trips,
    transfers,
    interchange,
    calendars,
    detailedResultsFactory
  );
  console.log(new Date());
  app.get("/", (req, res, next) => {
    console.log(req.query);
    const orig = req.query.orig;
    const dest = req.query.dest;
    
    const startDate = new Date(req.query.startDate);
    const endDate = new Date(req.query.endDate);
    const searchDate = getMidnight(startDate.toISOString());
    console.log(orig, dest, searchDate, startDate, endDate);

    const journeys = query.plan(orig, dest, searchDate, startDate, endDate);
    res.send(journeys);
  });
  app.get("/detail", (req, res, next) => {
    console.log(req.query);
    const orig = req.query.orig;
    const dest = req.query.dest;
    
    const startDate = new Date(req.query.startDate);
    const endDate = new Date(req.query.endDate);
    const searchDate = getMidnight(startDate.toISOString());
    console.log(orig, dest, searchDate, startDate, endDate);

    const journeys = detailedQuery.plan(orig, dest, searchDate, startDate, endDate);
    res.send(journeys);
  });

  app.get("/first-arrival", (req, res, next) => {
    console.log(req.query);
    const orig = req.query.orig;
    const dest = req.query.dest;

    const startDate = new Date(req.query.startDate);
    const notVia = req.query.notVia;
    const searchDate = getMidnight(startDate.toISOString());
    console.log("Single lookup", orig, dest, searchDate, startDate, notVia);
    const midnight = getMidnight(startDate.toISOString());
    const startSeconds = (startDate.valueOf() - midnight.valueOf()) / 1000;

    const journeys = singleLookup.plan(orig, dest, searchDate, startSeconds, notVia);
    res.send(journeys);
  });

  hcApp.listen(hcPort, () => console.log(`Health check is on port ${hcPort}!`));
  app.listen(port, () => console.log(`Example app listening on port ${port}!`));
});

function getMidnight(date: string): Date {
  let midnight = new Date(date);
  midnight.setHours(0);
  midnight.setMinutes(0);
  midnight.setSeconds(0);
  midnight.setMilliseconds(0);
  return midnight;
}
