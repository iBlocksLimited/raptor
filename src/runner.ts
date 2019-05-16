import * as raptor from "./index";
import * as allRuns from "./transfer-patterns";
import {JourneyFactory, RaptorQueryFactory, Stop} from "./index";
import { IbJourneyFactory } from "./results/IbJourneyFactory";
import { SmJourneyFactory } from "./results/SmJourneyFactory";
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
app.get("/healthcheck", (req, res) => res.send("ok"));
hcApp.get("", (req, res) => res.send("ok"));

loadingNetwork.then(([trips, transfers, interchange, calendars]) => {
  const resultsFactory = new IbJourneyFactory();
  const detailedResultsFactory = new SmJourneyFactory();
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

    const notVias = req.query.notVia ? req.query.notVia : [];
    if (!validateNotVias(notVias, orig, dest)) {
        sendInvalidNotViasMessage(res, notVias, orig, dest);
        return;
    }

    console.log(orig, dest, searchDate, startDate, endDate, notVias);

    const journeys = query.plan(orig, dest, searchDate, startDate, endDate, notVias);
    res.send(journeys);
  });
  app.get("/detail", (req, res, next) => {
    console.log(req.query);
    const orig = req.query.orig;
    const dest = req.query.dest;
    
    const startDate = new Date(req.query.startDate);
    const endDate = new Date(req.query.endDate);
    const searchDate = getMidnight(startDate.toISOString());

    const notVias = req.query.notVia ? req.query.notVia : [];
    if (!validateNotVias(notVias, orig, dest)) {
        sendInvalidNotViasMessage(res, notVias, orig, dest);
        return;
    }

    console.log(orig, dest, searchDate, startDate, endDate, notVias);

    const journeys = detailedQuery.plan(orig, dest, searchDate, startDate, endDate, notVias);
    res.send(journeys);
  });

  app.get("/first-arrival", (req, res, next) => {
    console.log(req.query);
    const orig = req.query.orig;
    const dest = req.query.dest;

    const startDate = new Date(req.query.startDate);

    const notVias = req.query.notVia ? req.query.notVia : [];
    if (!validateNotVias(notVias, orig, dest)) {
        sendInvalidNotViasMessage(res, notVias, orig, dest);
        return;
    }

    const searchDate = getMidnight(startDate.toISOString());
    console.log("Single lookup", orig, dest, searchDate, startDate, notVias);
    const midnight = getMidnight(startDate.toISOString());
    const startSeconds = (startDate.valueOf() - midnight.valueOf()) / 1000;

    const journeys = singleLookup.plan(orig, dest, searchDate, startSeconds, notVias);
    res.send(journeys);
  });

  app.listen(port, () => console.log(`Raptor listening on port ${port}!`));
  hcApp.listen(hcPort, () => console.log(`Health check is on port ${hcPort}!`));
});

/**
 * Checks that the not vias do not include the origin and destination stops.
 *
 * @param notVias the list of not vias
 * @param origin the origin CRS code
 * @param destination the destination CRS code
 * @return true if neither are included, false if one or both are.
 */
function validateNotVias(notVias: Stop[], origin: Stop, destination: Stop): boolean {
    return !(notVias.includes(origin) || notVias.includes(destination));

}

function sendInvalidNotViasMessage(res: any, notVias: Stop[], origin: Stop, destination: Stop) {
    const preMessage = notVias.includes(origin) ? "Origin: " + origin : "Destination: " + destination;
    const message = preMessage + " in not via list: " + notVias;
    sendBadRequestMessage(message, res);
}

function sendBadRequestMessage(message: string, res: any) {
    res.status(400).send(message);
    console.log(message);
}

class InvalidNotViaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidNotVia";
    }
}

function getMidnight(date: string): Date {
  let midnight = new Date(date);
  midnight.setHours(0);
  midnight.setMinutes(0);
  midnight.setSeconds(0);
  midnight.setMilliseconds(0);
  return midnight;
}
