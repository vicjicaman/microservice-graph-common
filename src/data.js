import * as Utils from "@nebulario/microservice-utils";

export const connect = async ({ mongoose, url }) => {
  let db = null;
  let connected = false;

  while (!connected) {
    try {
      console.log("Connect to data service...");
      const db = mongoose.connect("mongodb://" + url, {
        useNewUrlParser: true,
        reconnectTries: 3,
        reconnectInterval: 100
      });

      mongoose.connection.on("disconnected", () => {
        console.log("-> lost connection");
      });
      mongoose.connection.on("reconnect", () => {
        console.log("-> reconnected");
      });
      mongoose.connection.on("connected", () => {
        console.log("-> connected");
      });
      mongoose.connection.on("reconnectFailed", () => {
        console.log("-> gave up reconnecting");
        process.exit(17);
      });
      connected = true;
    } catch (e) {
      console.log("DATA_ERROR:  " + e.toString());
      await Utils.Process.wait(2500);
    }
  }

  return { db };
};
