import {
    AnyLeg,
    Journey,
    Leg,
    ServiceID,
    Stop,
    StopTime,
    TrainUID,
    Trip,
    TripID,
    Time,
    Transfer
} from "../gtfs/GTFS";
import {isTransfer, ResultsFactory} from "./ResultsFactory";
import {ConnectionIndex} from "../raptor/RaptorAlgorithm";

export interface SmJourney {
    origin: Stop;
    destination: Stop;
    legs: SmLeg[];
}

export interface SmRailLeg {
    type: "RAIL_LEG";
    origin: Stop;
    destination: Stop;
    departureTime: Date;
    arrivalTime: Date;
    originTrainUid?: TrainUID;
    destinationTrainUid?: TrainUID;
    trainTrip: TrainTrip;
    startIndex: Number;
    endIndex: Number;
}

export interface TrainTrip {
    tripId: TripID;
    stopTimes: StopDateTime[];
    serviceId: ServiceID;
    trainUid?: TrainUID;
}

export interface StopDateTime {
    stop: Stop;
    arrivalTime: Date;
    departureTime: Date;
    pickUp: boolean;
    dropOff: boolean;
}

export interface SmTransferLeg {
    type: "FIXED_LEG";
    origin: Stop;
    destination: Stop;
    durationSeconds: number;
    originInterchange: number;
    destinationInterchange: number;
}

export type SmLeg = SmRailLeg | SmTransferLeg;

interface EndpointTrainUids {
    originTrainUid: TrainUID;
    destinationTrainUid: TrainUID;
}

export class SmJourneyFactory implements ResultsFactory<SmJourney> {
    constructor() {}

    public getResults(
        kConnections: ConnectionIndex,
        destination: Stop,
        startDate: Date,
        currentSearchTime?: Time
    ): SmJourney[] {
        const results: SmJourney[] = [];
        let currentIterDateMillis: number | undefined = undefined;
        if (currentSearchTime !== undefined) {
            currentIterDateMillis = startDate.valueOf() + currentSearchTime * 1000;
        }

        for (const k of Object.keys(kConnections[destination])) {
            let foo = kConnections[k];
            if (parseInt(k, 10) < 5) {
                const legs = this.getJourneyLegs(
                    kConnections,
                    k,
                    destination,
                    startDate,
                    currentSearchTime
                );
                let firstLeg = legs[0];
                let firstLegDeparture: Date;
                if (currentIterDateMillis === undefined
                    || this.isTransferLeg(firstLeg)
                    || firstLeg.departureTime.valueOf() <= currentIterDateMillis) {
                    results.push({
                        legs: legs,
                        origin: firstLeg.origin,
                        destination: destination,
                    });
                }
            }
        }
        return results;
    }

    private getJourneyLegs(
        kConnections: ConnectionIndex,
        k: string,
        finalDestination: Stop,
        startDate: Date,
        currentSearchTime: Time
    ): SmLeg[] {
        const legs: SmLeg[] = [];

        let previousOrigin: Stop = finalDestination;
        for (let i = parseInt(k, 10); i > 0; i--) {
            const connection: [Trip, number, number] | Transfer = kConnections[previousOrigin][i];

            if (isTransfer(connection)) {
                let leg: SmTransferLeg = {
                    type: "FIXED_LEG",
                    origin: connection.origin,
                    destination: connection.destination,
                    durationSeconds: connection.duration,
                    originInterchange: connection.originInterchange,
                    destinationInterchange: connection.destinationInterchange
                };
                legs.push(leg);
                previousOrigin = connection.origin;
            } else {
                const [trip, startIndex, endIndex]: [Trip, number, number] = connection;
                const origin: Stop = trip.stopTimes[startIndex].stop;
                const destination: Stop = trip.stopTimes[endIndex].stop;
                const departureTimeSec: number = trip.stopTimes[startIndex].departureTime;
                const arrivalTimeSec: number = trip.stopTimes[endIndex].arrivalTime;
                const departureTime: Date = this.toDate(startDate, departureTimeSec);
                const arrivalTime: Date = this.toDate(startDate, arrivalTimeSec);
                const trainTrip: TrainTrip = this.toTrainTrip(trip, startDate);
                let leg: SmRailLeg = {
                    type: "RAIL_LEG",
                    origin,
                    destination,
                    departureTime,
                    arrivalTime,
                    trainTrip,
                    startIndex,
                    endIndex
                };
                if (trip.trainUid) {
                    Object.assign(leg, this.getEndpointTrainUids(trip.trainUid));
                }
                legs.push(leg);
                previousOrigin = origin;
            }
        }
        return legs.reverse();
    }

    private isTransferLeg(leg: SmLeg): leg is SmTransferLeg {
        return leg.type === "FIXED_LEG";
    }

    private toDate(midnight: Date, secondsSinceMidnight: number): Date {
        return new Date(midnight.valueOf() + secondsSinceMidnight * 1000);
    }

    private getEndpointTrainUids(uid: TrainUID): EndpointTrainUids {
        let uidList = uid.split("_");
        return {
            originTrainUid: uidList[0],
            destinationTrainUid: uidList[uidList.length - 1]
        };
    }

    private toTrainTrip(trip: Trip, startDate: Date): TrainTrip {
        const stopTimes: StopDateTime[] = trip.stopTimes.map(st => this.toStopDateTime(st, startDate));
        return Object.assign({}, trip, {stopTimes});
    }

    private toStopDateTime(stopTime: StopTime, startDate: Date): StopDateTime {
        return Object.assign({}, stopTime, {
            arrivalTime: this.toDate(startDate, stopTime.arrivalTime),
            departureTime: this.toDate(startDate, stopTime.departureTime)
        });
    }
}
