import {getDateNumber, RaptorAlgorithm} from "./RaptorAlgorithm";
import {ResultsFactory} from "../results/ResultsFactory";
import {DayOfWeek, Stop, Time} from "../gtfs/GTFS";
import {keyValue} from "ts-array-utils";
import {RouteScannerFactory} from "./RouteScanner";
import {logger} from "../logger";

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
  public plan(origin: Stop,
              destination: Stop,
              dateObj: Date,
              startRange: Date,
              endRange: Date,
              notVias: Stop[] = []): T[] {
    const date = getDateNumber(dateObj);
    const dayOfWeek = dateObj.getDay() as DayOfWeek;
    const preFilteredTimes = this.departureTimesAtStop[origin];

    const midnight = this.getMidnight(startRange);
    const startSeconds = (startRange.valueOf() - midnight.valueOf()) / 1000;
    const endSeconds = (endRange.valueOf() - midnight.valueOf()) / 1000;
    logger.debug("Searching from %d seconds until %d seconds", startSeconds, endSeconds);
    
    const times = preFilteredTimes.filter(s => (s >= startSeconds && s < endSeconds));
    const kArrivals = [
      this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER - 1]), {}),
      this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER]), {})
    ];

    return times.reduce((results, time) => {
      const bestArrivals = this.stops.reduce(keyValue(s => [s, Number.MAX_SAFE_INTEGER - 1]), {});
      const routeScanner = this.routeScannerFactory.create();
      const kConnections = this.raptor.scanRange(routeScanner,
                                                 bestArrivals,
                                                 origin,
                                                 date,
                                                 dayOfWeek,
                                                 time,
                                                 notVias,
                                                 destination,
                                                 kArrivals);
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
