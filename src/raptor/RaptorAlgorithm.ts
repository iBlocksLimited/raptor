import {DayOfWeek, Stop, StopTime, Time, Transfer, Trip} from "../gtfs/GTFS";
import {keyValue} from "ts-array-utils";
import {QueueFactory} from "./QueueFactory";
import {RouteID, RouteScanner} from "./RouteScanner";

/**
 * Implementation of the Raptor journey planning algorithm
 */
export class RaptorAlgorithm {

  constructor(
    private readonly routeStopIndex: RouteStopIndex,
    private readonly routePath: RoutePaths,
    private readonly transfers: TransfersByOrigin,
    private readonly interchange: Interchange,
    private readonly stops: Stop[],
    private readonly queueFactory: QueueFactory
  ) { }

  public scan(
    routeScanner: RouteScanner,
    bestArrivals: Arrivals,
    origin: Stop,
    date: number,
    dow: DayOfWeek,
    time: Time,
    notVias: Stop[]
  ): ConnectionIndex {

    bestArrivals[origin] = time;

    const kArrivals = [Object.assign({}, bestArrivals)];
    const kConnections = this.stops.reduce(keyValue(s => [s, {}]), {});

    for (let k = 1, markedStops = [origin]; markedStops.length > 0; k++) {
      const queue = this.queueFactory.getQueue(markedStops);
      kArrivals[k] = {};

      // examine routes
      for (const [routeId, stopP] of Object.entries(queue)) {
        let boardingPoint = -1;
        let stops: StopTime[] | undefined = undefined;
        let trip: Trip | undefined = undefined;

        for (let pi = this.routeStopIndex[routeId][stopP]; pi < this.routePath[routeId].length; pi++) {
          const stopPi = this.routePath[routeId][pi];
          if (notVias.includes(stopPi)) {
            break;
          }
          const interchange = this.interchange[stopPi];
          const previousPiArrival = kArrivals[k - 1][stopPi];

          if (stops && stops[pi].dropOff && stops[boardingPoint].pickUp
              && stops[pi].arrivalTime + interchange < bestArrivals[stopPi]) {
            kArrivals[k][stopPi] = bestArrivals[stopPi] = stops[pi].arrivalTime + interchange;
            kConnections[stopPi][k] = [trip, boardingPoint, pi];
          }
          else if (previousPiArrival && (!stops || ((previousPiArrival < stops[pi].arrivalTime + interchange)
              && stops[pi].pickUp))) {
            trip = routeScanner.getTrip(routeId, date, dow, pi, previousPiArrival);
            stops = trip && trip.stopTimes;
            boardingPoint = pi;
          }
        }
      }

      // examine transfers
      for (const stopP of markedStops) {
        for (const transfer of this.transfers[stopP]) {
          const stopPi = transfer.destination;
          if (notVias.includes(stopPi)) {
              continue;
          }

          const arrival = kArrivals[k - 1][stopP] + transfer.duration + this.interchange[stopPi];

          if (transfer.startTime <= arrival && transfer.endTime >= arrival && arrival < bestArrivals[stopPi]) {
            kArrivals[k][stopPi] = bestArrivals[stopPi] = arrival;
            let interchanges = {
              originInterchange: this.interchange[stopP],
              destinationInterchange: this.interchange[stopPi]
            };
            kConnections[stopPi][k] = Object.assign({}, transfer, interchanges);
          }
        }
      }

      markedStops = Object.keys(kArrivals[k]);
    }

    return kConnections;
  }

   /**
    * Perform a scan of the routes for a given range
    */
  public scanRange(
    routeScanner: RouteScanner,
    bestArrivals: Arrivals,
    origin: Stop,
    date: number,
    dow: DayOfWeek,
    time: Time,
    notVias: Stop[],
    destination?: Stop,
    kArrivals: Arrivals[] = [Object.assign({}, bestArrivals)],
  ): ConnectionIndex {

    bestArrivals[origin] = time;
    kArrivals[0][origin] = time;
    const kConnections = this.stops.reduce(keyValue(s => [s, {}]), {});

    for (let k = 1, markedStops = [origin]; markedStops.length > 0; k++) {
      const queue = this.queueFactory.getQueue(markedStops);
      let improvedStops: string[] = [];
      if (!kArrivals[k] || Object.keys(kArrivals[k]).length === 0 ) {
        kArrivals[k] = {};
      }

      for (let stop in kArrivals[k - 1]) {
        kArrivals[k][stop] = !kArrivals[k][stop] || kArrivals[k - 1][stop] <= kArrivals[k][stop]
                                ? kArrivals[k - 1][stop]
                                : kArrivals[k][stop];
      }

      // examine routes
      for (const [routeId, stopP] of Object.entries(queue)) {
        let boardingPoint = -1;
        let stops: StopTime[] | undefined = undefined;
        let trip: Trip | undefined = undefined;

        for (let pi = this.routeStopIndex[routeId][stopP]; pi < this.routePath[routeId].length; pi++) {
          const stopPi = this.routePath[routeId][pi];

          if (notVias.includes(stopPi)) {
              break;
          }

          const interchange = this.interchange[stopPi];
          const previousPiArrival = kArrivals[k - 1][stopPi];

          const bestDestinationArrival = destination ? kArrivals[k][destination] : Number.MAX_SAFE_INTEGER;

          const minimumArrival = Math.min(kArrivals[k][stopPi], bestDestinationArrival);

          if (
              stops
              && stops[pi].dropOff
              && stops[boardingPoint].pickUp
              && stops[pi].arrivalTime + interchange < minimumArrival
            ) {
            kArrivals[k][stopPi] = bestArrivals[stopPi] = stops[pi].arrivalTime + interchange;
            kConnections[stopPi][k] = [trip, boardingPoint, pi];
            improvedStops.push(stopPi);
          }
          else if (previousPiArrival && (!stops || (previousPiArrival < stops[pi].arrivalTime + interchange))) {
            trip = routeScanner.getTrip(routeId, date, dow, pi, previousPiArrival);
            stops = trip && trip.stopTimes;
            boardingPoint = pi;
          }
        }
      }

      // examine transfers
      for (const stopP of markedStops) {
        for (const transfer of this.transfers[stopP]) {
          const stopPi = transfer.destination;

          if (notVias.includes(stopPi)) {
              continue;
          }

          const arrival = kArrivals[k - 1][stopP] + transfer.duration + this.interchange[stopPi];

          if (transfer.startTime <= arrival && transfer.endTime >= arrival && arrival < bestArrivals[stopPi]) {
            kArrivals[k][stopPi] = bestArrivals[stopPi] = arrival;
            let interchanges = {
              originInterchange: this.interchange[stopP],
              destinationInterchange: this.interchange[stopPi]
            };
            kConnections[stopPi][k] = Object.assign({}, transfer, interchanges);
            improvedStops.push(stopPi);
          }
        }
      }

      markedStops = improvedStops;
    }

    return kConnections;
  }

}

export function getDateNumber(date: Date): number {

  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  };
  const str = new Intl.DateTimeFormat("en-GB", options).format(date);

  return parseInt(str.slice(6, 10) + str.slice(0, 2) + str.slice(3, 5), 10);
}

export type RouteStopIndex = Record<RouteID, Record<Stop, number>>;
export type RoutePaths = Record<RouteID, Stop[]>;
export type Interchange = Record<Stop, Time>;
export type TransfersByOrigin = Record<Stop, Transfer[]>;
export type Arrivals = Record<Stop, Time>;
export type Connection = [Trip, number, number];
export type ConnectionIndex = Record<Stop, Record<number, Connection | Transfer>>;
