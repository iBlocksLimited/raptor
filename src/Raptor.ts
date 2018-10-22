import {
  Journey,
  Stop,
  StopTime,
  Time,
  Transfer,
  Trip,
  TripID,
  AnyLeg,
  DateNumber,
  DayOfWeek,
  Service,
  ServiceID
} from "./GTFS";
import {keyValue, indexBy} from "ts-array-utils";

export class Raptor {
  private static readonly DEFAULT_INTERCHANGE_TIME = 0;
  private readonly routeStopIndex: RouteStopIndex = {};
  private readonly routePath: RoutePaths = {};
  private readonly routesAtStop: RoutesIndexedByStop = {};
  private readonly tripsByRoute: TripsIndexedByRoute = {};
  private readonly trips: TripsByID = {};
  private readonly transfers: TransfersByOrigin = {};
  private readonly interchange: Interchange = {};
  private readonly stops: Stop[] = [];
  private readonly services: ServicesByID;

  constructor(trips: Trip[], transfers: TransfersByOrigin, interchange: Interchange, services: Service[]) {
    for (const trip of trips) {
      const path = trip.stopTimes.map(s => s.stop);
      const routeId = path.join(); // add pickup / drop off?

      if (!this.routeStopIndex[routeId]) {
        this.tripsByRoute[routeId] = [];
        this.routeStopIndex[routeId] = {};
        this.routePath[routeId] = path;

        for (let i = path.length - 1; i >= 0; i--) {
          this.routeStopIndex[routeId][path[i]] = i;
          this.transfers[path[i]] = transfers[path[i]] || [];
          this.routesAtStop[path[i]] = this.routesAtStop[path[i]] || [];
          this.interchange[path[i]] = interchange[path[i]] || Raptor.DEFAULT_INTERCHANGE_TIME;

          if (trip.stopTimes[i].pickUp) {
            this.routesAtStop[path[i]].push(routeId);
          }
        }
      }

      this.trips[trip.tripId] = trip;
      this.tripsByRoute[routeId].push(trip.tripId);
    }

    this.stops = Object.keys(this.transfers);
    this.services = services.reduce(indexBy(s => s.serviceId), {});
    // sort trips?
  }

  public plan(origin: Stop, destination: Stop, dateObj: Date): Journey[] {
    const date = this.getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const kArrivals: StopArrivalTimeIndex[] = [];
    const kConnections: ConnectionIndex = this.stops.reduce(keyValue(s => [s, {}]), {}); // perf, predefine + obj assign

    kArrivals[0] = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {}); // perf, predefine + obj assign
    kArrivals[0][origin] = 0;

    for (let k = 1, markedStops = new Set([origin]); markedStops.size > 0; k++) { // perf, set markedStops outside for
      const queue = this.getQueue(markedStops);
      const newMarkedStops = new Set();

      kArrivals[k] = Object.assign({}, kArrivals[k - 1]);

      // examine transfers
      for (const stopP of markedStops) {
        for (const transfer of this.transfers[stopP]) {
          const stopPi = transfer.destination;
          const arrivalTime = kArrivals[k - 1][stopP] + transfer.duration + this.interchange[stopPi];

          if (arrivalTime < kArrivals[k - 1][stopPi]) {
            kArrivals[k][stopPi] = arrivalTime;
            kConnections[stopPi][k] = transfer; // perf, cast k to string?

            newMarkedStops.add(stopPi);
          }
        }
      }

      // examine routes
      for (const [routeId, stopP] of Object.entries(queue)) { // perf, for in?
        let boardingPoint = -1;
        let stops: StopTime[] | undefined = undefined;

        for (let stopPi = this.routeStopIndex[routeId][stopP]; stopPi < this.routePath[routeId].length; stopPi++) {
          const stopPiName = this.routePath[routeId][stopPi];
          const interchange = this.interchange[stopPiName];

          if (stops && stops[stopPi].dropOff && stops[stopPi].arrivalTime + interchange < kArrivals[k][stopPiName]) {
            kArrivals[k][stopPiName] = stops[stopPi].arrivalTime + interchange;
            kConnections[stopPiName][k] = [stops, boardingPoint, stopPi]; // perf, cast k to string?

            newMarkedStops.add(stopPiName);
          }

          if (!stops || kArrivals[k - 1][stopPiName] < stops[stopPi].arrivalTime + interchange) {
            stops = this.getEarliestTrip(routeId, date, dayOfWeek, stopPi, kArrivals[k - 1][stopPiName]);
            boardingPoint = stopPi;
          }
        }
      }

      markedStops = newMarkedStops;
    }

    return this.getResults(kConnections, destination);
  }

  private getDateNumber(date: Date): number {
    const str = date.toISOString();

    return str.slice(0, 4) + str.slice(5, 7) + str.slice(8, 10) as any | 0; // perf, other?
  }

  private getQueue(markedStops: Set<Stop>): RouteQueue {
    const queue = {}; // perf, Map?

    for (const stop of markedStops) {
      for (const routeId of this.routesAtStop[stop]) {
        queue[routeId] = queue[routeId] && this.isStopBefore(routeId, queue[routeId], stop) ? queue[routeId] : stop;
      }
    }

    return queue;
  }

  private isStopBefore(routeId: RouteID, stopA: Stop, stopB: Stop): boolean {
    return this.routeStopIndex[routeId][stopA] < this.routeStopIndex[routeId][stopB];
  }

  private getEarliestTrip(
    routeId: RouteID,
    date: DateNumber,
    dow: DayOfWeek,
    stopIndex: number,
    time: Time
  ): StopTime[] | undefined {

    // perf, paper states these are sorted by departure time and it only needs to search later, but I'm not sure
    for (const tripId of this.tripsByRoute[routeId]) {
      const trip = this.trips[tripId];

      // perf, memoize service running date?
      if (trip.stopTimes[stopIndex].departureTime >= time && this.serviceIsRunning(trip.serviceId, date, dow)) {
        return trip.stopTimes;
      }
    }
  }

  private serviceIsRunning(serviceId: ServiceID, date: DateNumber, dow: DayOfWeek): boolean {
    return !this.services[serviceId].exclude[date] && (this.services[serviceId].include[date] || (
      this.services[serviceId].from <= date &&
      this.services[serviceId].to >= date &&
      this.services[serviceId].days[dow]
    ));
  }

  private getResults(kConnections: ConnectionIndex, destination: Stop): Journey[] {
    const results: any = [];

    for (const k of Object.keys(kConnections[destination])) { // perf, for in?
      results.push({ legs: this.getJourneyLegs(kConnections, k, destination) });
    }

    return results;
  }

  private getJourneyLegs(kConnections: ConnectionIndex, k: any, finalDestination: Stop) {
    const legs: AnyLeg[] = [];

    for (let destination = finalDestination, i = k | 0; i > 0; i--) { // perf, | 0 or Number or parseInt
      const connection = kConnections[destination][i];

      if (isTransfer(connection)) {
        legs.push(connection);

        destination = connection.origin;
      }
      else {
        const [tripStopTimes, start, end] = connection;
        const stopTimes = tripStopTimes.slice(start, end + 1);
        const origin = stopTimes[0].stop;

        legs.push({ stopTimes, origin, destination });

        destination = origin;
      }
    }

    return legs.reverse();
  }
}

function isTransfer(connection: [StopTime[], number, number] | Transfer): connection is Transfer {
  return (connection as Transfer).origin !== undefined;
}

type RouteID = string;
type StopArrivalTimeIndex = Record<Stop, Time>;
type ConnectionIndex = Record<Stop, Record<number, [StopTime[], number, number] | Transfer>>;
type RouteStopIndex = Record<RouteID, Record<Stop, number>>;
type RoutePaths = Record<RouteID, Stop[]>;
type RouteQueue = Record<RouteID, Stop>;
type RoutesIndexedByStop = Record<Stop, RouteID[]>;
type TripsIndexedByRoute = Record<RouteID, TripID[]>;
type TripsByID = Record<TripID, Trip>;
type TransfersByOrigin = Record<Stop, Transfer[]>;
type Interchange = Record<Stop, number>;
type ServicesByID = Record<ServiceID, Service>;
