import * as cp  from "child_process";
import * as ProgressBar from "progress";
import {loadGTFS} from "./gtfs/GTFSLoader";
import {RaptorQueryFactory} from "./raptor/RaptorQueryFactory";
import {logger} from "./logger";

const numCPUs = require("os").cpus().length;

export async function run(filename: string) {

  const date = new Date();
  const [trips, transfers, interchange, calendars] = await loadGTFS(filename);
  const {stops} = RaptorQueryFactory.create(trips, transfers, interchange, calendars, date);
  const bar = new ProgressBar("  [:current of :total] [:bar] :percent eta :eta  ", { total: stops.length });

  for (let i = 0; i < Math.min(numCPUs - 1, stops.length); i++) {
    const worker = cp.fork(__dirname + "/transfer-pattern-worker", [filename, date.toISOString()]);

    worker.on("message", () => {
      if (stops.length > 0) {
        bar.tick();

        worker.send(stops.pop());
      }
      else {
        worker.kill("SIGUSR2");
      }
    });

  }

}

if (process.argv[2]) {
  logger.info("I think this runs?");
  run(process.argv[2]).catch(e => logger.error(e));
}
else {
  logger.info("Please specify a GTFS file.");
}
