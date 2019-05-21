import {CalendarIndex, DateNumber, DayOfWeek, ServiceID, Time, Trip} from "../gtfs/GTFS";

/**
 * Returns trips for specific routes. Maintains a reference to the last trip returned in order to reduce scan time.
 */
export class RouteScanner {

  constructor(
    private readonly tripsByRoute: TripsIndexedByRoute,
    private readonly calendars: CalendarIndex,
    private routeScanPosition: Record<RouteID, number>
  ) {}

  /**
   * Return the earliest trip stop times possible on the given route
   */
  public getTrip(
    routeId: RouteID,
    date: DateNumber,
    dow: DayOfWeek,
    stopIndex: number,
    time: Time
  ): Trip | undefined {

    if (!this.routeScanPosition.hasOwnProperty(routeId)) {
      this.routeScanPosition[routeId] = this.tripsByRoute[routeId].length - 1;
    }

    let lastFound = -1;

    for (let i = this.routeScanPosition[routeId]; i >= 0; i--) {
      const trip = this.tripsByRoute[routeId][i];

      if (trip.stopTimes[stopIndex].departureTime < time) {
        break;
      }
      else if (this.serviceIsRunning(trip.serviceId, date, dow) && trip.stopTimes[stopIndex].pickUp) {
        lastFound = i;
      }
    }

    if (lastFound > -1) {
      this.routeScanPosition[routeId] = lastFound;

      return this.tripsByRoute[routeId][lastFound];
    }
  }

  protected serviceIsRunning(serviceId: ServiceID, date: DateNumber, dow: DayOfWeek): boolean {
    return !this.calendars[serviceId].exclude[date] && (this.calendars[serviceId].include[date] || (
      this.calendars[serviceId].startDate <= date &&
      this.calendars[serviceId].endDate >= date &&
      this.calendars[serviceId].days[dow]
    ));
  }
}

/**
 * Remove the check to see if a service is running on a particular day
 */
class RouteScannerNoFilter extends RouteScanner {

  protected serviceIsRunning(): boolean {
    return true;
  }

}

/**
 * Create the RouteScanner from GTFS trips and calendars
 */
export class RouteScannerFactory {

  constructor(
    private readonly tripsByRoute: TripsIndexedByRoute,
    private readonly calendars: CalendarIndex | false
  ) {}

  public create(): RouteScanner {
    return this.calendars
      ? new RouteScanner(this.tripsByRoute, this.calendars, {})
      : new RouteScannerNoFilter(this.tripsByRoute, {}, {});
  }

}

export type RouteID = string;
export type TripsIndexedByRoute = Record<RouteID, Trip[]>;
