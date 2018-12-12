import {loadGTFS} from "./gtfs/GTFSLoader";
import {TransferPatternGeneratorFactory} from "./transfer-pattern/TransferPatternGenerator";
import {PatternStringGenerator} from "./transfer-pattern/PatternStringGenerator";
import {TransferPatternRepository} from "./transfer-pattern/TransferPatternRepository";

/**
 * Worker that finds transfer patterns for a given station
 */
async function worker(): Promise<void> {
  const [trips, transfers, interchange, calendars] = await loadGTFS("/home/linus/Downloads/gb-rail-latest.zip");
  let date;
  let raptor;

  const repository = new TransferPatternRepository(getDatabase());

  process.on("message", message => {
    if (message.length > 20) {
      date = new Date(message);
      raptor = TransferPatternGeneratorFactory.create(
        trips,
        transfers,
        interchange,
        calendars,
        date,
        () => new PatternStringGenerator()
      );
    }
    else {
      const results = raptor.create(message, date);

      repository.storeTransferPatterns(results);
    }

    sendToParent();
  });

  process.on("SIGUSR2", () => {
    process.exit();
  });

  sendToParent("date");
}

function sendToParent(message: string = "ready") {
  (process as any).send(message);
}

function getDatabase() {
  return require("mysql2/promise").createPool({
    host: process.env.DATABASE_HOSTNAME || "localhost",
    user: process.env.DATABASE_USERNAME || "root",
    password: process.env.DATABASE_PASSWORD || "",
    database: process.env.OJP_DATABASE_NAME || "ojp",
    connectionLimit: 5,
  });
}
worker().catch(err => {
  console.error(err);
  process.exit();
});