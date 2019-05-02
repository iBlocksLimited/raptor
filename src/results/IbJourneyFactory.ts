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
      if (parseInt(k, 10) < 5) {
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
      const connection: [Trip, number, number] | Transfer = kConnections[destination][i];

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
        let tripCopy = <Trip> Object.assign({}, trip, {stopTimes: stopTimeCopy});
        const stopTimes = tripCopy.stopTimes.slice(start, end + 1);

        const origin = stopTimes[0].stop;

        let departureTime = stopTimes[0].departureTime;
        let arrivalTime = stopTimes[stopTimes.length - 1].arrivalTime;

        let leg = {
          departureTime,
          arrivalTime,
          origin,
          destination
        };
        if (trip.trainUid) {
          let [originTrainUid, destinationTrainUid] = this.formatTrainUid(trip.trainUid);
          Object.assign(leg, {originTrainUid, destinationTrainUid});
        }
        legs.push(leg);

        destination = origin;
      }
    }

    let journeyLegs = legs.reverse();

    // If the leg starts with a transfer, set the time to be the search time?
    let originalStartLeg = journeyLegs[0];
    if (this.isTransfer(originalStartLeg)) {
      let departureTime = new Date(startDate.valueOf() + currentTime.valueOf() * 1000);
      let arrivalTime = new Date(departureTime.valueOf() + originalStartLeg.duration * 1000);
      journeyLegs[0] = {
        origin: originalStartLeg.origin,
        destination: originalStartLeg.destination,
        originTrainUid: "",
        destinationTrainUid: "",
        departureTime: departureTime,
        arrivalTime: arrivalTime
      };
    }

    for (let i = 1; i < journeyLegs.length; i++) {
      let originalLeg = journeyLegs[i];
      if (this.isTransfer(originalLeg)) {
        let previousLeg = journeyLegs[i - 1];
        if (this.isTransfer(previousLeg)) {
          throw new Error("RAPTOR should not return 2 transfers in a row.");
        }
        let departureTime = new Date(previousLeg.arrivalTime.valueOf() + originalLeg.interchange * 1000);
        let arrivalTime = new Date(departureTime.valueOf() + originalLeg.duration * 1000);
        journeyLegs[i] = {
          origin: originalLeg.origin,
          destination: originalLeg.destination,
          originTrainUid: "",
          destinationTrainUid: "",
          departureTime: departureTime,
          arrivalTime: arrivalTime
        };
      }
    }

    return journeyLegs;
  }

  private isTransfer(leg: TimeTableCacheLeg | Transfer): leg is Transfer {
    return "duration" in leg;
  }

  formatTrainUid(trainUid: TrainUID): [TrainUID, TrainUID] {
    let trainUids: TrainUID[] = trainUid.split("_");
    let first = trainUids[0];
    let last = trainUids[trainUids.length - 1];
    return [first, last];
  }

  public transformStop(stop: StopTime, startDate: Date): StopTime {
    let startMillis = startDate.valueOf();
    let arrivalDate = new Date(stop.arrivalTime * 1000 + startMillis);
    let departureDate = new Date(stop.departureTime * 1000 + startMillis);

    return {
      arrivalTime: arrivalDate,
      departureTime: departureDate,
      dropOff: stop.dropOff,
      pickUp: stop.pickUp,
      stop: stop.stop
    };
  }
}
