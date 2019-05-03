/**
 * StopID e.g. NRW
 */
export type Stop = string;

/**
 * Time in seconds since midnight (note this may be greater than 24 hours).
 */
export type Time = any;

/**
 * Duration in seconds
 */
export type Duration = number;

/**
 * GTFS stop time
 */
export interface StopTime {
  stop: Stop;
  arrivalTime: Time;
  departureTime: Time;
  pickUp: boolean;
  dropOff: boolean;
}

/**
 * Leg of a journey
 */
export interface Leg {
  origin: Stop;
  destination: Stop;
}

/**
 * Leg with a defined departure and arrival time
 */
export interface TimetableLeg extends Leg {
  stopTimes: StopTime[];
  trip?: Trip;
  trainUid?: TrainUID;
}

/**
 * Leg with a duration instead of departure and arrival time
 */
export interface Transfer extends Leg {
  duration: Duration;
  startTime: Time;
  endTime: Time;
  originInterchange?: Time;
  destinationInterchange?: Time;
}

/**
 * A leg
 */
export type AnyLeg = Transfer | TimetableLeg;

/**
 * A journey is a collection of legs
 */
export interface Journey {
  legs: AnyLeg[];
}

/**
 * GTFS trip_id
 */
export type TripID = string;

/**
 * GTFS service_id, used to determine the trip's calendar
 */
export type ServiceID = string;

/**
 * Add a representation from the train UID
 */
export type TrainUID = string;

/**
 * GTFS trip
 */
export interface Trip {
  tripId: TripID;
  stopTimes: StopTime[];
  serviceId: ServiceID;
  trainUid?: TrainUID;
}

/**
 * Date stored as a number, e.g 20181225
 */
export type DateNumber = number;

/**
 * Index of dates, used to access exclude/include dates in O(1) time
 */
export type DateIndex = Record<DateNumber, boolean>;

/**
 * Sunday = 0, Monday = 1... don't blame me, blame JavaScript .getDay
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * GTFS calendar
 */
export interface Calendar {
  serviceId: ServiceID;
  startDate: DateNumber;
  endDate: DateNumber;
  days: Record<DayOfWeek, boolean>;
  exclude: DateIndex;
  include: DateIndex;
}

/**
 * Calendars indexed by service ID
 */
export type CalendarIndex = Record<ServiceID, Calendar>;
