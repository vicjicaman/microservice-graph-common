import * as Utils from "@nebulario/microservice-utils";

export const connect = async ({ mongoose, url, user, password, database }) => {
  let db = null;
  let connected = false;

  while (!connected) {
    try {
      console.log("Connect to data service...");
      console.log(
        "mongodb://" +
          user +
          ":" +
          password +
          "@" +
          url +
          "/" +
          database
      );
      const db = await mongoose.connect(
        "mongodb://" + user + ":" + password + "@" + url + "/" + database,
        {
          useNewUrlParser: true,
          reconnectTries: 3,
          reconnectInterval: 100
        }
      );
      console.log("connected!");

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
