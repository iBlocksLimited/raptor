import {AnyLeg, Journey, Stop, StopTime, Trip, TrainUID, Time, Transfer} from "../gtfs/GTFS";
import {isTransfer, ResultsFactory} from "./ResultsFactory";
import {ConnectionIndex} from "../raptor/RaptorAlgorithm";


interface IbJourney {
    legs: IbResult[]
}

type TimeTableCacheLeg = {
    origin: Stop,
    destination: Stop,
    departureTime: Time,
    arrivalTime: Time,
    trainUid?: TrainUID,
}

type IbResult = TimeTableCacheLeg | Transfer;

/**
 * Extracts journeys from the kConnections index.
 */
export class IbJourneyFactory implements ResultsFactory<IbJourney> {
  constructor() {}

  /**
   * Take the best result of each round for the given destination and turn it into a journey.
   */
  public getResults(
    kConnections: ConnectionIndex,
    destination: Stop,
    startDate: Date
  ): IbJourney[] {
    const results: IbJourney[] = [];

    for (const k of Object.keys(kConnections[destination])) {
      results.push({
        legs: this.getJourneyLegs(kConnections, k, destination, startDate)
      });
    }

    return results;
  }

  /**
   * Iterator back through each connection and build up a series of legs to create the journey
   */
  private getJourneyLegs(
    kConnections: ConnectionIndex,
    k: string,
    finalDestination: Stop,
    startDate: Date
  ): IbResult[] {
    const legs: IbResult[] = [];

    for (let destination = finalDestination, i = parseInt(k, 10); i > 0; i--) {
      const connection = kConnections[destination][i];

      if (isTransfer(connection)) {
        let connectionWithMinutes = Object.assign({}, connection, {
          durationMinutes: connection.duration / 60
        });
        legs.push(connectionWithMinutes);

        destination = connection.origin;
      } else {
        const [trip, start, end] = connection;
        let stopTimeCopy = [...trip.stopTimes].map(stop =>
          this.transformStop(stop, startDate)
        );
        let tripCopy = <Trip>Object.assign({}, trip, {stopTimes: stopTimeCopy});
        const stopTimes = tripCopy.stopTimes.slice(start, end + 1);

        const origin = stopTimes[0].stop;

        let departureTime = stopTimes[0].departureTime;
        let arrivalTime = stopTimes[stopTimes.length - 1].arrivalTime;

        legs.push({departureTime, arrivalTime, origin, destination, trainUid: trip.trainUid});

        destination = origin;
      }
    }

    return legs.reverse();
  }

  public transformStop(stop: StopTime, startDate: Date) {
    let startMillis = startDate.valueOf();
    let arrivalDate = new Date(<number>stop.arrivalTime * 1000 + startMillis);
    let departureDate = new Date(
      <number>stop.departureTime * 1000 + startMillis
    );

    return <StopTime>{
      arrivalTime: arrivalDate,
      departureTime: departureDate,
      dropOff: stop.dropOff,
      pickUp: stop.pickUp,
      stop: stop.stop
    };
  }
}
