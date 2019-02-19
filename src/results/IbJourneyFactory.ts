import {
  AnyLeg,
  Journey,
  Stop,
  StopTime,
  Trip,
  TrainUID,
  Time,
  Transfer,
  Leg
} from "../gtfs/GTFS";
import {isTransfer, ResultsFactory} from "./ResultsFactory";
import {ConnectionIndex} from "../raptor/RaptorAlgorithm";

interface IbJourney {
  legs: IbResult[];
}

interface TimeTableCacheLeg extends Leg {
  origin: Stop;
  destination: Stop;
  departureTime: Time;
  arrivalTime: Time;
  originTrainUid?: TrainUID;
  destinationTrainUid?: TrainUID;
  stopTimes?: StopTime[];
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
    startDate: Date,
    currentTime: Date
  ): IbJourney[] {
    const results: IbJourney[] = [];

    for (const k of Object.keys(kConnections[destination])) {
      results.push({
        legs: this.getJourneyLegs(
          kConnections,
          k,
          destination,
          startDate,
          currentTime
        )
      });
    }
    return results.filter(
      r =>
        (r.legs[0] as TimeTableCacheLeg).departureTime.valueOf() <=
        startDate.valueOf() + currentTime.valueOf() * 1000
    );
  }

  /**
   * Iterator back through each connection and build up a series of legs to create the journey
   */
  private getJourneyLegs(
    kConnections: ConnectionIndex,
    k: string,
    finalDestination: Stop,
    startDate: Date,
    currentTime: Date
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

        let [originTrainUid, destinationTrainUid] = this.formatTrainUid(
          trip.trainUid
        );
        legs.push({
          departureTime,
          arrivalTime,
          origin,
          destination,
          originTrainUid,
          destinationTrainUid
        });

        destination = origin;
      }
    }

    let journeyLegs = legs.reverse();

    // If the leg starts with a transfer, set the time to be the search time?
    if ("duration" in journeyLegs[0]) {
      let original = journeyLegs[0];
      let departureTime = new Date(
        startDate.valueOf() + currentTime.valueOf() * 1000
      );
      let arrivalTime = new Date(
        departureTime.valueOf() + (<any>original).duration * 1000
      );
      journeyLegs[0] = {
        origin: original.origin,
        destination: original.destination,
        originTrainUid: "",
        destinationTrainUid: "",
        departureTime: departureTime,
        arrivalTime: arrivalTime
      };
    }

    for (let i = 1; i < journeyLegs.length; i++) {
      if ("duration" in journeyLegs[i]) {
        let original = journeyLegs[i];
        let departureTime = (<any>journeyLegs[i - 1]).arrivalTime;
        let arrivalTime = new Date(
          departureTime.valueOf() + (<any>original).duration * 1000
        );
        journeyLegs[i] = {
          origin: original.origin,
          destination: original.destination,
          originTrainUid: "",
          destinationTrainUid: "",
          departureTime: departureTime,
          arrivalTime: arrivalTime
        };
      }
    }

    return journeyLegs;
  }

  formatTrainUid(trainUid) {
    let trainUids = trainUid.split("_");
    let first = trainUids.shift();
    let last = trainUids.pop() || first;
    return [first, last];
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
