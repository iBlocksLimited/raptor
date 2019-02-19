import {getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {ResultsFactory} from "../results/ResultsFactory";
import {DayOfWeek, Stop, Time} from "../gtfs/GTFS";
import {keyValue} from "ts-array-utils";
import {RouteScannerFactory} from "./RouteScanner";

/**
 * Use the Raptor algorithm to generate a full day of results.
 */
export class RaptorTimeRangeQuery<T> {

  constructor(
    private readonly raptor: RaptorAlgorithm,
    private readonly stops: Stop[],
    private readonly routeScannerFactory: RouteScannerFactory,
    private readonly departureTimesAtStop: Record<Stop, Time[]>,
    private readonly resultsFactory: ResultsFactory<T>
  ) {}

  /**
   * Perform a range query on the given date
   */
  public plan(origin: Stop, destination: Stop, dateObj: Date, startRange: Date, endRange: Date): T[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {});
    const routeScanner = this.routeScannerFactory.create();
    const preFilteredTimes = this.departureTimesAtStop[origin];
    
    const midnight = this.getMidnight(startRange);
    const startSeconds = (startRange.valueOf() - midnight.valueOf()) / 1000;
    const endSeconds = (endRange.valueOf() - midnight.valueOf()) / 1000;
    console.log("Searching from ", startSeconds);
    console.log("until ", endSeconds);
    
    const times = preFilteredTimes.filter(s => (s >= startSeconds && s < endSeconds));

    return times.reduce((results, time) => {
      const kConnections = this.raptor.scan(routeScanner, bestArrivals, origin, date, dayOfWeek, time);
      const journeys = this.resultsFactory.getResults(kConnections, destination, dateObj, time);
        
      return results.concat(journeys);
    }, [] as T[]).reverse();
  }

  public getMidnight(date: Date): Date {
    let midnight = new Date(date);
    midnight.setHours(0);
    midnight.setMinutes(0);
    midnight.setSeconds(0);
    midnight.setMilliseconds(0);
    return midnight;
  }
}
